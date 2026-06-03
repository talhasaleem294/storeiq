import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { MetaConnection } from '@/types/app'

interface UseMetaConnectionReturn {
  connection: MetaConnection | null
  loading: boolean
  error: string | null
  connect: () => void
  disconnect: () => Promise<void>
  refetch: () => void
}

export function useMetaConnection(workspaceId: string): UseMetaConnectionReturn {
  const [connection, setConnection] = useState<MetaConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConnection = useCallback(async (): Promise<void> => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('meta_connections')
      .select('id, workspace_id, ads_account_id, token_expires_at, created_at')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (err) {
      setError(err.message)
    } else {
      setConnection(data)
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    void fetchConnection()
  }, [fetchConnection])

  function connect(): void {
    const clientId = import.meta.env.VITE_META_APP_ID as string
    const redirectUri = `${String(import.meta.env.VITE_SUPABASE_URL)}/functions/v1/meta-oauth`

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'ads_read',
      state: workspaceId,
      response_type: 'code',
    })

    window.location.href = `https://www.facebook.com/dialog/oauth?${params.toString()}`
  }

  async function disconnect(): Promise<void> {
    if (!connection) return
    setLoading(true)

    const { error: err } = await supabase
      .from('meta_connections')
      .delete()
      .eq('workspace_id', workspaceId)

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      setConnection(null)
      setLoading(false)
    }
  }

  function refetch(): void { void fetchConnection() }

  return { connection, loading, error, connect, disconnect, refetch }
}
