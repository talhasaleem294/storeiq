import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { OrdersTable } from '@/components/features/OrdersTable'
import { ProfitCalendar } from '@/components/features/ProfitCalendar'
import { ProfitSummaryCard } from '@/components/features/ProfitSummaryCard'
import { RevenueChart } from '@/components/features/RevenueChart'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { InsightBanner } from '@/components/ui/InsightBanner'
import { useAdsData } from '@/hooks/useAdsData'
import { useCityAndCustomerStats } from '@/hooks/useCityAndCustomerStats'
import { useInfluencerSpend } from '@/hooks/useInfluencerSpend'
import { useMetaConnection } from '@/hooks/useMetaConnection'
import { useOrders } from '@/hooks/useOrders'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { useWorkspaceCostConfig } from '@/hooks/useWorkspaceCostConfig'
import { ROUTES } from '@/lib/constants'
import { computeStructuredCosts } from '@/lib/costCalculator'
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

function cityRtoVerdict(rtoRate: number): { label: string; dotClass: string } {
  if (rtoRate > 40) return { label: 'Consider pausing ads', dotClass: 'bg-red-500' }
  if (rtoRate > 20) return { label: 'Monitor', dotClass: 'bg-amber-400' }
  return { label: 'Low risk', dotClass: 'bg-green-500' }
}

