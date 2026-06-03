import { getServiceClient, getSupabaseClient } from '../_shared/auth.ts'
import { handleCors } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

  // Verify the user is authenticated
  const userClient = getSupabaseClient(authHeader)
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

  const body = await req.json() as { workspaceId?: string; shopDomain?: string; accessToken?: string }
  const { workspaceId, shopDomain, accessToken } = body

  if (!workspaceId || !shopDomain || !accessToken) {
    return errorResponse('workspaceId, shopDomain, and accessToken are required', 'MISSING_FIELDS')
  }

  // Verify user is a member of this workspace
  const { data: member } = await userClient
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return errorResponse('Not a member of this workspace', 'FORBIDDEN', 403)

  // Quick validation: test the token against Shopify before saving
  const testRes = await fetch(
    `https://${shopDomain}/admin/api/2026-04/shop.json`,
    { headers: { 'X-Shopify-Access-Token': accessToken } }
  )

  if (!testRes.ok) {
    return errorResponse(
      'Invalid Shopify token or shop domain — make sure you copied the correct Admin API access token',
      'INVALID_TOKEN',
      400
    )
  }

  // Store using service role (bypasses RLS — token must never be readable client-side)
  const db = getServiceClient()
  const { error: upsertErr } = await db
    .from('shopify_connections')
    .upsert(
      { workspace_id: workspaceId, shop_domain: shopDomain, access_token: accessToken },
      { onConflict: 'workspace_id' }
    )

  if (upsertErr) {
    return errorResponse('Failed to save connection', 'DB_ERROR', 500)
  }

  // Trigger historical sync (fire and forget)
  void fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-sync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ workspaceId }),
    }
  )

  return jsonResponse({ connected: true, shop_domain: shopDomain })
})
