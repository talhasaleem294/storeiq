import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { OrdersTable } from '@/components/features/OrdersTable'
import { ProfitSummaryCard } from '@/components/features/ProfitSummaryCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAdsData } from '@/hooks/useAdsData'
import { useMetaConnection } from '@/hooks/useMetaConnection'
import { useOrders } from '@/hooks/useOrders'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { ROUTES } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
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

export function Profit(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { connection, loading: connLoading } = useShopifyConnection(workspaceId ?? '')
  const { connection: metaConn, loading: metaConnLoading } = useMetaConnection(workspaceId ?? '')
  const [selectedDays, setSelectedDays] = useState<number>(30)
  const dateRange = useMemo(() => getDateRange(selectedDays), [selectedDays])
  const { orders, summary, loading: ordersLoading } = useOrders(workspaceId ?? '', dateRange)
  const { totals: adsTotals, loading: adsLoading } = useAdsData(workspaceId ?? '', dateRange)

  const isMetaConnected = !metaConnLoading && metaConn !== null
  const adSpend = isMetaConnected ? adsTotals.totalSpend : 0
  const trueNetProfit = summary.netProfit - adSpend

  const loading = connLoading || ordersLoading || metaConnLoading || adsLoading
  const isConnected = !connLoading && connection !== null

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
        <div className="flex rounded-lg border border-border overflow-hidden">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.days}
              onClick={() => { setSelectedDays(preset.days); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
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

      {/* Summary cards */}
      <div className={`grid grid-cols-1 gap-4 ${isMetaConnected ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <ProfitSummaryCard label="Revenue" value={formatCurrency(summary.totalRevenue)} loading={loading} />
        <ProfitSummaryCard label="Refunds" value={formatCurrency(summary.totalRefunds)} loading={loading} />
        {isMetaConnected && (
          <ProfitSummaryCard label="Ad Spend" value={formatCurrency(adSpend)} loading={loading} />
        )}
        <ProfitSummaryCard
          label={isMetaConnected ? 'Net Profit (after ads)' : 'Net Profit'}
          value={formatCurrency(trueNetProfit)}
          loading={loading}
          highlight
        />
      </div>

      {/* Orders breakdown */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-heading">
          Orders ({orders.length})
        </h2>
        <OrdersTable orders={orders} loading={loading} />
      </div>
    </div>
  )
}
