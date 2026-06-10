import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { OrdersTable } from '@/components/features/OrdersTable'
import { ProfitSummaryCard } from '@/components/features/ProfitSummaryCard'
import { RevenueChart } from '@/components/features/RevenueChart'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAdsData } from '@/hooks/useAdsData'
import { useInfluencerSpend } from '@/hooks/useInfluencerSpend'
import { useMetaConnection } from '@/hooks/useMetaConnection'
import { useOrders } from '@/hooks/useOrders'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { ROUTES } from '@/lib/constants'
import { exportOrdersCSV } from '@/lib/csv'
import { formatCurrency, formatPercentage } from '@/lib/formatters'
import type { DateRange } from '@/types/app'

const DATE_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const

function getDateRange(days: number): DateRange {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

const HOUR_LABELS: Record<number, string> = { 0: '12am', 6: '6am', 12: '12pm', 18: '6pm', 23: '11pm' }

export function Profit(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { connection, loading: connLoading } = useShopifyConnection(workspaceId ?? '')
  const { connection: metaConn, loading: metaConnLoading } = useMetaConnection(workspaceId ?? '')
  const [selectedDays, setSelectedDays] = useState<number>(30)
  const [ordersPage, setOrdersPage] = useState(0)
  const dateRange = useMemo(() => getDateRange(selectedDays), [selectedDays])
  const { orders, summary, stats, totalCount, loading: ordersLoading } = useOrders(workspaceId ?? '', dateRange, selectedDays, ordersPage)
  const { totals: adsTotals, loading: adsLoading } = useAdsData(workspaceId ?? '', dateRange)
  const { totalCommittedSpend: influencerSpend, loading: influencerLoading } = useInfluencerSpend(workspaceId ?? '', dateRange)

  // Reset to page 0 whenever the date range changes
  useEffect(() => { setOrdersPage(0) }, [selectedDays])

  const isMetaConnected = !metaConnLoading && metaConn !== null
  const adSpend = isMetaConnected ? adsTotals.totalSpend : 0
  const hasInfluencerSpend = influencerSpend > 0
  const marketingSpend = adSpend + influencerSpend
  const trueNetProfit = summary.netProfit - adSpend - influencerSpend

  const loading = connLoading || ordersLoading || metaConnLoading || adsLoading || influencerLoading
  const isConnected = !connLoading && connection !== null

  // Key ratios
  const refundRate = summary.totalRevenue > 0 ? (summary.totalRefunds / summary.totalRevenue) * 100 : 0
  const profitMargin = summary.totalRevenue > 0 ? (trueNetProfit / summary.totalRevenue) * 100 : 0
  const adSpendRatio = (isMetaConnected || hasInfluencerSpend) && summary.totalRevenue > 0
    ? (marketingSpend / summary.totalRevenue) * 100
    : null

  // QW #1 — trend arrows
  const revenueTrend = stats && stats.lastWeekRevenue > 0
    ? ((stats.thisWeekRevenue - stats.lastWeekRevenue) / stats.lastWeekRevenue) * 100
    : undefined
  const netProfitLastWeek = stats ? stats.lastWeekRevenue - stats.lastWeekRefunds : 0
  const netProfitThisWeek = stats ? stats.thisWeekRevenue - stats.thisWeekRefunds : 0
  const profitTrend = stats && netProfitLastWeek > 0
    ? ((netProfitThisWeek - netProfitLastWeek) / netProfitLastWeek) * 100
    : undefined

  // ME #1 — refund rate trend
  const thisWeekRate = stats && stats.thisWeekRevenue > 0
    ? (stats.thisWeekRefunds / stats.thisWeekRevenue) * 100 : 0
  const lastWeekRate = stats && stats.lastWeekRevenue > 0
    ? (stats.lastWeekRefunds / stats.lastWeekRevenue) * 100 : 0
  const refundTrend = stats && lastWeekRate > 0
    ? ((thisWeekRate - lastWeekRate) / lastWeekRate) * 100
    : null

  // ME #2 — peak hours
  const maxHourCount = stats ? Math.max(...stats.hourlyOrderCounts, 1) : 1
  const hasHourData = stats ? stats.hourlyOrderCounts.some(c => c > 0) : false

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
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-heading">Profit</h1>
          <p className="mt-0.5 text-sm text-text">Revenue minus refunds, broken down by period.</p>
        </div>

        {/* Date range selector */}
        <div className="flex overflow-hidden rounded-lg border border-border">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              onClick={() => { setSelectedDays(preset.days) }}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedDays === preset.days
                  ? 'bg-accent text-white'
                  : 'bg-bg text-text hover:bg-surface'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards — QW #1 trend arrows */}
      <div className={`grid grid-cols-1 gap-4 ${(isMetaConnected || hasInfluencerSpend) ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <ProfitSummaryCard label="Revenue" value={formatCurrency(summary.totalRevenue)} trend={revenueTrend} loading={loading} />
        <ProfitSummaryCard label="Refunds" value={formatCurrency(summary.totalRefunds)} loading={loading} />
        {(isMetaConnected || hasInfluencerSpend) && (
          <ProfitSummaryCard label="Marketing Spend" value={formatCurrency(marketingSpend)} loading={loading} />
        )}
        <ProfitSummaryCard
          label={(isMetaConnected || hasInfluencerSpend) ? 'Net Profit (after marketing)' : 'Net Profit'}
          value={formatCurrency(trueNetProfit)}
          trend={profitTrend}
          loading={loading}
          highlight
        />
      </div>

      {/* Key Ratios — ME #1 refund rate with trend */}
      {!loading && summary.totalRevenue > 0 && (
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
          {stats && stats.rtoCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs dark:border-red-800 dark:bg-red-900/20">
              <span className="text-red-700 dark:text-red-300">RTO</span>
              <span className="font-semibold text-red-800 dark:text-red-200">{String(stats.rtoCount)} orders</span>
              <span className="text-red-600 dark:text-red-400">·</span>
              <span className="font-semibold text-red-800 dark:text-red-200">{formatCurrency(stats.rtoRevenue)} exposure</span>
            </div>
          )}
        </div>
      )}

      {/* Revenue Chart */}
      <RevenueChart orders={orders} loading={loading} />

      {/* ME #2 — Peak Hours Heatmap */}
      {!loading && stats && hasHourData && (
        <Card padding="md">
          <h3 className="mb-4 text-sm font-semibold text-heading">Peak Order Hours</h3>
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}
          >
            {stats.hourlyOrderCounts.map((count, hour) => (
              <div
                key={hour}
                title={`${String(hour).padStart(2, '0')}:00 — ${String(count)} orders`}
                className="h-8 rounded-sm bg-accent"
                style={{ opacity: 0.1 + (count / maxHourCount) * 0.9 }}
              />
            ))}
          </div>
          <div className="relative mt-1.5 h-4">
            {Object.entries(HOUR_LABELS).map(([h, label]) => {
              const hour = Number(h)
              return (
                <span
                  key={hour}
                  className="absolute text-[10px] text-text"
                  style={{
                    left: `${((hour / 23) * 100).toFixed(2)}%`,
                    transform: hour > 0 && hour < 23 ? 'translateX(-50%)' : undefined,
                  }}
                >
                  {label}
                </span>
              )
            })}
          </div>
        </Card>
      )}

      {/* Orders breakdown */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-heading">
            Orders ({String(totalCount)})
          </h2>
          {!loading && totalCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { exportOrdersCSV(orders) }}
            >
              Export CSV
            </Button>
          )}
        </div>
        <OrdersTable
          orders={orders}
          loading={loading}
          totalCount={totalCount}
          page={ordersPage}
          pageSize={10}
          onPageChange={setOrdersPage}
        />
      </div>
    </div>
  )
}
