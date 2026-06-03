import { getServiceClient } from '../_shared/auth.ts'
import { handleCors } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/response.ts'

interface ShopifyOrderNode {
  id: string
  name: string
  totalPrice: string
  displayFinancialStatus: string
  createdAt: string
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
          createdAt
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
    .select('shop_domain, access_token')
    .eq('workspace_id', workspaceId)
    .single()

  if (connErr || !conn) {
    return errorResponse('No Shopify connection found', 'NOT_CONNECTED', 404)
  }

  const { shop_domain, access_token } = conn as { shop_domain: string; access_token: string }

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const sinceDate = ninetyDaysAgo.toISOString().split('T')[0] // YYYY-MM-DD

  let synced = 0
  let cursor: string | null = null
  const graphqlUrl = `https://${shop_domain}/admin/api/2026-04/graphql.json`

  while (true) {
    await new Promise((r) => setTimeout(r, 500)) // respect ~2 req/sec

    const variables: Record<string, unknown> = {
      first: 250,
      query: `created_at:>=${sinceDate}`,
      ...(cursor ? { after: cursor } : {}),
    }

    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: ORDERS_QUERY, variables }),
    })

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

    const rows = orders.map(({ node }) => ({
      workspace_id: workspaceId,
      // Shopify GQL id is "gid://shopify/Order/12345" — extract numeric ID
      shopify_order_id: node.id.split('/').pop() ?? node.id,
      revenue: parseFloat(node.totalPrice),
      refund_amount: 0,
      status: node.displayFinancialStatus.toLowerCase(),
    }))

    await db
      .from('orders')
      .upsert(rows, { onConflict: 'workspace_id,shopify_order_id', ignoreDuplicates: false })

    synced += rows.length

    const pageInfo = json.data?.orders.pageInfo
    if (!pageInfo?.hasNextPage) break
    cursor = pageInfo.endCursor
  }

  return jsonResponse({ synced, workspace_id: workspaceId })
})
