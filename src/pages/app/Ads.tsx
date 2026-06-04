import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { ProfitSummaryCard } from '@/components/features/ProfitSummaryCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { type AdsPerformanceFilter, useAdsData } from '@/hooks/useAdsData'
import { useMetaConnection } from '@/hooks/useMetaConnection'
import { PAGINATION, ROUTES, USD_TO_PKR_RATE } from '@/lib/constants'
import { exportCampaignsCSV } from '@/lib/csv'
import { formatCurrency } from '@/lib/formatters'
import { supabase } from '@/lib/supabase'
import type { DateRange } from '@/types/app'

const DATE_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
] as const

function getDateRange(days: number): DateRange {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  return {
    from: from.toISOString().substring(0, 10),
    to: to.toISOString().substring(0, 10),
  }
}

export function Ads(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { connection: metaConn, loading: connLoading } = useMetaConnection(workspaceId ?? '')

  const [selectedDays, setSelectedDays] = useState<number>(30)
  const [showPKR, setShowPKR] = useState(false)
  const [perfFilter, setPerfFilter] = useState<AdsPerformanceFilter>('all')
  const [page, setPage] = useState(0)
  const dateRange = useMemo(() => getDateRange(selectedDays), [selectedDays])

  const { campaigns, totals, totalCount, loading: adsLoading } = useAdsData(
    workspaceId ?? '',
    dateRange,
    page,
    perfFilter,
  )
  const syncedRef = useRef(false)

  // Trigger a background sync when Meta is connected (once per session)
  useEffect(() => {
    if (!metaConn || syncedRef.current || !workspaceId) return
    syncedRef.current = true

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(
        `${String(import.meta.env.VITE_SUPABASE_URL)}/functions/v1/meta-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ workspaceId }),
        }
      )
    })()
  }, [metaConn, workspaceId])

  const loading = connLoading || adsLoading

  const totalPages = Math.ceil(totalCount / PAGINATION.DEFAULT_PAGE_SIZE)

  // Reset to page 0 when filter or date window changes
  const handleFilterChange = (f: AdsPerformanceFilter): void => {
    setPerfFilter(f)
    setPage(0)
  }
  const handleDaysChange = (days: number): void => {
    setSelectedDays(days)
    setPage(0)
  }

  // Losing campaigns in the current page (top by spend — most impactful ones)
  const losingCampaigns = campaigns.filter((c) => c.roas < 1.0 && c.spend > 0)

  const statusVariant = (s: string): 'success' | 'neutral' | 'error' => {
    if (s === 'ACTIVE') return 'success'
    if (s === 'ARCHIVED' || s === 'DELETED') return 'error'
    return 'neutral'
  }

  const statusLabel = (s: string): string => {
    if (s === 'ACTIVE') return 'Active'
    if (s === 'PAUSED') return 'Paused'
    if (s === 'ARCHIVED') return 'Archived'
    if (s === 'DELETED') return 'Deleted'
    return 'Unknown'
  }

  // spend is stored in PKR (Meta billing currency for Pakistani accounts)
  // PKR mode: show as-is; USD mode: divide back to USD
  const fmtSpend = (amount: number): string =>
    showPKR
      ? formatCurrency(amount)
      : `$${(amount / USD_TO_PKR_RATE).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (!connLoading && !metaConn) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <EmptyState
          title="Connect Meta Ads"
          description="Connect your Meta Ads account in Settings to see campaign performance here."
          action={{
            label: 'Go to Settings',
            onClick: () => {
              if (workspaceId) window.location.href = ROUTES.APP.SETTINGS(workspaceId)
            },
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-heading">Meta Ads</h1>
          <p className="mt-0.5 text-sm text-text">Ad spend, ROAS, and campaign performance.</p>
        </div>

        {/* Controls: date filter + PKR toggle + perf filter + export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date presets */}
          <div className="flex overflow-hidden rounded-lg border border-border">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.days}
                onClick={() => { handleDaysChange(preset.days) }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
                  selectedDays === preset.days
                    ? 'bg-accent text-white'
                    : 'bg-bg text-text hover:bg-surface'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* PKR / USD toggle */}
          <div className="flex overflow-hidden rounded-lg border border-border text-xs font-medium">
            <button
              onClick={() => { setShowPKR(false) }}
              className={`px-3 py-1.5 transition-colors min-h-[36px] ${
                !showPKR ? 'bg-accent text-white' : 'bg-bg text-text hover:bg-surface'
              }`}
            >
              USD
            </button>
            <button
              onClick={() => { setShowPKR(true) }}
              className={`px-3 py-1.5 transition-colors min-h-[36px] ${
                showPKR ? 'bg-accent text-white' : 'bg-bg text-text hover:bg-surface'
              }`}
            >
              PKR
            </button>
          </div>

          {/* Performance filter */}
          <div className="flex overflow-hidden rounded-lg border border-border text-xs font-medium">
            {(['all', 'good', 'losing'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { handleFilterChange(f) }}
                className={`px-3 py-1.5 capitalize transition-colors min-h-[36px] ${
                  perfFilter === f ? 'bg-accent text-white' : 'bg-bg text-text hover:bg-surface'
                }`}
              >
                {f === 'all' ? 'All' : f === 'good' ? 'Good' : 'Losing'}
              </button>
            ))}
          </div>

          {/* Export CSV (current page) */}
          {!loading && campaigns.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { exportCampaignsCSV(campaigns) }}
            >
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Low ROAS alert banner */}
      {!loading && losingCampaigns.length > 0 && perfFilter !== 'good' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="mt-0.5 text-base text-amber-500">⚠</span>
          <p className="text-sm text-amber-800">
            <span className="font-semibold">
              {losingCampaigns.length} {losingCampaigns.length === 1 ? 'campaign' : 'campaigns'}
            </span>{' '}
            {losingCampaigns.length === 1 ? 'has' : 'have'} ROAS below 1.0x — you{' '}
            are losing money on {losingCampaigns.length === 1 ? 'it' : 'these'}.
          </p>
        </div>
      )}

      {/* Totals — always reflect all campaigns, not the current filter */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ProfitSummaryCard
          label={`Total Spend (${showPKR ? 'PKR' : 'USD'})`}
          value={fmtSpend(totals.totalSpend)}
          loading={loading}
        />
        <ProfitSummaryCard label="Avg ROAS" value={`${totals.avgRoas.toFixed(2)}x`} loading={loading} />
        <ProfitSummaryCard label="Avg CTR" value={`${(totals.avgCtr * 100).toFixed(2)}%`} loading={loading} />
      </div>

      {/* Campaigns table */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-heading">
          {perfFilter === 'all' ? 'Campaigns by Spend' : perfFilter === 'good' ? 'Good Campaigns' : 'Losing Campaigns'}
          <span className="ml-2 text-xs font-normal text-text">(synced data · last 30 days max)</span>
          {!loading && totalCount > 0 && (
            <span className="ml-2 text-xs font-normal text-text">· {totalCount} total</span>
          )}
        </h2>

        {loading ? (
          <SkeletonTable rows={5} />
        ) : campaigns.length === 0 && perfFilter === 'all' ? (
          <Card padding="lg">
            <EmptyState
              title="No Meta Ads data yet"
              description="Connect your Meta Ads account in Settings to see campaign performance here."
              action={{
                label: 'Connect Meta Ads',
                onClick: () => {
                  if (workspaceId) window.location.href = ROUTES.APP.SETTINGS(workspaceId)
                },
              }}
            />
          </Card>
        ) : campaigns.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              title={`No ${perfFilter === 'good' ? 'Good' : 'Losing'} campaigns`}
              description={`None of your campaigns fall into the "${perfFilter === 'good' ? 'Good' : 'Losing'}" category in this period.`}
            />
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Campaign</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text">
                      Spend ({showPKR ? 'PKR' : 'USD'})
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text">ROAS</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text">CTR</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {campaigns.map((c) => (
                    <tr key={c.id} className="bg-bg transition-colors hover:bg-surface/50">
                      <td className="max-w-xs truncate px-4 py-3 font-medium text-heading">{c.campaign_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(c.status)}>{statusLabel(c.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-heading">{fmtSpend(c.spend)}</td>
                      <td className="px-4 py-3 text-right text-heading">{c.roas.toFixed(2)}x</td>
                      <td className="px-4 py-3 text-right text-heading">{(c.ctr * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3">
                        <Badge variant={c.roas >= 2 ? 'success' : c.roas >= 1 ? 'warning' : 'error'}>
                          {c.roas >= 2 ? 'Good' : c.roas >= 1 ? 'Break-even' : 'Losing'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {campaigns.map((c) => (
                <Card key={c.id} padding="md">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight text-heading">{c.campaign_name}</p>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={statusVariant(c.status)}>{statusLabel(c.status)}</Badge>
                      <Badge variant={c.roas >= 2 ? 'success' : c.roas >= 1 ? 'warning' : 'error'}>
                        {c.roas >= 2 ? 'Good' : c.roas >= 1 ? 'Break-even' : 'Losing'}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-text">{showPKR ? 'Spend (PKR)' : 'Spend (USD)'}</p>
                      <p className="text-sm font-semibold text-heading">{fmtSpend(c.spend)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text">ROAS</p>
                      <p className="text-sm font-semibold text-heading">{c.roas.toFixed(2)}x</p>
                    </div>
                    <div>
                      <p className="text-xs text-text">CTR</p>
                      <p className="text-sm font-semibold text-heading">{(c.ctr * 100).toFixed(2)}%</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setPage((p) => p - 1) }}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <span className="text-xs text-text">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setPage((p) => p + 1) }}
                  disabled={page >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
