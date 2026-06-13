import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { WorkspaceMembers } from '@/components/features/WorkspaceMembers'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton, SkeletonPage } from '@/components/ui/Skeleton'
import { useMetaConnection } from '@/hooks/useMetaConnection'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useWorkspaceCostConfig } from '@/hooks/useWorkspaceCostConfig'
import { useWorkspaceRole } from '@/hooks/useWorkspaceRole'
import { BANK_DETAILS, PLANS, TRIAL_DAYS, WHATSAPP_NUMBER } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import { hasPermission } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'

type ConnectMode = 'oauth' | 'token'
type SettingsTab = 'integrations' | 'team' | 'billing' | 'costs'

function trialDaysRemaining(trialStartedAt: string | null): number {
  if (!trialStartedAt) return TRIAL_DAYS
  const expires = new Date(trialStartedAt).getTime() + TRIAL_DAYS * 86_400_000
  return Math.max(Math.ceil((expires - Date.now()) / 86_400_000), 0)
}

export function Settings(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { role, loading: roleLoading } = useWorkspaceRole(workspaceId ?? '')
  const [searchParams, setSearchParams] = useSearchParams()
  const { workspace } = useWorkspace(workspaceId ?? '')
  const { connection, loading, error, connect, connectWithToken, disconnect, refetch } = useShopifyConnection(workspaceId ?? '')
  const { connection: metaConn, loading: metaLoading, error: metaError, connect: metaConnect, disconnect: metaDisconnect } = useMetaConnection(workspaceId ?? '')

  const tabParam = searchParams.get('tab')
  const activeTab: SettingsTab =
    tabParam === 'team' || tabParam === 'billing' || tabParam === 'costs' ? tabParam : 'integrations'

  function setTab(tab: SettingsTab): void {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const [connectMode, setConnectMode] = useState<ConnectMode>('oauth')
  const [shopDomain, setShopDomain] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [domainError, setDomainError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [metaDisconnecting, setMetaDisconnecting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showMetaSuccess, setShowMetaSuccess] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const [resyncMsg, setResyncMsg] = useState<'success' | 'error' | null>(null)
  const successClearedRef = useRef(false)
  const metaSuccessClearedRef = useRef(false)

  // Cost settings
  const { config: costConfig, saving: costSaving, update: updateCostConfig } = useWorkspaceCostConfig(workspaceId ?? '')
  const [costForm, setCostForm] = useState({ cod_fee_flat: '', cod_fee_karachi: '', cod_fee_lahore: '', cod_fee_islamabad: '', cod_fee_other: '', packaging_cost: '', monthly_overheads: '' })
  const [costSaved, setCostSaved] = useState(false)

  useEffect(() => {
    setCostForm({
      cod_fee_flat:      costConfig.cod_fee_flat      > 0 ? String(costConfig.cod_fee_flat)      : '',
      cod_fee_karachi:   costConfig.cod_fee_karachi   > 0 ? String(costConfig.cod_fee_karachi)   : '',
      cod_fee_lahore:    costConfig.cod_fee_lahore    > 0 ? String(costConfig.cod_fee_lahore)    : '',
      cod_fee_islamabad: costConfig.cod_fee_islamabad > 0 ? String(costConfig.cod_fee_islamabad) : '',
      cod_fee_other:     costConfig.cod_fee_other     > 0 ? String(costConfig.cod_fee_other)     : '',
      packaging_cost:    costConfig.packaging_cost    > 0 ? String(costConfig.packaging_cost)    : '',
      monthly_overheads: costConfig.monthly_overheads > 0 ? String(costConfig.monthly_overheads) : '',
    })
  }, [costConfig])

  async function handleSaveCosts(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    await updateCostConfig({
      cod_fee_flat:      Number(costForm.cod_fee_flat)      || 0,
      cod_fee_karachi:   Number(costForm.cod_fee_karachi)   || 0,
      cod_fee_lahore:    Number(costForm.cod_fee_lahore)    || 0,
      cod_fee_islamabad: Number(costForm.cod_fee_islamabad) || 0,
      cod_fee_other:     Number(costForm.cod_fee_other)     || 0,
      packaging_cost:    Number(costForm.packaging_cost)    || 0,
      monthly_overheads: Number(costForm.monthly_overheads) || 0,
    })
    setCostSaved(true)
    setTimeout(() => { setCostSaved(false) }, 4000)
  }

  useEffect(() => {
    if (searchParams.get('shopify') === 'connected' && !successClearedRef.current) {
      setShowSuccess(true)
      successClearedRef.current = true
      if (workspaceId) {
        localStorage.setItem(`storeiq_last_shopify_sync_${workspaceId}`, new Date().toISOString())
      }
      const next = new URLSearchParams(searchParams)
      next.delete('shopify')
      setSearchParams(next, { replace: true })
      const timer = setTimeout(() => { setShowSuccess(false); }, 4000)
      return () => { clearTimeout(timer); }
    }
  }, [searchParams, setSearchParams, workspaceId])

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

  async function handleResync(): Promise<void> {
    if (!workspaceId) return
    setResyncing(true)
    setResyncMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${String(import.meta.env.VITE_SUPABASE_URL)}/functions/v1/shopify-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ workspaceId }),
        }
      )
      if (res.ok) {
        localStorage.setItem(`storeiq_last_shopify_sync_${workspaceId}`, new Date().toISOString())
        setResyncMsg('success')
      } else {
        setResyncMsg('error')
      }
    } catch {
      setResyncMsg('error')
    }
    setResyncing(false)
    setTimeout(() => { setResyncMsg(null); }, 4000)
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

  const metaExpiresAt = metaConn?.token_expires_at ? new Date(metaConn.token_expires_at) : null
  const metaDaysLeft = metaExpiresAt
    ? Math.ceil((metaExpiresAt.getTime() - new Date().getTime()) / 86_400_000)
    : null

  const shopifyExpiresAt = connection?.token_expires_at ? new Date(connection.token_expires_at) : null
  const shopifyDaysLeft = shopifyExpiresAt
    ? Math.ceil((shopifyExpiresAt.getTime() - new Date().getTime()) / 86_400_000)
    : null

  const subscriptionStatus = workspace?.subscription_status ?? null
  const selectedPlan = PLANS.find(p => p.key === (workspace?.selected_plan ?? ''))
  const isTrial = subscriptionStatus === 'trial'
  const isActive = subscriptionStatus === 'active'
  const trialDaysLeft = isTrial ? trialDaysRemaining(workspace?.trial_started_at ?? null) : 0

  if (roleLoading) return <SkeletonPage />

  if (!hasPermission(role, 'settings:view')) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card padding="lg" className="max-w-sm w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-heading">Access Denied</h2>
          <p className="mt-1 text-sm text-text">You don&apos;t have permission to access Settings. Contact your workspace owner.</p>
        </Card>
      </div>
    )
  }

  const tabs: Array<{ key: SettingsTab; label: string; description: string }> = [
    { key: 'integrations', label: 'Integrations', description: 'Shopify & Meta Ads' },
    { key: 'team', label: 'Team', description: 'Members & invites' },
    { key: 'costs', label: 'Costs', description: 'COD fee & packaging' },
    ...(role === 'owner'
      ? [{ key: 'billing' as SettingsTab, label: 'Billing', description: 'Plan & payment' }]
      : []
    ),
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-heading">Settings</h1>
        <p className="mt-0.5 text-sm text-text">Manage your workspace, integrations, and billing.</p>
      </div>

      {/* Mobile: horizontal tab bar */}
      <div className="md:hidden flex rounded-lg border border-border overflow-hidden text-sm font-medium mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setTab(tab.key); }}
            className={`flex-1 px-3 py-2.5 transition-colors ${
              activeTab === tab.key
                ? 'bg-accent text-white'
                : 'bg-bg text-text hover:bg-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop: two separate cards */}
      <div className="hidden md:flex gap-6 items-stretch">

        {/* Sidebar card */}
        <aside className="w-52 shrink-0 rounded-xl border border-border bg-bg p-3">
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setTab(tab.key); }}
                className={`w-full text-left px-3 py-3 rounded-lg border transition-colors ${
                  activeTab === tab.key
                    ? 'border-accent bg-accent-bg text-accent'
                    : 'border-border bg-bg text-heading hover:bg-surface'
                }`}
              >
                <span className="block text-sm font-semibold">
                  {tab.label}
                </span>
                <span className={`block text-xs mt-0.5 ${activeTab === tab.key ? 'text-accent/70' : 'text-text'}`}>
                  {tab.description}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Content card */}
        <div className="flex-1 min-w-0 rounded-xl border border-border bg-bg">
          <div className="p-6 space-y-4">

          {/* ─── Integrations ──────────────────────────────────────────────────── */}
          {activeTab === 'integrations' && (
            <>
              {showSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.354-9.354a.5.5 0 00-.708-.707L7 8.793 5.354 7.146a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Shopify connected successfully! Your orders are syncing in the background.
                </div>
              )}

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
                    <div className="rounded-lg border border-border bg-bg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-text">Shop domain</span>
                        <span className="font-medium text-heading">{connection.shop_domain}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-text">Connected</span>
                        <span className="text-heading">{formatDate(connection.created_at)}</span>
                      </div>
                    </div>
                    {shopifyDaysLeft !== null && shopifyDaysLeft <= 14 && (
                      <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                        shopifyDaysLeft <= 0
                          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                      }`}>
                        <span className="mt-0.5 shrink-0">{shopifyDaysLeft <= 0 ? '🔴' : '⚠️'}</span>
                        <span>
                          {shopifyDaysLeft <= 0
                            ? 'Your Shopify token has expired. Reconnect to resume syncing.'
                            : shopifyDaysLeft === 1
                              ? 'Your Shopify token expires tomorrow. Reconnect soon to avoid data loss.'
                              : `Your Shopify token expires in ${String(shopifyDaysLeft)} days. Reconnect soon.`
                          }
                        </span>
                      </div>
                    )}
                    {resyncMsg === 'success' && (
                      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                        ✓ Sync started — orders updating in background
                      </div>
                    )}
                    {resyncMsg === 'error' && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                        Sync failed. Please try again.
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" loading={resyncing} onClick={() => void handleResync()}>
                        ↻ Re-sync Orders
                      </Button>
                      <Button variant="danger" size="sm" loading={disconnecting} onClick={() => void handleDisconnect()}>
                        Disconnect Shopify
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
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

              {showMetaSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.354-9.354a.5.5 0 00-.708-.707L7 8.793 5.354 7.146a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Meta Ads connected! Your campaign data is ready to view.
                </div>
              )}

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
                    <div className="rounded-lg border border-border bg-bg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-text">Ad Account ID</span>
                        <span className="font-medium text-heading">{metaConn.ads_account_id}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-text">Connected</span>
                        <span className="text-heading">{formatDate(metaConn.created_at)}</span>
                      </div>
                    </div>
                    {metaDaysLeft !== null && metaDaysLeft <= 14 && (
                      <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                        metaDaysLeft <= 0
                          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                      }`}>
                        <span className="mt-0.5 shrink-0">{metaDaysLeft <= 0 ? '🔴' : '⚠️'}</span>
                        <span>
                          {metaDaysLeft <= 0
                            ? 'Your Meta token has expired. Reconnect to resume syncing.'
                            : metaDaysLeft === 1
                              ? 'Your Meta token expires tomorrow. Reconnect soon to avoid data loss.'
                              : `Your Meta token expires in ${String(metaDaysLeft)} days. Reconnect soon.`
                          }
                        </span>
                      </div>
                    )}
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
            </>
          )}

          {/* ─── Team ──────────────────────────────────────────────────────────── */}
          {activeTab === 'team' && (
            <WorkspaceMembers workspaceId={workspaceId ?? ''} callerRole={role} />
          )}

          {/* ─── Costs ─────────────────────────────────────────────────────────── */}
          {activeTab === 'costs' && (
            <form onSubmit={(e) => { void handleSaveCosts(e) }} className="space-y-6">
              {costSaved && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                  <svg className="shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.354-9.354a.5.5 0 00-.708-.707L7 8.793 5.354 7.146a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Cost settings saved.
                </div>
              )}

              <Card padding="lg">
                <h2 className="text-sm font-semibold text-heading mb-1">COD Fee per Order</h2>
                <p className="text-xs text-text mb-4">Applied to every order when calculating net profit. Leave blank to use 0.</p>
                <div className="space-y-3">
                  <Input
                    label="Flat rate (all cities)"
                    type="number"
                    min={0}
                    placeholder="PKR 0"
                    value={costForm.cod_fee_flat}
                    onChange={e => { setCostForm(f => ({ ...f, cod_fee_flat: e.target.value })) }}
                    hint="Used when no per-city rate is set"
                    disabled={!hasPermission(role, 'settings:view') || role === 'supervisor'}
                  />
                  <p className="text-xs font-medium text-text pt-1">Per-city overrides (optional)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Karachi"
                      type="number"
                      min={0}
                      placeholder="PKR 0"
                      value={costForm.cod_fee_karachi}
                      onChange={e => { setCostForm(f => ({ ...f, cod_fee_karachi: e.target.value })) }}
                      disabled={!hasPermission(role, 'settings:view') || role === 'supervisor'}
                    />
                    <Input
                      label="Lahore"
                      type="number"
                      min={0}
                      placeholder="PKR 0"
                      value={costForm.cod_fee_lahore}
                      onChange={e => { setCostForm(f => ({ ...f, cod_fee_lahore: e.target.value })) }}
                      disabled={!hasPermission(role, 'settings:view') || role === 'supervisor'}
                    />
                    <Input
                      label="Islamabad"
                      type="number"
                      min={0}
                      placeholder="PKR 0"
                      value={costForm.cod_fee_islamabad}
                      onChange={e => { setCostForm(f => ({ ...f, cod_fee_islamabad: e.target.value })) }}
                      disabled={!hasPermission(role, 'settings:view') || role === 'supervisor'}
                    />
                    <Input
                      label="Other cities"
                      type="number"
                      min={0}
                      placeholder="PKR 0"
                      value={costForm.cod_fee_other}
                      onChange={e => { setCostForm(f => ({ ...f, cod_fee_other: e.target.value })) }}
                      hint="Fallback for unlisted cities"
                      disabled={!hasPermission(role, 'settings:view') || role === 'supervisor'}
                    />
                  </div>
                </div>
              </Card>

              <Card padding="lg">
                <h2 className="text-sm font-semibold text-heading mb-1">Additional Per-Order Costs</h2>
                <p className="text-xs text-text mb-4">Deducted from net profit on every order.</p>
                <Input
                  label="Packaging cost per order"
                  type="number"
                  min={0}
                  placeholder="PKR 0"
                  value={costForm.packaging_cost}
                  onChange={e => { setCostForm(f => ({ ...f, packaging_cost: e.target.value })) }}
                  disabled={!hasPermission(role, 'settings:view') || role === 'supervisor'}
                />
                <Input
                  label="Monthly overheads (salaries, rent, etc.)"
                  type="number"
                  min={0}
                  placeholder="PKR 0"
                  hint="Deducted as a flat monthly amount from net profit"
                  value={costForm.monthly_overheads}
                  onChange={e => { setCostForm(f => ({ ...f, monthly_overheads: e.target.value })) }}
                  disabled={!hasPermission(role, 'settings:view') || role === 'supervisor'}
                />
              </Card>

              {role !== 'supervisor' && (
                <div className="flex justify-end">
                  <Button type="submit" variant="primary" size="sm" loading={costSaving}>
                    Save Changes
                  </Button>
                </div>
              )}
            </form>
          )}

          {/* ─── Billing (owner only) ──────────────────────────────────────────── */}
          {activeTab === 'billing' && role === 'owner' && (
            <div className="space-y-4">

              <Card padding="lg">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-heading mb-1">Current Plan</h2>
                    {selectedPlan ? (
                      <>
                        <p className="text-2xl font-bold text-heading">{selectedPlan.label}</p>
                        <p className="mt-0.5 text-sm text-text">{selectedPlan.description}</p>
                        <p className="mt-1 text-sm font-semibold text-accent">{selectedPlan.price}</p>
                      </>
                    ) : (
                      <p className="text-sm text-text">No plan selected. Contact support to set up your plan.</p>
                    )}
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {subscriptionStatus === 'active' && <Badge variant="success">Active</Badge>}
                    {subscriptionStatus === 'trial' && <Badge variant="warning">Trial</Badge>}
                    {subscriptionStatus === 'inactive' && <Badge variant="error">Inactive</Badge>}
                    {subscriptionStatus === null && <Badge variant="neutral">—</Badge>}
                  </div>
                </div>
              </Card>

              {isTrial && (
                <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
                  trialDaysLeft <= 0
                    ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                    : trialDaysLeft <= 3
                      ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                      : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                }`}>
                  <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>
                    {trialDaysLeft <= 0
                      ? 'Your trial has expired. Activate your account to continue.'
                      : trialDaysLeft === 1
                        ? '1 day left in your trial. Activate today to keep access.'
                        : `${String(trialDaysLeft)} days left in your trial.`}
                  </span>
                </div>
              )}

              {isActive && (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                  <svg className="shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.354-9.354a.5.5 0 00-.708-.707L7 8.793 5.354 7.146a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Your account is active. No payment action needed.
                </div>
              )}

              {!isActive && (
                <Card padding="lg">
                  <h2 className="text-sm font-semibold text-heading mb-1">How to Activate</h2>
                  <p className="text-sm text-text mb-4">
                    Transfer the plan amount to the bank account below, then send your payment receipt via WhatsApp to activate.
                  </p>
                  <div className="rounded-lg border border-border bg-bg p-3 space-y-2.5 text-sm mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-text">Bank</span>
                      <span className="font-medium text-heading">{BANK_DETAILS.bankName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text">Account title</span>
                      <span className="font-medium text-heading">{BANK_DETAILS.accountTitle}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text">Account number</span>
                      <span className="font-medium text-heading">{BANK_DETAILS.accountNumber}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-text shrink-0">IBAN</span>
                      <span className="font-medium text-heading font-mono text-xs tracking-wide">{BANK_DETAILS.iban}</span>
                    </div>
                  </div>
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi, I have transferred the payment for StoreIQ. Please find my receipt attached.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Send WhatsApp Receipt
                  </a>
                </Card>
              )}
            </div>
          )}

          </div>
        </div>
      </div>
    </div>
  )
}

