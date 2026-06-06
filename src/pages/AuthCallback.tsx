import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { SkeletonPage } from '@/components/ui/Skeleton'
import { ADMIN_EMAIL, ROUTES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

export function AuthCallback(): JSX.Element {
  const navigate = useNavigate()

  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        void navigate(ROUTES.LOGIN, { replace: true })
        return
      }

      // Password recovery — redirect to set-password with no workspaceId
      if (window.location.hash.includes('type=recovery')) {
        void navigate(ROUTES.SET_PASSWORD, { replace: true })
        return
      }

      const rawMeta: unknown = session.user.user_metadata
      const meta = rawMeta as { invite_token?: string; pending_workspace_id?: string }
      const inviteToken = meta.invite_token
      const pendingWorkspaceId = meta.pending_workspace_id

      const isInvite =
        window.location.hash.includes('type=invite') || inviteToken !== undefined

      if (isInvite && inviteToken && pendingWorkspaceId) {
        const rpcResult = await supabase.rpc('accept_workspace_invite', {
          invite_token: inviteToken,
        })

        if (rpcResult.error) {
          void navigate(`${ROUTES.WORKSPACES}?invite=error`, { replace: true })
          return
        }

        const result = rpcResult.data as unknown as { workspace_id: string }
        void navigate(
          `${ROUTES.SET_PASSWORD}?workspaceId=${result.workspace_id}`,
          { replace: true }
        )
        return
      }

      const destination =
        session.user.email === ADMIN_EMAIL ? ROUTES.ADMIN : ROUTES.WORKSPACES
      void navigate(destination, { replace: true })
    })
  }, [navigate])

  return <SkeletonPage />
}
