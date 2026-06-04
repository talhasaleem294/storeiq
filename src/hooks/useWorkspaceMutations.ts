import { useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { Workspace } from '@/types/app'

interface UseWorkspaceMutationsReturn {
  createWorkspace: (name: string, selectedPlan?: string | null) => Promise<Workspace>
  loading: boolean
  error: string | null
}

export function useWorkspaceMutations(): UseWorkspaceMutationsReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createWorkspace(
    name: string,
    selectedPlan: string | null = null,
  ): Promise<Workspace> {
    setLoading(true)
    setError(null)

    const result = await supabase.rpc('create_workspace', {
      workspace_name: name,
      selected_plan: selectedPlan,
    })
    const rpcData = result.data as Workspace | null
    const err = result.error

    setLoading(false)

    if (err) {
      setError(err.message)
      throw new Error(err.message)
    }

    return rpcData as Workspace
  }

  return { createWorkspace, loading, error }
}
