import { getServiceClient } from '../_shared/auth.ts'
import { handleCors } from '../_shared/cors.ts'

const SHOPIFY_CLIENT_ID = Deno.env.get('SHOPIFY_CLIENT_ID')!
const SHOPIFY_CLIENT_SECRET = Deno.env.get('SHOPIFY_SECRET')!
const APP_URL = Deno.env.get('APP_URL')!

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const shop = url.searchParams.get('shop')
  const state = url.searchParams.get('state') // workspaceId
  const hmac = url.searchParams.get('hmac')

  if (!code || !shop || !state || !hmac) {
    return Response.redirect(`${APP_URL}/app/${state ?? ''}/settings?error=missing_params`)
  }

  // Validate Shopify HMAC signature
  const isValid = await validateShopifyHmac(url.searchParams, SHOPIFY_CLIENT_SECRET)
  if (!isValid) {
    return Response.redirect(`${APP_URL}/app/${state}/settings?error=invalid_hmac`)
  }

  // Exchange code for access token
  let access_token: string
  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      console.error('[shopify-oauth] token exchange failed:', text)
      return Response.redirect(`${APP_URL}/app/${state}/settings?error=token_exchange_failed`)
    }

    const body = await tokenRes.json() as { access_token: string }
    access_token = body.access_token
  } catch (err) {
    console.error('[shopify-oauth] fetch error:', err)
    return Response.redirect(`${APP_URL}/app/${state}/settings?error=network_error`)
  }

  // Store token in database via service role (bypasses RLS)
  const db = getServiceClient()
  const { error: dbError } = await db
    .from('shopify_connections')
    .upsert(
      { workspace_id: state, shop_domain: shop, access_token },
      { onConflict: 'workspace_id' }
    )

  if (dbError) {
    console.error('[shopify-oauth] db error:', dbError)
    return Response.redirect(`${APP_URL}/app/${state}/settings?error=db_error`)
  }

  // Register webhooks and trigger historical sync (fire and forget)
  void registerWebhooks(shop, access_token)
  void syncHistoricalOrders(shop, access_token, state, db)

  return Response.redirect(`${APP_URL}/app/${state}/settings?shopify=connected`)
})

async function validateShopifyHmac(
  params: URLSearchParams,
  secret: string
): Promise<boolean> {
  const message = [...params.entries()]
    .filter(([k]) => k !== 'hmac')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return computed === params.get('hmac')
}

async function registerWebhooks(shop: string, accessToken: string): Promise<void> {
  const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-webhook`
  const topics = ['orders/create', 'orders/updated', 'refunds/create']

  for (const topic of topics) {
    try {
      await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook: { topic, address: webhookUrl, format: 'json' },
        }),
      })
    } catch (err) {
      console.error(`[shopify-oauth] webhook registration failed for ${topic}:`, err)
    }
  }
}

const ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      edges {
        cursor
        node {
          id
          totalPrice
          displayFinancialStatus
          createdAt
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

async function syncHistoricalOrders(
  shop: string,
  accessToken: string,
  workspaceId: string,
  // deno-lint-ignore no-explicit-any
  db: any
): Promise<void> {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const sinceDate = ninetyDaysAgo.toISOString().split('T')[0]

  const graphqlUrl = `https://${shop}/admin/api/2026-04/graphql.json`
  let cursor: string | null = null

  while (true) {
    try {
      await new Promise((r) => setTimeout(r, 500))

      const variables: Record<string, unknown> = {
        first: 250,
        query: `created_at:>=${sinceDate}`,
        ...(cursor ? { after: cursor } : {}),
      }

      const res = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: ORDERS_QUERY, variables }),
      })

      if (!res.ok) break

      const json = await res.json() as {
        data?: { orders: { edges: Array<{ node: { id: string; totalPrice: string; displayFinancialStatus: string }; cursor: string }>; pageInfo: { hasNextPage: boolean; endCursor: string } } }
        errors?: Array<{ message: string }>
      }

      if (json.errors?.length || !json.data) break

      const edges = json.data.orders.edges
      if (edges.length === 0) break

      const rows = edges.map(({ node }) => ({
        workspace_id: workspaceId,
        shopify_order_id: node.id.split('/').pop() ?? node.id,
        revenue: parseFloat(node.totalPrice),
        refund_amount: 0,
        status: node.displayFinancialStatus.toLowerCase(),
      }))

      await db
        .from('orders')
        .upsert(rows, { onConflict: 'workspace_id,shopify_order_id', ignoreDuplicates: false })

      if (!json.data.orders.pageInfo.hasNextPage) break
      cursor = json.data.orders.pageInfo.endCursor
    } catch (err) {
      console.error('[shopify-oauth] sync error:', err)
      break
    }
  }
}
