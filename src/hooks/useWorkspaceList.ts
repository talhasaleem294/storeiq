import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { Workspace } from '@/types/app'

interface UseWorkspaceListReturn {
  workspaces: Workspace[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useWorkspaceList(): UseWorkspaceListReturn {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => {
    setTick((t) => t + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void supabase
      .from('workspaces')
      .select('id, name, owner_user_id, subscription_status, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
        } else {
          setWorkspaces(data)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  return { workspaces, loading, error, refetch }
}
