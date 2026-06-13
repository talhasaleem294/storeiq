import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { computeRtoRiskScore } from '@/lib/rtoPredictor'
import type { RtoRisk } from '@/lib/rtoPredictor'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { ConfirmationStatus, Order } from '@/types/app'

interface OrdersTableProps {
  orders: Order[]
  loading: boolean
  totalCount?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  canConfirm?: boolean
  cityRtoRates?: Map<string, number>
  priorCustomerIds?: Set<string>
}

function statusVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (['paid', 'fulfilled'].includes(status)) return 'success'
  if (['pending', 'partially_paid'].includes(status)) return 'warning'
  if (['refunded', 'voided'].includes(status)) return 'error'
  return 'neutral'
}

function confirmationBadge(cs: ConfirmationStatus | null): JSX.Element | null {
  if (!cs) return null
  if (cs === 'confirmed') return <Badge variant="success">✓ Confirmed</Badge>
  if (cs === 'no_response') return <Badge variant="neutral">? No Response</Badge>
  return <Badge variant="error">✗ Cancelled</Badge>
}

function riskBadge(risk: RtoRisk): JSX.Element {
  if (risk === 'high') return <Badge variant="error">High</Badge>
  if (risk === 'medium') return <Badge variant="warning">Medium</Badge>
  return <Badge variant="success">Low</Badge>
}

export function OrdersTable({
  orders,
  loading,
  totalCount = 0,
  page = 0,
  pageSize = 10,
  onPageChange,
  canConfirm = false,
  cityRtoRates,
  priorCustomerIds,
}: OrdersTableProps): JSX.Element {
  const showRisk = cityRtoRates !== undefined && priorCustomerIds !== undefined
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [localStatuses, setLocalStatuses] = useState<Record<string, ConfirmationStatus | null>>({})

  async function setConfirmation(orderId: string, status: ConfirmationStatus): Promise<void> {
    setPendingIds((prev) => new Set(prev).add(orderId))
    await supabase.from('orders').update({ confirmation_status: status }).eq('id', orderId)
    setLocalStatuses((prev) => ({ ...prev, [orderId]: status }))
    setPendingIds((prev) => { const s = new Set(prev); s.delete(orderId); return s })
  }

  if (loading) return <SkeletonTable rows={5} />

  const totalPages = Math.ceil(totalCount / pageSize)
  const hasPrev = page > 0
  const hasNext = page < totalPages - 1
  const start = totalCount === 0 ? 0 : page * pageSize + 1
  const end = Math.min((page + 1) * pageSize, totalCount)

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Orders will appear here once your Shopify store syncs."
      />
    )
  }

  function ConfirmButtons({ order }: { order: Order }): JSX.Element {
    const cs = localStatuses[order.id] ?? order.confirmation_status
    const busy = pendingIds.has(order.id)
    if (!canConfirm) return confirmationBadge(cs) ?? <span className="text-text/40 text-xs">—</span>
    return (
      <div className="flex items-center gap-1">
        {cs ? (
          <>
            {confirmationBadge(cs)}
            <button
              onClick={() => { void setConfirmation(order.id, 'confirmed') }}
              disabled={busy}
              title="Mark confirmed"
              className="ml-1 rounded px-1.5 py-0.5 text-xs text-text hover:bg-surface disabled:opacity-40"
            >
              ✎
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { void setConfirmation(order.id, 'confirmed') }}
              disabled={busy}
              className="rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-40 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400"
            >✓</button>
            <button
              onClick={() => { void setConfirmation(order.id, 'no_response') }}
              disabled={busy}
              className="rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium text-text hover:bg-bg disabled:opacity-40"
            >?</button>
            <button
              onClick={() => { void setConfirmation(order.id, 'cancelled') }}
              disabled={busy}
              className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400"
            >✗</button>
          </>
        )}
      </div>
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
              {showRisk && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">RTO Risk</th>}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Confirmation</th>
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
                {showRisk && (
                  <td className="px-4 py-3">
                    {riskBadge(computeRtoRiskScore(order, cityRtoRates!, priorCustomerIds!))}
                  </td>
                )}
                <td className="px-4 py-3">
                  <ConfirmButtons order={order} />
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
            {showRisk && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-text">RTO Risk</span>
                {riskBadge(computeRtoRiskScore(order, cityRtoRates!, priorCustomerIds!))}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-text">Confirmation</span>
              <ConfirmButtons order={order} />
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {onPageChange && totalPages > 1 && (
        <div className="flex flex-col items-center gap-2 pt-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { onPageChange(page - 1) }}
              disabled={!hasPrev}
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-border bg-bg text-sm text-heading transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              ←
            </button>
            <span className="text-xs text-text">
              {String(page + 1)} of {String(totalPages)}
            </span>
            <button
              onClick={() => { onPageChange(page + 1) }}
              disabled={!hasNext}
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-border bg-bg text-sm text-heading transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              →
            </button>
          </div>
          <span className="text-xs text-text">
            {String(start)}–{String(end)} of {String(totalCount)} orders
          </span>
        </div>
      )}
    </div>
  )
}
