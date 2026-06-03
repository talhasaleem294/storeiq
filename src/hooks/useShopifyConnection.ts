import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { ShopifyConnection } from '@/types/app'

interface UseShopifyConnectionReturn {
  connection: ShopifyConnection | null
  loading: boolean
  error: string | null
  connect: (shopDomain: string) => void
  connectWithToken: (shopDomain: string, accessToken: string) => Promise<void>
  disconnect: () => Promise<void>
  refetch: () => void
}

export function useShopifyConnection(workspaceId: string): UseShopifyConnectionReturn {
  const [connection, setConnection] = useState<ShopifyConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConnection = useCallback(async (): Promise<void> => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('shopify_connections')
      .select('id, workspace_id, shop_domain, token_expires_at, created_at')
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

  function connect(shopDomain: string): void {
    const clientId = import.meta.env.VITE_SHOPIFY_CLIENT_ID as string
    const clean = shopDomain.replace(/https?:\/\//, '').replace(/\/$/, '')
    const shop = clean.includes('.myshopify.com') ? clean : `${clean}.myshopify.com`

    const params = new URLSearchParams({
      client_id: clientId,
      scope: 'read_orders,read_products',
      redirect_uri: `${String(import.meta.env.VITE_SUPABASE_URL)}/functions/v1/shopify-oauth`,
      state: workspaceId,
    })

    window.location.href = `https://${shop}/admin/oauth/authorize?${params.toString()}`
  }

  async function connectWithToken(shopDomain: string, accessToken: string): Promise<void> {
    setLoading(true)
    setError(null)
    const clean = shopDomain.replace(/https?:\/\//, '').replace(/\/$/, '')
    const shop = clean.includes('.myshopify.com') ? clean : `${clean}.myshopify.com`

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${String(import.meta.env.VITE_SUPABASE_URL)}/functions/v1/shopify-token-connect`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ workspaceId, shopDomain: shop, accessToken }),
      }
    )

    if (!res.ok) {
      const body = await res.json() as { error?: string }
      setError(body.error ?? 'Failed to connect')
      setLoading(false)
      return
    }

    await fetchConnection()
  }

  async function disconnect(): Promise<void> {
    if (!connection) return
    setLoading(true)

    const { error: err } = await supabase
      .from('shopify_connections')
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

  return { connection, loading, error, connect, connectWithToken, disconnect, refetch }
}
