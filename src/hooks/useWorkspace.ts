import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { Workspace } from '@/types/app'

interface UseWorkspaceReturn {
  workspace: Workspace | null
  loading: boolean
  error: string | null
}

export function useWorkspace(workspaceId: string): UseWorkspaceReturn {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) {
      setWorkspace(null)
      setLoading(false)
      setError('No workspace ID provided')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void supabase
      .from('workspaces')
      .select('id, name, owner_user_id, subscription_status, created_at')
      .eq('id', workspaceId)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setWorkspace(null)
        } else {
          setWorkspace(data)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId])

  return { workspace, loading, error }
}
