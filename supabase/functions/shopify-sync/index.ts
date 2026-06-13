import { getServiceClient } from '../_shared/auth.ts'
import { handleCors } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/response.ts'

interface ShopifyOrderNode {
  id: string
  name: string
  totalPrice: string
  displayFinancialStatus: string
  displayFulfillmentStatus: string
  createdAt: string
  shippingAddress: { city: string } | null
  customer: { id: string; email: string } | null
  refunds: Array<{
    transactions: Array<{ amountSet: { shopMoney: { amount: string } } }>
  }>
}

interface GraphQLResponse {
  data?: {
    orders: {
      edges: Array<{ node: ShopifyOrderNode; cursor: string }>
      pageInfo: { hasNextPage: boolean; endCursor: string }
    }
  }
  errors?: Array<{ message: string }>
}

const ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      edges {
        cursor
        node {
          id
          name
          totalPrice
          displayFinancialStatus
          displayFulfillmentStatus
          createdAt
          shippingAddress { city }
          customer { id email }
          refunds {
            transactions {
              amountSet { shopMoney { amount } }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

  const { workspaceId } = await req.json() as { workspaceId?: string }
  if (!workspaceId) return errorResponse('workspaceId is required', 'MISSING_WORKSPACE_ID')

  const db = getServiceClient()

  const { data: conn, error: connErr } = await db
    .from('shopify_connections')
    .select('shop_domain, access_token, last_synced_at')
    .eq('workspace_id', workspaceId)
    .single()

  if (connErr || !conn) {
    return errorResponse('No Shopify connection found', 'NOT_CONNECTED', 404)
  }

  const { shop_domain, access_token, last_synced_at } = conn as {
    shop_domain: string
    access_token: string
    last_synced_at: string | null
  }

  // Incremental sync: if we have a prior sync timestamp, only fetch orders
  // updated since then (catches refunds, status changes, new orders).
  // First-time sync falls back to the last 90 days.
  const syncFilter = last_synced_at
    ? `updated_at:>=${last_synced_at}`
    : (() => {
        const d = new Date()
        d.setDate(d.getDate() - 90)
        return `created_at:>=${d.toISOString().split('T')[0]}`
      })()

  const syncStartedAt = new Date().toISOString()
  let synced = 0
  let cursor: string | null = null
  const graphqlUrl = `https://${shop_domain}/admin/api/2026-04/graphql.json`

  while (true) {
    await new Promise((r) => setTimeout(r, 500)) // respect ~2 req/sec

    const variables: Record<string, unknown> = {
      first: 250,
      query: syncFilter,
      ...(cursor ? { after: cursor } : {}),
    }

    let res: Response
    try {
      res = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: ORDERS_QUERY, variables }),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch failed'
      console.error(`[shopify-sync] network error:`, msg)
      return jsonResponse({ synced, error: msg, workspace_id: workspaceId })
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '2', 10)
      console.warn(`[shopify-sync] rate limited, retrying after ${String(retryAfter)}s`)
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      continue
    }

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[shopify-sync] GraphQL error ${res.status}:`, errText)
      return jsonResponse({ synced, error: `Shopify API ${res.status}`, workspace_id: workspaceId })
    }

    const json = await res.json() as GraphQLResponse

    if (json.errors?.length) {
      console.error('[shopify-sync] GraphQL errors:', JSON.stringify(json.errors))
      return jsonResponse({ synced, error: json.errors[0].message, workspace_id: workspaceId })
    }

    const orders = json.data?.orders.edges ?? []
    if (orders.length === 0) break

    const rows = orders.map(({ node }) => {
      const refundAmount = node.refunds.reduce(
        (sum, r) => sum + r.transactions.reduce(
          (s, t) => s + parseFloat(t.amountSet.shopMoney.amount), 0
        ), 0
      )
      return {
        workspace_id: workspaceId,
        // Shopify GQL id is "gid://shopify/Order/12345" — extract numeric ID
        shopify_order_id: node.id.split('/').pop() ?? node.id,
        revenue: parseFloat(node.totalPrice),
        refund_amount: refundAmount,
        status: node.displayFinancialStatus.toLowerCase(),
        fulfillment_status: node.displayFulfillmentStatus.toLowerCase(),
        city:           node.shippingAddress?.city ?? null,
        customer_id:    node.customer?.id.split('/').pop() ?? null,
        customer_email: node.customer?.email ?? null,
      }
    })

    await db
      .from('orders')
      .upsert(rows, { onConflict: 'workspace_id,shopify_order_id', ignoreDuplicates: false })

    synced += rows.length

    const pageInfo = json.data?.orders.pageInfo
    if (!pageInfo?.hasNextPage) break
    cursor = pageInfo.endCursor
  }

  // Record sync timestamp so the next run only fetches new/updated orders
  await db
    .from('shopify_connections')
    .update({ last_synced_at: syncStartedAt })
    .eq('workspace_id', workspaceId)

  return jsonResponse({ synced, workspace_id: workspaceId, incremental: last_synced_at !== null })
})
