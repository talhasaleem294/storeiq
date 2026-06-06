import { getServiceClient, getSupabaseClient } from '../_shared/auth.ts'
import { handleCors } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/response.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

  const userClient = getSupabaseClient(authHeader)
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)

  const body = await req.json() as { workspaceId?: string; invitedEmail?: string; role?: string }
  const { workspaceId, invitedEmail, role } = body

  if (!workspaceId || !invitedEmail || !role) {
    return errorResponse('workspaceId, invitedEmail, and role are required', 'MISSING_FIELDS', 400)
  }

  if (role !== 'admin' && role !== 'supervisor') {
    return errorResponse('role must be admin or supervisor', 'INVALID_ROLE', 400)
  }

  // Verify caller is owner or admin of this workspace
  const { data: callerMember } = await userClient
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!callerMember || !['owner', 'admin'].includes(callerMember.role as string)) {
    return errorResponse('You do not have permission to invite members', 'FORBIDDEN', 403)
  }

  const serviceClient = getServiceClient()

  // Check for an existing pending invite for this email in this workspace
  const { data: existingInvite } = await serviceClient
    .from('workspace_invites')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('invited_email', invitedEmail.toLowerCase())
    .is('accepted_at', null)
    .maybeSingle()

  if (existingInvite) {
    return errorResponse('A pending invite already exists for this email', 'INVITE_EXISTS', 400)
  }

  // Insert invite row first to get the token
  const { data: invite, error: insertErr } = await serviceClient
    .from('workspace_invites')
    .insert({
      workspace_id: workspaceId,
      invited_email: invitedEmail.toLowerCase(),
      role,
      invited_by: user.id,
    })
    .select('token')
    .single()

  if (insertErr || !invite) {
    return errorResponse('Failed to create invite', 'DB_ERROR', 500)
  }

  // Send invite email via Supabase Auth — stores metadata on the user record
  const { error: inviteErr } = await serviceClient.auth.admin.inviteUserByEmail(invitedEmail, {
    data: {
      pending_workspace_id: workspaceId,
      pending_role: role,
      invite_token: (invite as { token: string }).token,
    },
    redirectTo: `${Deno.env.get('APP_URL') ?? ''}/auth/accept-invite`,
  })

  if (inviteErr) {
    // Clean up the invite row if email sending failed
    await serviceClient.from('workspace_invites').delete().eq('token', (invite as { token: string }).token)
    return errorResponse('Failed to send invite email: ' + inviteErr.message, 'EMAIL_ERROR', 500)
  }

  return jsonResponse({ success: true })
})
