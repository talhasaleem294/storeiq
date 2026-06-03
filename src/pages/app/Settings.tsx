import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMetaConnection } from '@/hooks/useMetaConnection'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { formatDate } from '@/lib/formatters'

type ConnectMode = 'oauth' | 'token'

export function Settings(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { connection, loading, error, connect, connectWithToken, disconnect, refetch } = useShopifyConnection(workspaceId ?? '')
  const { connection: metaConn, loading: metaLoading, error: metaError, connect: metaConnect, disconnect: metaDisconnect } = useMetaConnection(workspaceId ?? '')

  const [connectMode, setConnectMode] = useState<ConnectMode>('oauth')
  const [shopDomain, setShopDomain] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [domainError, setDomainError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [metaDisconnecting, setMetaDisconnecting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showMetaSuccess, setShowMetaSuccess] = useState(false)
  const successClearedRef = useRef(false)
  const metaSuccessClearedRef = useRef(false)

  useEffect(() => {
    if (searchParams.get('shopify') === 'connected' && !successClearedRef.current) {
      setShowSuccess(true)
      successClearedRef.current = true
      const next = new URLSearchParams(searchParams)
      next.delete('shopify')
      setSearchParams(next, { replace: true })
      const timer = setTimeout(() => { setShowSuccess(false); }, 4000)
      return () => { clearTimeout(timer); }
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (searchParams.get('meta') === 'connected' && !metaSuccessClearedRef.current) {
      setShowMetaSuccess(true)
      metaSuccessClearedRef.current = true
      const next = new URLSearchParams(searchParams)
      next.delete('meta')
      setSearchParams(next, { replace: true })
      const timer = setTimeout(() => { setShowMetaSuccess(false); }, 4000)
      return () => { clearTimeout(timer); }
    }
  }, [searchParams, setSearchParams])

  function handleOAuthConnect(e: React.SyntheticEvent): void {
    e.preventDefault()
    const trimmed = shopDomain.trim()
    if (!trimmed) { setDomainError('Please enter your shop domain'); return }
    setDomainError(null)
    connect(trimmed)
  }

  async function handleTokenConnect(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    const domain = shopDomain.trim()
    const token = accessToken.trim()
    if (!domain) { setDomainError('Please enter your shop domain'); return }
    if (!token) { setDomainError('Please enter your Admin API access token'); return }
    setDomainError(null)
    setConnecting(true)
    await connectWithToken(domain, token)
    setConnecting(false)
    if (!error) {
      setShowSuccess(true)
      setAccessToken('')
      refetch()
      setTimeout(() => { setShowSuccess(false); }, 4000)
    }
  }

  async function handleDisconnect(): Promise<void> {
    setDisconnecting(true)
    await disconnect()
    setDisconnecting(false)
  }

  async function handleMetaDisconnect(): Promise<void> {
    setMetaDisconnecting(true)
    await metaDisconnect()
    setMetaDisconnecting(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-heading">Settings</h1>
        <p className="mt-0.5 text-sm text-text">Manage your integrations and workspace.</p>
      </div>

      {/* Success banner */}
      {showSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.354-9.354a.5.5 0 00-.708-.707L7 8.793 5.354 7.146a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l4-4z" clipRule="evenodd" />
          </svg>
          Shopify connected successfully! Your orders are syncing in the background.
        </div>
      )}

      {/* Shopify Integration */}
      <Card padding="lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.337 23.979l7.453-1.628S19.42 7.028 19.398 6.885c-.023-.142-.148-.237-.293-.237-.145 0-2.494-.05-2.494-.05s-1.66-1.605-1.846-1.79V23.98h.572zM11.99 2.5C12.74.755 14.08 0 15.17 0c1.08 0 1.744.726 1.744.726L15.5 3.25s-1.04-.304-1.694-.304c-1.064 0-1.64.682-1.64 1.674v.434h2.88l-.38 2.44h-2.5V23.97l-3.82.836L11.99 2.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-heading">Shopify</h2>
              <p className="text-xs text-text">Connect your Shopify store to sync orders and revenue.</p>
            </div>
          </div>
          {!loading && (
            <Badge variant={connection ? 'success' : 'neutral'}>
              {connection ? 'Connected' : 'Not connected'}
            </Badge>
          )}
          {loading && <Skeleton className="h-6 w-24 rounded-full" />}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : connection ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-surface p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text">Shop domain</span>
                <span className="font-medium text-heading">{connection.shop_domain}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-text">Connected</span>
                <span className="text-heading">{formatDate(connection.created_at)}</span>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              loading={disconnecting}
              onClick={() => void handleDisconnect()}
            >
              Disconnect Shopify
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => { setConnectMode('oauth'); setDomainError(null); }}
                className={`flex-1 px-3 py-2 transition-colors ${connectMode === 'oauth' ? 'bg-accent text-white' : 'bg-bg text-text hover:bg-surface'}`}
              >
                OAuth (Recommended)
              </button>
              <button
                type="button"
                onClick={() => { setConnectMode('token'); setDomainError(null); }}
                className={`flex-1 px-3 py-2 transition-colors ${connectMode === 'token' ? 'bg-accent text-white' : 'bg-bg text-text hover:bg-surface'}`}
              >
                Paste API Token
              </button>
            </div>

            {connectMode === 'oauth' ? (
              <form onSubmit={handleOAuthConnect} className="space-y-3">
                <Input
                  label="Your shop domain"
                  placeholder="yourstore or yourstore.myshopify.com"
                  value={shopDomain}
                  onChange={(e) => { setShopDomain(e.target.value); }}
                  hint="You'll be redirected to Shopify to approve access"
                  error={domainError ?? undefined}
                />
                <Button type="submit" variant="primary" size="sm">
                  Connect via Shopify →
                </Button>
              </form>
            ) : (
              <form onSubmit={(e) => void handleTokenConnect(e)} className="space-y-3">
                <Input
                  label="Shop domain"
                  placeholder="yourstore or yourstore.myshopify.com"
                  value={shopDomain}
                  onChange={(e) => { setShopDomain(e.target.value); }}
                  error={domainError ?? undefined}
                />
                <Input
                  label="Admin API access token"
                  placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                  value={accessToken}
                  onChange={(e) => { setAccessToken(e.target.value); }}
                  hint="Shopify Admin → Settings → Apps → Develop apps → your app → API credentials"
                />
                <Button type="submit" variant="primary" size="sm" loading={connecting}>
                  Save & Connect
                </Button>
              </form>
            )}
          </div>
        )}
      </Card>

      {/* Meta success banner */}
      {showMetaSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.354-9.354a.5.5 0 00-.708-.707L7 8.793 5.354 7.146a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l4-4z" clipRule="evenodd" />
          </svg>
          Meta Ads connected! Your campaign data is ready to view.
        </div>
      )}

      {/* Meta Ads Integration */}
      <Card padding="lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 01-1.93.07 4.28 4.28 0 004 2.98 8.521 8.521 0 01-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-heading">Meta Ads</h2>
              <p className="text-xs text-text">Connect your Meta Ads account for campaign analytics.</p>
            </div>
          </div>
          {!metaLoading && (
            <Badge variant={metaConn ? 'success' : 'neutral'}>
              {metaConn ? 'Connected' : 'Not connected'}
            </Badge>
          )}
          {metaLoading && <Skeleton className="h-6 w-24 rounded-full" />}
        </div>

        {metaError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {metaError}
          </div>
        )}

        {searchParams.get('meta') === 'error' && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            Meta connection failed. Please try again.
          </div>
        )}

        {metaLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : metaConn ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-surface p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text">Ad Account ID</span>
                <span className="font-medium text-heading">{metaConn.ads_account_id}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-text">Connected</span>
                <span className="text-heading">{formatDate(metaConn.created_at)}</span>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              loading={metaDisconnecting}
              onClick={() => void handleMetaDisconnect()}
            >
              Disconnect Meta Ads
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text">
              Connect your Meta Ads account to track ad spend, ROAS, and campaign performance.
              Ad spend will be included in your profit calculation.
            </p>
            <Button variant="primary" size="sm" onClick={metaConnect}>
              Connect via Meta →
            </Button>
          </div>
        )}
      </Card>

      {/* Team Members — post-MVP placeholder */}
      <Card padding="lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-heading">Team Members</h2>
            <p className="text-xs text-text">Invite team members to this workspace.</p>
          </div>
          <Badge variant="neutral" className="ml-auto">Coming soon</Badge>
        </div>
        <p className="text-sm text-text">
          Member invitations will be available soon. You'll be able to add admins who can
          view dashboards and manage connections.
        </p>
      </Card>
    </div>
  )
}
