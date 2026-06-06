import { Link, useParams } from 'react-router-dom'

import { OrdersTable } from '@/components/features/OrdersTable'
import { ProfitSummaryCard } from '@/components/features/ProfitSummaryCard'
import { RevenueChart } from '@/components/features/RevenueChart'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAdsData } from '@/hooks/useAdsData'
import { useMetaConnection } from '@/hooks/useMetaConnection'
import { useOrders } from '@/hooks/useOrders'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { ROUTES } from '@/lib/constants'
import { formatCurrency, formatPercentage } from '@/lib/formatters'

const MILESTONES = [50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000]

export function Dashboard(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { connection, loading: connLoading } = useShopifyConnection(workspaceId ?? '')
  const { connection: metaConn, loading: metaConnLoading } = useMetaConnection(workspaceId ?? '')
  const { orders, summary, stats, loading: ordersLoading } = useOrders(workspaceId ?? '', undefined, 30)
  const { totals: adsTotals, loading: adsLoading } = useAdsData(workspaceId ?? '')

  const isMetaConnected = !metaConnLoading && metaConn !== null
  const adSpend = isMetaConnected ? adsTotals.totalSpend : 0
  const trueNetProfit = summary.netProfit - adSpend

  const isLoading = connLoading || ordersLoading || metaConnLoading || adsLoading
  const isConnected = !connLoading && connection !== null

  // Key ratios
  const refundRate = summary.totalRevenue > 0 ? (summary.totalRefunds / summary.totalRevenue) * 100 : 0
  const profitMargin = summary.totalRevenue > 0 ? (trueNetProfit / summary.totalRevenue) * 100 : 0
  const adSpendRatio = isMetaConnected && summary.totalRevenue > 0
    ? (adSpend / summary.totalRevenue) * 100
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

      {/* Summary cards — QW #1: trend arrows wired */}
      <div className={`grid grid-cols-1 gap-4 ${isMetaConnected ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
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
        {isMetaConnected && (
          <ProfitSummaryCard
            label="Ad Spend"
            value={formatCurrency(adSpend)}
            loading={isLoading}
          />
        )}
        <ProfitSummaryCard
          label={isMetaConnected ? 'Net Profit (after ads)' : 'Net Profit'}
          value={formatCurrency(trueNetProfit)}
          trend={profitTrend}
          loading={isLoading}
          highlight
        />
      </div>

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
              <span className="text-text">Ad Spend Ratio</span>
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
