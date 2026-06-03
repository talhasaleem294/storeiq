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

const EMPTY_SUMMARY: OrdersSummary = { totalRevenue: 0, totalRefunds: 0, netProfit: 0 }

export function useOrders(workspaceId: string, dateRange?: DateRange): UseOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<OrdersSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    // Summary query — no limit, only the two columns needed for profit math
    let summaryQ = supabase
      .from('orders')
      .select('revenue, refund_amount')
      .eq('workspace_id', workspaceId)

    // Display query — paginated, all columns for the orders table
    let displayQ = supabase
      .from('orders')
      .select('id, workspace_id, shopify_order_id, revenue, refund_amount, status, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(PAGINATION.DEFAULT_PAGE_SIZE)

    if (dateRange?.from) {
      summaryQ = summaryQ.gte('created_at', dateRange.from)
      displayQ = displayQ.gte('created_at', dateRange.from)
    }
    if (dateRange?.to) {
      summaryQ = summaryQ.lte('created_at', dateRange.to)
      displayQ = displayQ.lte('created_at', dateRange.to)
    }

    void Promise.all([summaryQ, displayQ]).then(([summaryRes, displayRes]) => {
      if (cancelled) return

      const err = summaryRes.error ?? displayRes.error
      if (err) {
        setError(err.message)
      } else {
        const allRows = summaryRes.data ?? []
        const computed = allRows.reduce<OrdersSummary>(
          (acc, row) => {
            const revenue = Number(row.revenue)
            const refund = Number(row.refund_amount)
            return {
              totalRevenue: acc.totalRevenue + revenue,
              totalRefunds: acc.totalRefunds + refund,
              netProfit: acc.netProfit + revenue - refund,
            }
          },
          { totalRevenue: 0, totalRefunds: 0, netProfit: 0 }
        )
        setSummary(computed)
        setOrders(displayRes.data ?? [])
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [workspaceId, dateRange?.from, dateRange?.to])

  return { orders, summary, loading, error }
}
