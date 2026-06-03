import { useEffect, useState } from 'react'

import { PAGINATION } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import type { DateRange, Order, OrdersSummary } from '@/types/app'

interface UseOrdersReturn {
  orders: Order[]
  summary: OrdersSummary
  loading: boolean
  error: string | null
}

export function useOrders(workspaceId: string, dateRange?: DateRange): UseOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    let query = supabase
      .from('orders')
      .select('id, workspace_id, shopify_order_id, revenue, refund_amount, status, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(PAGINATION.DEFAULT_PAGE_SIZE)

    if (dateRange?.from) {
      query = query.gte('created_at', dateRange.from)
    }
    if (dateRange?.to) {
      query = query.lte('created_at', dateRange.to)
    }

    void query.then(({ data, error: err }) => {
      if (cancelled) return
      if (err) {
        setError(err.message)
      } else {
        setOrders(data)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [workspaceId, dateRange?.from, dateRange?.to])

  const summary: OrdersSummary = orders.reduce(
    (acc, order) => ({
      totalRevenue: acc.totalRevenue + order.revenue,
      totalRefunds: acc.totalRefunds + order.refund_amount,
      netProfit: acc.netProfit + order.revenue - order.refund_amount,
    }),
    { totalRevenue: 0, totalRefunds: 0, netProfit: 0 }
  )

  return { orders, summary, loading, error }
}
