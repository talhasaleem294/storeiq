import { getServiceClient } from '../_shared/auth.ts'
import { handleCors } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  // Cron-only endpoint — authenticated via shared secret
  const cronSecret = Deno.env.get('CRON_SECRET')
  const incoming = req.headers.get('x-cron-secret')
  if (!cronSecret || incoming !== cronSecret) {
    return errorResponse('Forbidden', 'FORBIDDEN', 403)
  }

  // Fetch live PKR/USD rate from open.er-api.com (no API key required)
  let usdToPkr = 278
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (res.ok) {
      const json = await res.json() as { rates?: Record<string, number> }
      const pkrRate = json.rates?.['PKR']
      if (pkrRate && pkrRate > 0) usdToPkr = pkrRate
    }
  } catch (err) {
    console.error('[update-exchange-rate] fetch failed:', err)
    return errorResponse('Failed to fetch exchange rate', 'FETCH_ERROR', 500)
  }

  // Update all workspace_cost_config rows with the new rate
  const db = getServiceClient()
  const { error } = await db
    .from('workspace_cost_config')
    .update({ usd_to_pkr_rate: usdToPkr })
    .neq('workspace_id', '00000000-0000-0000-0000-000000000000') // update all rows

  if (error) {
    console.error('[update-exchange-rate] DB update failed:', error)
    return errorResponse('Failed to update rate', 'DB_ERROR', 500)
  }

  console.log(`[update-exchange-rate] USD/PKR rate updated to ${String(usdToPkr)}`)
  return jsonResponse({ usd_to_pkr_rate: usdToPkr })
})
