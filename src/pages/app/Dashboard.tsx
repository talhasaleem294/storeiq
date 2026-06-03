import { Link, useParams } from 'react-router-dom'

import { OrdersTable } from '@/components/features/OrdersTable'
import { ProfitSummaryCard } from '@/components/features/ProfitSummaryCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAdsData } from '@/hooks/useAdsData'
import { useMetaConnection } from '@/hooks/useMetaConnection'
import { useOrders } from '@/hooks/useOrders'
import { useShopifyConnection } from '@/hooks/useShopifyConnection'
import { ROUTES } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'

export function Dashboard(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { connection, loading: connLoading } = useShopifyConnection(workspaceId ?? '')
  const { connection: metaConn, loading: metaConnLoading } = useMetaConnection(workspaceId ?? '')
  const { orders, summary, loading: ordersLoading } = useOrders(workspaceId ?? '')
  const { totals: adsTotals, loading: adsLoading } = useAdsData(workspaceId ?? '')

  const isMetaConnected = !metaConnLoading && metaConn !== null
  const adSpend = isMetaConnected ? adsTotals.totalSpend : 0
  const trueNetProfit = summary.netProfit - adSpend

  const isLoading = connLoading || ordersLoading || metaConnLoading || adsLoading
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
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-heading">Dashboard</h1>
        <p className="mt-0.5 text-sm text-text">Your profit overview at a glance.</p>
      </div>

      {/* Summary cards */}
      <div className={`grid grid-cols-1 gap-4 ${isMetaConnected ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <ProfitSummaryCard
          label="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
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
          loading={isLoading}
          highlight
        />
      </div>

      {/* Recent orders */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-heading">Recent Orders</h2>
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
