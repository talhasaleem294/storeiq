import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Order } from '@/types/app'

interface OrdersTableProps {
  orders: Order[]
  loading: boolean
}

function statusVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (['paid', 'fulfilled'].includes(status)) return 'success'
  if (['pending', 'partially_paid'].includes(status)) return 'warning'
  if (['refunded', 'voided'].includes(status)) return 'error'
  return 'neutral'
}

export function OrdersTable({ orders, loading }: OrdersTableProps): JSX.Element {
  if (loading) return <SkeletonTable rows={5} />

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Orders will appear here once your Shopify store syncs."
      />
    )
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Order</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text">Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text">Refund</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr key={order.id} className="bg-bg hover:bg-surface/50 transition-colors">
                <td className="px-4 py-3 font-medium text-heading">#{order.shopify_order_id}</td>
                <td className="px-4 py-3 text-text">{formatDate(order.created_at)}</td>
                <td className="px-4 py-3 text-right text-heading">{formatCurrency(order.revenue)}</td>
                <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">
                  {order.refund_amount > 0 ? `-${formatCurrency(order.refund_amount)}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {orders.map((order) => (
          <Card key={order.id} padding="md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-heading">#{order.shopify_order_id}</p>
                <p className="mt-0.5 text-xs text-text">{formatDate(order.created_at)}</p>
              </div>
              <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-text">Revenue</span>
              <span className="font-semibold text-heading">{formatCurrency(order.revenue)}</span>
            </div>
            {order.refund_amount > 0 && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-text">Refund</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  -{formatCurrency(order.refund_amount)}
                </span>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
