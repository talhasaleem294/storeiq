import { getServiceClient } from '../_shared/auth.ts'
import { handleCors } from '../_shared/cors.ts'

const META_APP_ID = Deno.env.get('META_APP_ID')!
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!
const APP_URL = Deno.env.get('APP_URL')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/meta-oauth`
const GRAPH_API = 'https://graph.facebook.com/v21.0'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') // workspaceId
  const error = url.searchParams.get('error')

  // Meta OAuth callback — code + state present
  if (code && state) {
    // Exchange code for user access token
    let access_token: string
    try {
      const tokenUrl = new URL(`${GRAPH_API}/oauth/access_token`)
      tokenUrl.searchParams.set('client_id', META_APP_ID)
      tokenUrl.searchParams.set('redirect_uri', REDIRECT_URI)
      tokenUrl.searchParams.set('client_secret', META_APP_SECRET)
      tokenUrl.searchParams.set('code', code)

      const tokenRes = await fetch(tokenUrl.toString())
      if (!tokenRes.ok) {
        const text = await tokenRes.text()
        console.error('[meta-oauth] token exchange failed:', text)
        return Response.redirect(`${APP_URL}/app/${state}/settings?meta=error&reason=token_exchange_failed`)
      }

      const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string } }
      if (!tokenData.access_token) {
        console.error('[meta-oauth] no access_token in response:', tokenData)
        return Response.redirect(`${APP_URL}/app/${state}/settings?meta=error&reason=no_token`)
      }
      access_token = tokenData.access_token
    } catch (err) {
      console.error('[meta-oauth] fetch error during token exchange:', err)
      return Response.redirect(`${APP_URL}/app/${state}/settings?meta=error&reason=network_error`)
    }

    // Get user's ad accounts
    let ads_account_id: string
    try {
      const accountsRes = await fetch(
        `${GRAPH_API}/me/adaccounts?fields=id,name&access_token=${access_token}`
      )
      if (!accountsRes.ok) {
        const text = await accountsRes.text()
        console.error('[meta-oauth] ad accounts fetch failed:', text)
        return Response.redirect(`${APP_URL}/app/${state}/settings?meta=error&reason=no_ad_accounts`)
      }

      const accountsData = await accountsRes.json() as {
        data?: Array<{ id: string; name: string }>
        error?: { message: string }
      }

      if (!accountsData.data || accountsData.data.length === 0) {
        console.error('[meta-oauth] no ad accounts found')
        return Response.redirect(`${APP_URL}/app/${state}/settings?meta=error&reason=no_ad_accounts`)
      }

      ads_account_id = accountsData.data[0].id // stored as "act_XXXXXXXXX"
    } catch (err) {
      console.error('[meta-oauth] fetch error getting ad accounts:', err)
      return Response.redirect(`${APP_URL}/app/${state}/settings?meta=error&reason=network_error`)
    }

    // Save to meta_connections via service role (bypasses RLS)
    const db = getServiceClient()
    const { error: dbError } = await db
      .from('meta_connections')
      .upsert(
        { workspace_id: state, ads_account_id, access_token },
        { onConflict: 'workspace_id' }
      )

    if (dbError) {
      console.error('[meta-oauth] db error:', dbError)
      return Response.redirect(`${APP_URL}/app/${state}/settings?meta=error&reason=db_error`)
    }

    return Response.redirect(`${APP_URL}/app/${state}/settings?meta=connected`)
  }

  // User denied access or Meta returned an error
  if (error && state) {
    console.error('[meta-oauth] Meta OAuth error:', error, url.searchParams.get('error_description'))
    return Response.redirect(`${APP_URL}/app/${state}/settings?meta=error&reason=access_denied`)
  }

  return new Response('Bad request', { status: 400 })
})
