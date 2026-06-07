import { getServiceClient } from '../_shared/auth.ts'
import { errorResponse, jsonResponse } from '../_shared/response.ts'

Deno.serve(async (req) => {
  // Verify webhook HMAC
  const hmacHeader = req.headers.get('X-Shopify-Hmac-SHA256') ?? ''
  const rawBody = await req.text()

  const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET')
  if (webhookSecret) {
    const isValid = await verifyWebhookHmac(rawBody, hmacHeader, webhookSecret)
    if (!isValid) {
      return errorResponse('Invalid signature', 'INVALID_SIGNATURE', 401)
    }
  }

  const shopDomain = req.headers.get('X-Shopify-Shop-Domain') ?? ''
  const topic = req.headers.get('X-Shopify-Topic') ?? ''

  const db = getServiceClient()

  // Find workspace for this shop
  const { data: connection, error: connErr } = await db
    .from('shopify_connections')
    .select('workspace_id')
    .eq('shop_domain', shopDomain)
    .single()

  if (connErr || !connection) {
    return errorResponse('Unknown shop', 'UNKNOWN_SHOP', 404)
  }

  const workspaceId = (connection as { workspace_id: string }).workspace_id

  if (topic === 'orders/create' || topic === 'orders/updated') {
    const order = JSON.parse(rawBody) as {
      id: number
      total_price: string
      financial_status: string
      fulfillment_status: string | null
    }

    await db.from('orders').upsert(
      {
        workspace_id: workspaceId,
        shopify_order_id: String(order.id),
        revenue: parseFloat(order.total_price),
        // refund_amount omitted: DB DEFAULT 0 on insert, preserved on update
        status: order.financial_status,
        fulfillment_status: order.fulfillment_status ?? 'unfulfilled',
      },
      { onConflict: 'workspace_id,shopify_order_id' }
    )
  }

  if (topic === 'refunds/create') {
    const refund = JSON.parse(rawBody) as {
      order_id: number
      transactions: Array<{ amount: string }>
    }

    const refundAmount = refund.transactions.reduce(
      (sum, t) => sum + parseFloat(t.amount),
      0
    )

    await db
      .from('orders')
      .update({ refund_amount: refundAmount })
      .eq('workspace_id', workspaceId)
      .eq('shopify_order_id', String(refund.order_id))
  }

  return jsonResponse({ received: true })
})

async function verifyWebhookHmac(
  body: string,
  header: string,
  secret: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return computed === header
}
