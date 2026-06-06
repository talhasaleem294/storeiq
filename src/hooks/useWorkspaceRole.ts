import { useEffect, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import type { WorkspaceMemberRole } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'

interface UseWorkspaceRoleReturn {
  role: WorkspaceMemberRole | null
  loading: boolean
  error: string | null
}

export function useWorkspaceRole(workspaceId: string): UseWorkspaceRoleReturn {
  const { user, loading: authLoading } = useAuth()
  const [role, setRole] = useState<WorkspaceMemberRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!workspaceId || !user?.id) {
      setRole(null)
      setLoading(false)
      setError(!workspaceId ? 'No workspace ID' : 'Not authenticated')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setRole(null)
        } else {
          setRole(data ? (data.role as WorkspaceMemberRole) : null)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId, user?.id, authLoading])

  return { role, loading, error }
}