export function Profit(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { connection, loading: connLoading } = useShopifyConnection(workspaceId ?? '')
  const { connection: metaConn, loading: metaConnLoading } = useMetaConnection(workspaceId ?? '')
  const [selectedDays, setSelectedDays] = useState<number>(30)
  const [ordersPage, setOrdersPage] = useState(0)
  const [avgCostPerOrder, setAvgCostPerOrder] = useState<number>(0)
  const dateRange = useMemo(() => getDateRange(selectedDays), [selectedDays])
  const { orders, summary, stats, totalCount, loading: ordersLoading } = useOrders(workspaceId ?? '', dateRange, selectedDays, ordersPage)
  const { totals: adsTotals, loading: adsLoading } = useAdsData(workspaceId ?? '', dateRange)
  const { totalCommittedSpend: influencerSpend, loading: influencerLoading } = useInfluencerSpend(workspaceId ?? '', dateRange)
  const { cityRows, customerStats, loading: cityLoading } = useCityAndCustomerStats(workspaceId ?? '', dateRange)
  const { config: costConfig } = useWorkspaceCostConfig(workspaceId ?? '')

  // Reset to page 0 whenever the date range changes
  useEffect(() => { setOrdersPage(0) }, [selectedDays])

  const isMetaConnected = !metaConnLoading && metaConn !== null
  const adSpend = isMetaConnected ? adsTotals.totalSpend : 0
  const hasInfluencerSpend = influencerSpend > 0
  const marketingSpend = adSpend + influencerSpend
  const structuredCosts = computeStructuredCosts(costConfig, stats?.orderCount ?? 0, cityRows)
  const hasStructuredCosts = structuredCosts > 0
  const trueNetProfit = summary.netProfit - adSpend - influencerSpend - structuredCosts
  const estimatedCogs = avgCostPerOrder > 0 && stats ? avgCostPerOrder * stats.orderCount : 0
  const displayProfit = avgCostPerOrder > 0 ? trueNetProfit - estimatedCogs : trueNetProfit

  const loading = connLoading || ordersLoading || metaConnLoading || adsLoading || influencerLoading || cityLoading
  const isConnected = !connLoading && connection !== null

  // Key ratios
  const refundRate = summary.totalRevenue > 0 ? (summary.totalRefunds / summary.totalRevenue) * 100 : 0
  const profitMargin = summary.totalRevenue > 0 ? (displayProfit / summary.totalRevenue) * 100 : 0
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
      {(() => {
        const extraCols = (isMetaConnected || hasInfluencerSpend ? 1 : 0) + (hasStructuredCosts ? 1 : 0)
        const cols = 3 + extraCols
        return (
          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-${String(cols)}`}>
            <ProfitSummaryCard label="Revenue" value={formatCurrency(summary.totalRevenue)} trend={revenueTrend} loading={loading} />
            <ProfitSummaryCard label="Refunds" value={formatCurrency(summary.totalRefunds)} loading={loading} />
            {(isMetaConnected || hasInfluencerSpend) && (
              <ProfitSummaryCard label="Marketing Spend" value={formatCurrency(marketingSpend)} loading={loading} />
            )}
            {hasStructuredCosts && (
              <ProfitSummaryCard label="Cost Structure" value={formatCurrency(structuredCosts)} loading={loading} />
            )}
            <ProfitSummaryCard
              label={
                avgCostPerOrder > 0
                  ? 'Net Profit (incl. est. COGS)'
                  : (isMetaConnected || hasInfluencerSpend || hasStructuredCosts) ? 'Net Profit (after costs)' : 'Net Profit'
              }
              value={formatCurrency(displayProfit)}
              trend={profitTrend}
              loading={loading}
              highlight
            />
          </div>
        )
      })()}

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
          {(() => {
            if (!stats) return null
            const lateNightHours = [23, 0, 1, 2]
            const lateNightRto = lateNightHours.reduce((sum, h) => sum + (stats.hourlyRtoCounts[h] ?? 0), 0)
            const lateNightOrders = lateNightHours.reduce((sum, h) => sum + (stats.hourlyOrderCounts[h] ?? 0), 0)
            if (lateNightRto < 5 || lateNightOrders === 0) return null
            const lateNightRtoRate = lateNightRto / lateNightOrders
            const overallRtoRate = stats.orderCount > 0 ? stats.rtoCount / stats.orderCount : 0
            const lift = lateNightRtoRate - overallRtoRate
            if (lift <= 0.15) return null
            return (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs dark:border-amber-700 dark:bg-amber-900/20">
                <span className="text-amber-700 dark:text-amber-300">Late-night RTO</span>
                <span className="font-semibold text-amber-800 dark:text-amber-200">{(lateNightRtoRate * 100).toFixed(1)}% (11pm–2am)</span>
              </div>
            )
          })()}
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
            <span className="text-text">Avg cost/order (est.)</span>
            <input
              type="number"
              min={0}
              placeholder="PKR 0"
              value={avgCostPerOrder || ''}
              onChange={e => { setAvgCostPerOrder(Number(e.target.value) || 0) }}
              className="w-24 rounded border border-border bg-bg px-2 py-0.5 text-xs text-heading focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
      )}

      {/* InsightBanner — city RTO spread tip */}
      {!loading && (() => {
        const qualifiedCities = cityRows.filter(r => r.orderCount >= 5)
        if (qualifiedCities.length < 2) return null
        const maxCity = qualifiedCities.reduce((a, b) => a.rtoRate > b.rtoRate ? a : b)
        const minCity = qualifiedCities.reduce((a, b) => a.rtoRate < b.rtoRate ? a : b)
        if (maxCity.city === minCity.city) return null
        const spread = maxCity.rtoRate - minCity.rtoRate
        if (spread <= 15) return null
        return (
          <InsightBanner
            dismissKey={`storeiq_insight_dismissed_${workspaceId ?? ''}_profit`}
            variant="warning"
            message={`${maxCity.city} RTO is ${maxCity.rtoRate.toFixed(1)}% vs ${minCity.city} ${minCity.rtoRate.toFixed(1)}% — shifting geo-targeting could reduce lost orders`}
          />
        )
      })()}

      {/* Revenue Chart */}
      <RevenueChart orders={orders} loading={loading} />

      {/* Profit Calendar */}
      <ProfitCalendar workspaceId={workspaceId ?? ''} />

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

      {/* City Breakdown */}
      {!loading && cityRows.length > 0 && (
        <Card padding="md">
          <h3 className="mb-4 text-sm font-semibold text-heading">Revenue by City</h3>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text">
                  <th className="pb-2 font-medium">City</th>
                  <th className="pb-2 font-medium text-right">Orders</th>
                  <th className="pb-2 font-medium text-right">Revenue</th>
                  <th className="pb-2 font-medium text-right">RTO</th>
                  <th className="pb-2 font-medium text-right">RTO Rate</th>
                  <th className="pb-2 font-medium text-right">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cityRows.slice(0, 10).map(row => {
                  const verdict = cityRtoVerdict(row.rtoRate)
                  return (
                    <tr key={row.city} className="text-sm">
                      <td className="py-2 font-medium text-heading">{row.city}</td>
                      <td className="py-2 text-right text-text">{String(row.orderCount)}</td>
                      <td className="py-2 text-right text-text">{formatCurrency(row.revenue)}</td>
                      <td className="py-2 text-right text-text">{String(row.rtoCount)}</td>
                      <td className="py-2 text-right">
                        <span className={`font-semibold ${
                          row.rtoRate > 40 ? 'text-red-600' :
                          row.rtoRate > 20 ? 'text-amber-600' :
                                             'text-green-600'
                        }`}>
                          {row.rtoRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <span className="flex items-center justify-end gap-1">
                          <span className={`inline-block h-2 w-2 rounded-full ${verdict.dotClass}`} />
                          <span className="text-xs text-text">{verdict.label}</span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 sm:hidden">
            {cityRows.slice(0, 10).map(row => {
              const verdict = cityRtoVerdict(row.rtoRate)
              return (
                <div key={row.city} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-heading">{row.city}</p>
                    <p className="text-xs text-text">{String(row.orderCount)} orders · {formatCurrency(row.revenue)}</p>
                    <span className="mt-1 flex items-center gap-1">
                      <span className={`inline-block h-2 w-2 rounded-full ${verdict.dotClass}`} />
                      <span className="text-xs text-text">{verdict.label}</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      row.rtoRate > 40 ? 'text-red-600' :
                      row.rtoRate > 20 ? 'text-amber-600' :
                                         'text-green-600'
                    }`}>
                      {row.rtoRate.toFixed(1)}% RTO
                    </p>
                    <p className="text-xs text-text">{String(row.rtoCount)} returned</p>
                  </div>
                </div>
              )
            })}
          </div>

          {cityRows.length > 10 && (
            <p className="mt-3 text-xs text-text">and {String(cityRows.length - 10)} more cities</p>
          )}
        </Card>
      )}

      {/* Customer Insights */}
      {!loading && customerStats !== null && (
        <Card padding="md">
          <h3 className="mb-4 text-sm font-semibold text-heading">Customer Insights</h3>

          {/* Repeat rate chips */}
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
              <span className="text-text">Repeat Customers</span>
              <span className="font-semibold text-heading">{formatPercentage(customerStats.repeatRate)}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
              <span className="text-text">Repeat Revenue</span>
              <span className="font-semibold text-heading">{formatPercentage(customerStats.repeatRevenuePct)}</span>
            </div>
          </div>

          {/* CAC section — only when Meta is connected and new customers exist */}
          {isMetaConnected && customerStats.newCustomerCount > 0 && stats && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-text">Customer Acquisition</p>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
                  <span className="text-text">New Customers</span>
                  <span className="font-semibold text-heading">{String(customerStats.newCustomerCount)}</span>
                </div>
                {adSpend > 0 ? (() => {
                  const cac = adSpend / customerStats.newCustomerCount
                  const aov = stats.orderCount > 0 ? summary.totalRevenue / stats.orderCount : 0
                  const isProfitable = aov > cac
                  return (
                    <>
                      <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
                        <span className="text-text">CAC</span>
                        <span className="font-semibold text-heading">{formatCurrency(cac)}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                        isProfitable
                          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                          : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                      }`}>
                        <span className={isProfitable ? 'font-semibold text-green-700 dark:text-green-300' : 'font-semibold text-red-700 dark:text-red-300'}>
                          {isProfitable ? 'Profitable on first purchase' : 'Unprofitable CAC'}
                        </span>
                      </div>
                    </>
                  )
                })() : (
                  <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
                    <span className="text-text">CAC</span>
                    <span className="font-semibold text-heading">N/A</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top customers */}
          {customerStats.topCustomers.length > 0 && (
            <>
              <p className="mb-2 text-xs font-medium text-text">Top Customers by Spend</p>
              <div className="space-y-1">
                {customerStats.topCustomers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <p className="text-sm text-heading">{c.email ?? 'Guest'}</p>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-heading">{formatCurrency(c.totalSpend)}</p>
                      <p className="text-xs text-text">{String(c.orderCount)} orders</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
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
