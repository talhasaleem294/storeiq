import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { CashFlowCalendar } from '@/components/features/CashFlowCalendar'
import { OrdersTable } from '@/components/features/OrdersTable'
import { ProfitSummaryCard } from '@/components/features/ProfitSummaryCard'
import { RevenueChart } from '@/components/features/RevenueChart'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { InsightBanner } from '@/components/ui/InsightBanner'
import { useAdsData } from '@/hooks/useAdsData'
import { useCodRemittanceLog } from '@/hooks/useCodRemittanceLog'
import { useInfluencerSpend } from '@/hooks/useInfluencerSpend'
import { useMetaConnection } from '@/hooks/useMetaConnection'
import { useOrders } from '@/hooks/useOrders'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWorkspaceCostConfig } from '@/hooks/useWorkspaceCostConfig'
import { ROUTES } from '@/lib/constants'
import { computeStructuredCosts } from '@/lib/costCalculator'
import { computeRtoRiskScore } from '@/lib/rtoPredictor'
import { formatCurrency, formatPercentage } from '@/lib/formatters'
import type { DateRange } from '@/types/app'

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

  const dashboardDateRange = useMemo<DateRange>(() => {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 30)
    return {
      from: from.toISOString().substring(0, 10),
      to: to.toISOString().substring(0, 10),
    }
  }, [])

  const { orders, summary, stats, loading: ordersLoading } = useOrders(workspaceId ?? '', dashboardDateRange, 30)
  const { totals: adsTotals, insights: adsInsights, loading: adsLoading } = useAdsData(workspaceId ?? '')
  const { totalCommittedSpend: influencerSpend, loading: influencerLoading } = useInfluencerSpend(workspaceId ?? '')
  const { config: costConfig } = useWorkspaceCostConfig(workspaceId ?? '')
  const codLog = useCodRemittanceLog(workspaceId ?? '', dashboardDateRange)

  const [revenueMode, setRevenueMode] = useState<'placed' | 'collected'>('placed')
  const [showRemittanceModal, setShowRemittanceModal] = useState(false)
  const [remittanceAmount, setRemittanceAmount] = useState('')
  const [remittanceDate, setRemittanceDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [remittanceNotes, setRemittanceNotes] = useState('')

  const isMetaConnected = !metaConnLoading && metaConn !== null
  const adSpend = isMetaConnected ? adsTotals.totalSpend : 0
  const hasInfluencerSpend = influencerSpend > 0
  // Dashboard has no cityRows — use flat-rate COD fee only
  const structuredCosts = computeStructuredCosts(costConfig, stats?.orderCount ?? 0, [])
  const hasStructuredCosts = structuredCosts > 0
  const monthlyOverheads = costConfig.monthly_overheads
  const hasOverheads = monthlyOverheads > 0
  const trueNetProfit = summary.netProfit - adSpend - influencerSpend - structuredCosts - monthlyOverheads

  // COD-Aware toggle
  const codPendingAmount = stats ? Math.max(0, stats.codRevenue - codLog.totalReceived) : 0
  const collectedRevenue = stats ? stats.prepaidRevenue + codLog.totalReceived : summary.totalRevenue
  const activeRevenue = revenueMode === 'collected' ? collectedRevenue : summary.totalRevenue
  const collectedNetProfit = collectedRevenue - summary.totalRefunds - adSpend - influencerSpend - structuredCosts - monthlyOverheads
  const activeNetProfit = revenueMode === 'collected' ? collectedNetProfit : trueNetProfit

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

  async function handleRecordRemittance(): Promise<void> {
    const amount = parseFloat(remittanceAmount)
    if (!amount || amount <= 0) return
    await codLog.insert(amount, remittanceDate, remittanceNotes.trim() || undefined)
    if (!codLog.insertError) {
      setShowRemittanceModal(false)
      setRemittanceAmount('')
      setRemittanceNotes('')
      setRemittanceDate(new Date().toISOString().slice(0, 10))
    }
  }

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

      {/* InsightBanner — best sales day tip */}
      {!isLoading && stats?.bestDayOfWeek && stats.bestDayRevenue > 0 && (
        <InsightBanner
          dismissKey={`storeiq_insight_dismissed_${workspaceId ?? ''}_dashboard`}
          variant="info"
          message={`Your best sales day is ${stats.bestDayOfWeek} — consider increasing ad budget the day before`}
        />
      )}

      {/* COD-Aware toggle */}
      {stats && stats.codCount > 0 && (
        <div className="flex items-center gap-1 self-start rounded-lg border border-border bg-surface p-1">
          <button
            onClick={() => { setRevenueMode('placed') }}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${revenueMode === 'placed' ? 'bg-bg text-heading shadow-sm' : 'text-text hover:text-heading'}`}
          >
            Placed
          </button>
          <button
            onClick={() => { setRevenueMode('collected') }}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${revenueMode === 'collected' ? 'bg-bg text-heading shadow-sm' : 'text-text hover:text-heading'}`}
          >
            Collected
          </button>
        </div>
      )}

      {/* Summary cards — QW #1: trend arrows wired */}
      {(() => {
        const extraCols = (isMetaConnected || hasInfluencerSpend ? 1 : 0) + (hasStructuredCosts ? 1 : 0) + (hasOverheads ? 1 : 0)
        const cols = Math.min(3 + extraCols, 5)
        return (
          <div className={`grid grid-cols-1 gap-4 ${cols === 5 ? 'sm:grid-cols-5' : cols === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <ProfitSummaryCard
              label={revenueMode === 'collected' ? 'Collected Revenue' : 'Total Revenue'}
              value={formatCurrency(activeRevenue)}
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
            {hasOverheads && (
              <ProfitSummaryCard
                label="Overhead Cost"
                value={formatCurrency(monthlyOverheads)}
                loading={isLoading}
              />
            )}
            <ProfitSummaryCard
              label={
                (isMetaConnected || hasInfluencerSpend || hasStructuredCosts || hasOverheads)
                  ? 'Net Profit (after costs)'
                  : 'Net Profit'
              }
              value={formatCurrency(activeNetProfit)}
              trend={profitTrend}
              loading={isLoading}
              highlight
              sparklineData={stats?.netProfitByDay}
            />
          </div>
        )
      })()}

      {/* COD Pending chip */}
      {revenueMode === 'collected' && codPendingAmount > 0 && (
        <div className="flex items-center gap-1.5 self-start rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <span>COD Pending: {formatCurrency(codPendingAmount)}</span>
        </div>
      )}

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
          {/* High-risk orders chip */}
          {(() => {
            const emptyMap = new Map<string, number>()
            const emptySet = new Set<string>()
            const today = new Date().toISOString().slice(0, 10)
            const highRisk = orders.filter(o => o.created_at.slice(0, 10) === today && computeRtoRiskScore(o, emptyMap, emptySet) === 'high')
            if (highRisk.length === 0) return null
            return (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs dark:border-amber-700 dark:bg-amber-900/20">
                <span className="text-amber-700 dark:text-amber-300">High-risk today</span>
                <span className="font-semibold text-amber-800 dark:text-amber-200">{String(highRisk.length)} orders</span>
              </div>
            )
          })()}
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

      {/* COD Cash Flow Tracker */}
      {!isLoading && stats && stats.codCount > 0 && (
        <Card padding="md">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-text">COD Cash Flow</p>
            <button
              onClick={() => { setShowRemittanceModal(true) }}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-heading transition-colors hover:bg-bg"
            >
              + Record remittance
            </button>
          </div>
          <div className="mb-3">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(Math.max(0, stats.codRevenue - codLog.totalReceived))}
            </p>
            <p className="mt-0.5 text-xs text-text">estimated in transit with couriers (last 30 days)</p>
          </div>
          {codLog.entries.length > 0 ? (
            <div className="divide-y divide-border">
              {codLog.entries.slice(0, 5).map(e => (
                <div key={e.id} className="flex items-center justify-between py-2 text-xs">
                  <span className="text-text">{e.received_at}</span>
                  {e.notes && <span className="max-w-[140px] truncate text-text">{e.notes}</span>}
                  <span className="font-semibold text-green-700 dark:text-green-400">+{formatCurrency(e.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text/60">No remittances recorded yet</p>
          )}
        </Card>
      )}

      {/* Cash Flow Calendar */}
      {!isLoading && isConnected && (
        <Card padding="md">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text">Cash Flow Calendar</p>
          <CashFlowCalendar workspaceId={workspaceId ?? ''} />
        </Card>
      )}

      {/* What Changed This Week */}
      {!isLoading && stats && (
        <Card padding="md">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text">This week vs last week</p>
          <div className="space-y-2">
            {/* Revenue */}
            {(() => {
              const delta = stats.thisWeekRevenue - stats.lastWeekRevenue
              const pct = stats.lastWeekRevenue > 0 ? (delta / stats.lastWeekRevenue) * 100 : null
              const up = delta >= 0
              return (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text">Revenue</span>
                  <span className={up ? 'font-semibold text-green-600 dark:text-green-400' : 'font-semibold text-red-500'}>
                    {up ? '▲' : '▼'} {formatCurrency(Math.abs(delta))}
                    {pct !== null && <span className="ml-1 text-xs opacity-70">({Math.abs(pct).toFixed(1)}%)</span>}
                  </span>
                </div>
              )
            })()}
            {/* RTO */}
            {(() => {
              const delta = stats.thisWeekRtoCount - stats.lastWeekRtoCount
              const up = delta <= 0
              return (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text">RTOs</span>
                  <span className={up ? 'font-semibold text-green-600 dark:text-green-400' : 'font-semibold text-red-500'}>
                    {delta === 0 ? '—' : delta > 0 ? `▲ ${delta} more` : `▼ ${Math.abs(delta)} fewer`}
                  </span>
                </div>
              )
            })()}
            {/* Ad Spend */}
            {adsInsights && (
              (() => {
                const delta = adsInsights.thisWeekSpend - adsInsights.lastWeekSpend
                const up = delta <= 0
                return (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text">Meta spend</span>
                    <span className={up ? 'font-semibold text-green-600 dark:text-green-400' : 'font-semibold text-amber-600 dark:text-amber-400'}>
                      {delta === 0 ? '—' : delta > 0 ? `▲ ${formatCurrency(delta)}` : `▼ ${formatCurrency(Math.abs(delta))}`}
                    </span>
                  </div>
                )
              })()
            )}
            {/* Best opportunity */}
            {adsInsights?.bestCampaign && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-text">Best campaign</span>
                <span className="max-w-[55%] truncate text-right font-semibold text-green-600 dark:text-green-400">
                  {adsInsights.bestCampaign.name} ({adsInsights.bestCampaign.roas.toFixed(2)}x)
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Record Remittance Modal */}
      {showRemittanceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { setShowRemittanceModal(false) }}
        >
          <Card
            padding="lg"
            className="w-full max-w-sm"
            onClick={e => { e.stopPropagation() }}
          >
            <h2 className="mb-4 text-sm font-semibold text-heading">Record COD Remittance</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-heading">Amount (PKR) *</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={remittanceAmount}
                  onChange={e => { setRemittanceAmount(e.target.value) }}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-heading">Date received *</label>
                <input
                  type="date"
                  value={remittanceDate}
                  onChange={e => { setRemittanceDate(e.target.value) }}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-heading">Notes (optional)</label>
                <textarea
                  value={remittanceNotes}
                  onChange={e => { setRemittanceNotes(e.target.value) }}
                  placeholder="e.g. Leopards batch #42"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              {codLog.insertError && (
                <p className="text-xs text-red-600">{codLog.insertError}</p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setShowRemittanceModal(false) }}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-heading transition-colors hover:bg-bg"
              >
                Cancel
              </button>
              <button
                onClick={() => { void handleRecordRemittance() }}
                disabled={codLog.inserting || !remittanceAmount}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {codLog.inserting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </Card>
        </div>
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
