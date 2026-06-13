import { getServiceClient, getSupabaseClient } from '../_shared/auth.ts'
import { handleCors } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/response.ts'
import { fetchWithRetry } from '../_shared/retry.ts'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return errorResponse('Missing authorization header', 'UNAUTHORIZED', 401)

  // Verify user is authenticated
  const userClient = getSupabaseClient(authHeader)
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

  let workspaceId: string
  try {
    const body = await req.json() as { workspaceId?: string }
    workspaceId = body.workspaceId ?? ''
  } catch {
    return errorResponse('Invalid request body', 'INVALID_BODY')
  }

  if (!workspaceId) return errorResponse('workspaceId is required', 'MISSING_WORKSPACE_ID')

  // Get meta connection (service role to access access_token)
  const db = getServiceClient()
  const { data: conn, error: connError } = await db
    .from('meta_connections')
    .select('ads_account_id, access_token, token_expires_at')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (connError || !conn) {
    return errorResponse('Meta Ads not connected', 'NOT_CONNECTED', 404)
  }

  let { ads_account_id, access_token } = conn as { ads_account_id: string; access_token: string; token_expires_at?: string | null }
  const tokenExpiresAt = (conn as { token_expires_at?: string | null }).token_expires_at

  // Proactively refresh token if expiring within 10 days
  if (tokenExpiresAt) {
    const daysLeft = (new Date(tokenExpiresAt).getTime() - Date.now()) / 86_400_000
    if (daysLeft < 10) {
      const META_APP_ID = Deno.env.get('META_APP_ID') ?? ''
      const META_APP_SECRET = Deno.env.get('META_APP_SECRET') ?? ''
      const refreshUrl = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${access_token}`
      try {
        const refreshRes = await fetch(refreshUrl)
        if (refreshRes.ok) {
          const refreshJson = await refreshRes.json() as { access_token?: string; expires_in?: number }
          if (refreshJson.access_token) {
            const newExpiry = new Date(Date.now() + (refreshJson.expires_in ?? 5_184_000) * 1000).toISOString()
            await db.from('meta_connections').update({
              access_token: refreshJson.access_token,
              token_expires_at: newExpiry,
            }).eq('workspace_id', workspaceId)
            access_token = refreshJson.access_token
            console.log(`[meta-sync] refreshed token for workspace ${workspaceId}, expires ${newExpiry}`)
          }
        }
      } catch (err) {
        console.error('[meta-sync] token refresh failed (non-fatal):', err)
      }
    }
  }

  // Fetch current campaign statuses (one request, no pagination needed for typical accounts)
  const statusMap = new Map<string, string>()
  try {
    const campaignsUrl = new URL(`${GRAPH_API}/${ads_account_id}/campaigns`)
    campaignsUrl.searchParams.set('fields', 'id,effective_status')
    campaignsUrl.searchParams.set('limit', '200')
    campaignsUrl.searchParams.set('access_token', access_token)

    const campaignsRes = await fetchWithRetry(campaignsUrl.toString(), {})
    if (campaignsRes.ok) {
      const campaignsJson = await campaignsRes.json() as {
        data?: Array<{ id: string; effective_status: string }>
      }
      for (const c of campaignsJson.data ?? []) {
        statusMap.set(c.id, c.effective_status)
      }
    }
  } catch (err) {
    console.error('[meta-sync] failed to fetch campaign statuses:', err)
    // Non-fatal — sync continues, status will default to UNKNOWN
  }

  // Fetch campaign insights from Meta — last 30 days, one row per campaign per day
  let synced = 0
  let afterCursor: string | null = null

  while (true) {
    try {
      const insightsUrl = new URL(`${GRAPH_API}/${ads_account_id}/insights`)
      insightsUrl.searchParams.set('fields', 'campaign_id,campaign_name,spend,purchase_roas,ctr')
      insightsUrl.searchParams.set('level', 'campaign')
      insightsUrl.searchParams.set('date_preset', 'last_30d')
      insightsUrl.searchParams.set('time_increment', '1')
      insightsUrl.searchParams.set('access_token', access_token)
      if (afterCursor) insightsUrl.searchParams.set('after', afterCursor)

      const res = await fetchWithRetry(insightsUrl.toString(), {})
      if (!res.ok) {
        const text = await res.text()
        console.error('[meta-sync] insights API error:', text)
        break
      }

      // Check Meta ad account rate limit budget — bail early before getting throttled
      const usageHeader = res.headers.get('x-ad-account-usage')
      if (usageHeader) {
        try {
          const usage = JSON.parse(usageHeader) as { call_count?: number }
          if ((usage.call_count ?? 0) > 80) {
            console.warn(`[meta-sync] ad account usage at ${String(usage.call_count)}% — stopping early to avoid throttle`)
            break
          }
        } catch {
          // non-fatal — header parse failed, continue
        }
      }

      const json = await res.json() as {
        data?: Array<{
          campaign_id: string
          campaign_name: string
          spend: string
          purchase_roas?: Array<{ action_type: string; value: string }>
          ctr?: string
          date_start: string
        }>
        paging?: { cursors?: { after?: string }; next?: string }
        error?: { message: string }
      }

      if (json.error || !json.data) {
        console.error('[meta-sync] API error in response:', json.error)
        break
      }

      if (json.data.length === 0) break

      const rows = json.data.map((item) => ({
        workspace_id: workspaceId,
        campaign_id: item.campaign_id,
        campaign_name: item.campaign_name,
        spend: parseFloat(item.spend ?? '0'),
        roas: parseFloat(item.purchase_roas?.[0]?.value ?? '0'),
        ctr: parseFloat(item.ctr ?? '0') / 100, // Meta returns percentage; store as decimal
        date: item.date_start,
        status: statusMap.get(item.campaign_id) ?? 'UNKNOWN',
      }))

      const { error: upsertError } = await db
        .from('ads_data')
        .upsert(rows, { onConflict: 'workspace_id,campaign_id,date', ignoreDuplicates: false })

      if (upsertError) {
        console.error('[meta-sync] upsert error:', upsertError)
      } else {
        synced += rows.length
      }

      // Paginate if there's a next page
      if (json.paging?.next && json.paging.cursors?.after) {
        afterCursor = json.paging.cursors.after
      } else {
        break
      }
    } catch (err) {
      console.error('[meta-sync] unexpected error:', err)
      break
    }
  }

  return jsonResponse({ synced, workspace_id: workspaceId })
})
