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

async function syncWorkspace(
  workspaceId: string,
  shopDomain: string,
  accessToken: string,
  db: ReturnType<typeof getServiceClient>
): Promise<{ workspaceId: string; synced: number; error?: string }> {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const sinceDate = ninetyDaysAgo.toISOString().split('T')[0]

  let synced = 0
  let cursor: string | null = null
  const graphqlUrl = `https://${shopDomain}/admin/api/2026-04/graphql.json`

  while (true) {
    await new Promise((r) => setTimeout(r, 500)) // respect ~2 req/sec per store

    const variables: Record<string, unknown> = {
      first: 250,
      query: `created_at:>=${sinceDate}`,
      ...(cursor ? { after: cursor } : {}),
    }

    let res: Response
    try {
      res = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: ORDERS_QUERY, variables }),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch failed'
      console.error(`[shopify-sync-all] ${workspaceId} fetch error:`, msg)
      return { workspaceId, synced, error: msg }
    }

    // Retry once on 429 (rate limit)
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '2', 10)
      console.warn(`[shopify-sync-all] ${workspaceId} rate limited, waiting ${String(retryAfter)}s`)
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      continue
    }

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[shopify-sync-all] ${workspaceId} GraphQL error ${res.status}:`, errText)
      return { workspaceId, synced, error: `Shopify API ${res.status}` }
    }

    const json = await res.json() as GraphQLResponse

    if (json.errors?.length) {
      const msg = json.errors[0].message
      console.error(`[shopify-sync-all] ${workspaceId} GraphQL errors:`, msg)
      return { workspaceId, synced, error: msg }
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
        shopify_order_id: node.id.split('/').pop() ?? node.id,
        revenue: parseFloat(node.totalPrice),
        refund_amount: refundAmount,
        status: node.displayFinancialStatus.toLowerCase(),
        fulfillment_status: node.displayFulfillmentStatus.toLowerCase(),
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

  return { workspaceId, synced }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  // Verify this is called from pg_cron via a shared secret
  const cronSecret = Deno.env.get('CRON_SECRET')
  const incoming = req.headers.get('x-cron-secret')
  if (!cronSecret || incoming !== cronSecret) {
    return errorResponse('Forbidden', 'FORBIDDEN', 403)
  }

  const db = getServiceClient()

  // Fetch all workspaces with an active Shopify connection
  const { data: connections, error: connErr } = await db
    .from('shopify_connections')
    .select('workspace_id, shop_domain, access_token')

  if (connErr) {
    console.error('[shopify-sync-all] failed to fetch connections:', connErr.message)
    return errorResponse('Failed to fetch connections', 'DB_ERROR', 500)
  }

  if (!connections || connections.length === 0) {
    return jsonResponse({ message: 'No Shopify connections found', results: [] })
  }

  console.log(`[shopify-sync-all] syncing ${connections.length} workspace(s)`)

  const results: Array<{ workspaceId: string; synced: number; error?: string }> = []

  // Process sequentially — Shopify rate limit is per-store so no cross-store stagger needed
  for (const conn of connections) {
    const { workspace_id, shop_domain, access_token } = conn as {
      workspace_id: string
      shop_domain: string
      access_token: string
    }
    console.log(`[shopify-sync-all] starting workspace ${workspace_id} (${shop_domain})`)
    const result = await syncWorkspace(workspace_id, shop_domain, access_token, db)
    results.push(result)
    console.log(`[shopify-sync-all] done workspace ${workspace_id}: ${String(result.synced)} orders synced`)
  }

  const totalSynced = results.reduce((s, r) => s + r.synced, 0)
  const failed = results.filter((r) => r.error)

  return jsonResponse({
    workspaces: connections.length,
    totalSynced,
    failed: failed.length,
    results,
  })
})
