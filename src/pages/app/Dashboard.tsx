import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { OrdersTable } from '@/components/features/OrdersTable'
import { ProfitSummaryCard } from '@/components/features/ProfitSummaryCard'
import { RevenueChart } from '@/components/features/RevenueChart'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAdsData } from '@/hooks/useAdsData'
import { useInfluencerSpend } from '@/hooks/useInfluencerSpend'
import { useMetaConnection } from '@/hooks/useMetaConnection'
import { useOrders } from '@/hooks/useOrders'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWorkspaceCostConfig } from '@/hooks/useWorkspaceCostConfig'
import { ROUTES } from '@/lib/constants'
import { computeStructuredCosts } from '@/lib/costCalculator'
import { formatCurrency, formatPercentage } from '@/lib/formatters'

const MILESTONES = [50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000]

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diffMins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diffMins < 2) return 'just now'
  if (diffMins < 60) return `${String(diffMins)} minutes ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${String(diffHours)} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${String(diffDays)} day${diffDays === 1 ? '' : 's'} ago`
}

export function Dashboard(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { connection, loading: connLoading } = useShopifyConnection(workspaceId ?? '')
  const { connection: metaConn, loading: metaConnLoading } = useMetaConnection(workspaceId ?? '')
  const { orders, summary, stats, loading: ordersLoading } = useOrders(workspaceId ?? '', undefined, 30)
  const { totals: adsTotals, loading: adsLoading } = useAdsData(workspaceId ?? '')
  const { totalCommittedSpend: influencerSpend, loading: influencerLoading } = useInfluencerSpend(workspaceId ?? '')
  const { config: costConfig } = useWorkspaceCostConfig(workspaceId ?? '')

  const isMetaConnected = !metaConnLoading && metaConn !== null
  const adSpend = isMetaConnected ? adsTotals.totalSpend : 0
  const hasInfluencerSpend = influencerSpend > 0
  // Dashboard has no cityRows — use flat-rate COD fee only
  const structuredCosts = computeStructuredCosts(costConfig, stats?.orderCount ?? 0, [])
  const hasStructuredCosts = structuredCosts > 0
  const trueNetProfit = summary.netProfit - adSpend - influencerSpend - structuredCosts

  const isLoading = connLoading || ordersLoading || metaConnLoading || adsLoading || influencerLoading
  const isConnected = !connLoading && connection !== null

  const onboardingKey = `storeiq_onboarding_dismissed_${workspaceId ?? ''}`
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem(onboardingKey) === '1'
  )

  function dismissOnboarding(): void {
    localStorage.setItem(onboardingKey, '1')
    setOnboardingDismissed(true)
  }

  const lastShopifySync = localStorage.getItem(`storeiq_last_shopify_sync_${workspaceId ?? ''}`)
  const lastMetaSync = localStorage.getItem(`storeiq_last_meta_sync_${workspaceId ?? ''}`)

  // Key ratios
  const refundRate = summary.totalRevenue > 0 ? (summary.totalRefunds / summary.totalRevenue) * 100 : 0
  const profitMargin = summary.totalRevenue > 0 ? (trueNetProfit / summary.totalRevenue) * 100 : 0
  const marketingSpend = adSpend + influencerSpend
  const adSpendRatio = (isMetaConnected || hasInfluencerSpend) && summary.totalRevenue > 0
    ? (marketingSpend / summary.totalRevenue) * 100
    : null

  // QW #1 — trend arrows (this week vs last week)
  const revenueTrend = stats && stats.lastWeekRevenue > 0
    ? ((stats.thisWeekRevenue - stats.lastWeekRevenue) / stats.lastWeekRevenue) * 100
    : undefined
  const netProfitLastWeek = stats ? stats.lastWeekRevenue - stats.lastWeekRefunds : 0
  const netProfitThisWeek = stats ? stats.thisWeekRevenue - stats.thisWeekRefunds : 0
  const profitTrend = stats && netProfitLastWeek > 0
    ? ((netProfitThisWeek - netProfitLastWeek) / netProfitLastWeek) * 100
    : undefined

  // Task 7 — AOV + month-over-month
  const momPct = stats && stats.lastMonthRevenue > 0
    ? ((stats.thisMonthRevenue - stats.lastMonthRevenue) / stats.lastMonthRevenue) * 100
    : null

  // QW #2 — milestone
  const nextTarget = MILESTONES.find(m => m > summary.totalRevenue) ?? 5_000_000
  const milestonePct = Math.min((summary.totalRevenue / nextTarget) * 100, 100)

  // ME #1 — refund rate trend (week over week)
  const thisWeekRate = stats && stats.thisWeekRevenue > 0
    ? (stats.thisWeekRefunds / stats.thisWeekRevenue) * 100 : 0
  const lastWeekRate = stats && stats.lastWeekRevenue > 0
    ? (stats.lastWeekRefunds / stats.lastWeekRevenue) * 100 : 0
  const refundTrend = stats && lastWeekRate > 0
    ? ((thisWeekRate - lastWeekRate) / lastWeekRate) * 100
    : null

  // ME #3 — COD vs Prepaid
  const paymentTotal = stats ? stats.codRevenue + stats.prepaidRevenue : 0
  const codPct = paymentTotal > 0 && stats ? (stats.codRevenue / paymentTotal) * 100 : 0
  const prepaidPct = 100 - codPct

  // Order status counts
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    const s = o.status
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  const statusBadgeVariant = (status: string): 'success' | 'warning' | 'error' | 'neutral' => {
    if (status === 'paid' || status === 'fulfilled') return 'success'
    if (status === 'pending') return 'warning'
    if (status === 'refunded' || status === 'cancelled') return 'error'
    return 'neutral'
  }

  if (!connLoading && !isConnected) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
          title="Connect your Shopify store"
          description="To see profit data, connect your Shopify store first."
          action={{
            label: 'Connect Shopify',
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
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-heading">Dashboard</h1>
        <p className="mt-0.5 text-sm text-text">Your profit overview at a glance.</p>
      </div>

      {/* Onboarding checklist — shown to new users before Shopify is connected */}
      {!isLoading && !isConnected && !onboardingDismissed && (
        <Card padding="lg">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-heading">Get started with StoreIQ</h2>
              <p className="mt-0.5 text-xs text-text">3 steps to see your real profit.</p>
            </div>
            <button
              onClick={dismissOnboarding}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text hover:bg-surface hover:text-heading"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          <div className="space-y-1">
            {/* Step 1 — Connect Shopify */}
            <Link
              to={workspaceId ? ROUTES.APP.SETTINGS(workspaceId) : '#'}
              className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface transition-colors"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                1
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-heading">Connect your Shopify store</p>
                <p className="text-xs text-text">Sync orders, revenue, and refunds automatically.</p>
              </div>
              <span className="text-text shrink-0">→</span>
            </Link>

            {/* Step 2 — Connect Meta */}
            <Link
              to={workspaceId ? ROUTES.APP.SETTINGS(workspaceId) : '#'}
              className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface transition-colors opacity-60"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                2
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-heading">Connect Meta Ads</p>
                <p className="text-xs text-text">Track ad spend and ROAS alongside your revenue.</p>
              </div>
              <span className="text-text shrink-0">→</span>
            </Link>

            {/* Step 3 — See profit */}
            <div className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 opacity-40">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-text">
                3
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-heading">See your real profit</p>
                <p className="text-xs text-text">Revenue − Refunds − Ad Spend. Your true bottom line.</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Connection health strip */}
      {!isLoading && (isConnected || isMetaConnected) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {isConnected && (
            <span className="flex items-center gap-1.5 text-xs text-text">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span className="font-medium text-heading">Shopify</span>
              <span>·</span>
              <span>{connection.shop_domain}</span>
              <span>·</span>
              <span>synced {formatSyncTime(lastShopifySync)}</span>
            </span>
          )}
          {isMetaConnected && (
            <span className="flex items-center gap-1.5 text-xs text-text">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span className="font-medium text-heading">Meta Ads</span>
              <span>·</span>
              <span>{metaConn.ads_account_id}</span>
              <span>·</span>
              <span>synced {formatSyncTime(lastMetaSync)}</span>
            </span>
          )}
        </div>
      )}

      {/* Summary cards — QW #1: trend arrows wired */}
      {(() => {
        const extraCols = (isMetaConnected || hasInfluencerSpend ? 1 : 0) + (hasStructuredCosts ? 1 : 0)
        const cols = 3 + extraCols
        return (
          <div className={`grid grid-cols-1 gap-4 ${cols === 5 ? 'sm:grid-cols-5' : cols === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <ProfitSummaryCard
              label="Total Revenue"
              value={formatCurrency(summary.totalRevenue)}
              trend={revenueTrend}
              loading={isLoading}
            />
            <ProfitSummaryCard
              label="Total Refunds"
              value={formatCurrency(summary.totalRefunds)}
              loading={isLoading}
            />
            {(isMetaConnected || hasInfluencerSpend) && (
              <ProfitSummaryCard
                label="Marketing Spend"
                value={formatCurrency(marketingSpend)}
                loading={isLoading}
              />
            )}
            {hasStructuredCosts && (
              <ProfitSummaryCard
                label="Cost Structure"
                value={formatCurrency(structuredCosts)}
                loading={isLoading}
              />
            )}
            <ProfitSummaryCard
              label={
                (isMetaConnected || hasInfluencerSpend || hasStructuredCosts)
                  ? 'Net Profit (after costs)'
                  : 'Net Profit'
              }
              value={formatCurrency(trueNetProfit)}
              trend={profitTrend}
              loading={isLoading}
              highlight
              sparklineData={stats?.netProfitByDay}
            />
          </div>
        )
      })()}

      {/* QW #2 — Revenue Milestone */}
      {!isLoading && summary.totalRevenue > 0 && (
        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase tracking-wide text-text">Next Milestone</p>
            <span className="text-xs font-semibold text-accent">{milestonePct.toFixed(0)}% there</span>
          </div>
          <p className="text-lg font-bold text-heading mb-3">{formatCurrency(nextTarget)}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${milestonePct.toFixed(2)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-text">
            {formatCurrency(summary.totalRevenue)} of {formatCurrency(nextTarget)} revenue
          </p>
        </Card>
      )}

      {/* Key Ratios — ME #1 refund trend, QW #3 best day, QW #4 orders/day */}
      {!isLoading && summary.totalRevenue > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
            <span className="text-text">Refund Rate</span>
            <span className="font-semibold text-heading">{formatPercentage(refundRate)}</span>
            {refundTrend !== null && (
              <span className={`font-semibold ${refundTrend > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {refundTrend > 0 ? '↑' : '↓'} {Math.abs(refundTrend).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
            <span className="text-text">Profit Margin</span>
            <span className={`font-semibold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(profitMargin)}
            </span>
          </div>
          {adSpendRatio !== null && (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
              <span className="text-text">Marketing Spend Ratio</span>
              <span className="font-semibold text-heading">{formatPercentage(adSpendRatio)}</span>
            </div>
          )}
          {stats && stats.bestDayRevenue > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
              <span className="text-text">Best Day</span>
              <span className="font-semibold text-heading">{stats.bestDayOfWeek}</span>
            </div>
          )}
          {stats && (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
              <span className="text-text">Avg</span>
              <span className="font-semibold text-heading">{stats.ordersPerDay.toFixed(1)} orders/day</span>
            </div>
          )}
          {stats && stats.rtoCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs dark:border-red-800 dark:bg-red-900/20">
              <span className="text-red-700 dark:text-red-300">RTO</span>
              <span className="font-semibold text-red-800 dark:text-red-200">{String(stats.rtoCount)} orders</span>
              <span className="text-red-600 dark:text-red-400">·</span>
              <span className="font-semibold text-red-800 dark:text-red-200">{formatCurrency(stats.rtoRevenue)} exposure</span>
            </div>
          )}
          {stats && stats.orderCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
              <span className="text-text">Avg Order Value</span>
              <span className="font-semibold text-heading">{formatCurrency(summary.totalRevenue / stats.orderCount)}</span>
            </div>
          )}
          {momPct !== null && (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
              <span className="text-text">vs Last Month</span>
              <span className={`font-semibold ${momPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {momPct >= 0 ? '↑' : '↓'} {Math.abs(momPct).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* ME #3 — COD vs Prepaid Split */}
      {!isLoading && stats && (stats.codCount > 0 || stats.prepaidCount > 0) && (
        <Card padding="md">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text">Payment Split</p>
          <div className="mb-3 grid grid-cols-2 gap-4">
            <div>
              <p className="mb-0.5 text-xs text-text">COD (Pending)</p>
              <p className="text-base font-bold text-heading">{formatCurrency(stats.codRevenue)}</p>
              <p className="text-xs text-text">{String(stats.codCount)} orders · {codPct.toFixed(0)}%</p>
            </div>
            <div>
              <p className="mb-0.5 text-xs text-text">Prepaid</p>
              <p className="text-base font-bold text-heading">{formatCurrency(stats.prepaidRevenue)}</p>
              <p className="text-xs text-text">{String(stats.prepaidCount)} orders · {prepaidPct.toFixed(0)}%</p>
            </div>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full">
            <div className="bg-amber-400 transition-all duration-500" style={{ width: `${codPct.toFixed(2)}%` }} />
            <div className="flex-1 bg-green-500" />
          </div>
          <div className="mt-1.5 flex gap-4 text-xs text-text">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> COD
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" /> Prepaid
            </span>
          </div>
        </Card>
      )}

      {/* Revenue Chart */}
      <RevenueChart orders={orders} loading={isLoading} />

      {/* Recent orders */}
      <div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-heading">Recent Orders</h2>
            {!isLoading && Object.entries(statusCounts).map(([status, count]) => (
              <Badge key={status} variant={statusBadgeVariant(status)}>
                <span className="capitalize">{status}</span> ({count})
              </Badge>
            ))}
          </div>
          {workspaceId && (
            <Link
              to={ROUTES.APP.PROFIT(workspaceId)}
              className="text-xs text-accent hover:underline"
            >
              View all →
            </Link>
          )}
        </div>
        <OrdersTable orders={orders} loading={isLoading} />
      </div>
    </div>
  )
}
