import { useEffect, useState } from 'react'

import { PAGINATION } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import type { DateRange, Order, OrdersSummary } from '@/types/app'

export interface OrderStats {
  thisWeekRevenue: number
  lastWeekRevenue: number
  thisWeekRefunds: number
  lastWeekRefunds: number
  bestDayOfWeek: string
  bestDayRevenue: number
  ordersPerDay: number
  hourlyOrderCounts: number[] // length 24, index = hour 0-23
  codRevenue: number
  prepaidRevenue: number
  codCount: number
  prepaidCount: number
}

interface SummaryRow {
  revenue: number
  refund_amount: number
  status: string
  created_at: string
}

interface UseOrdersReturn {
  orders: Order[]
  summary: OrdersSummary
  stats: OrderStats | null
  loading: boolean
  error: string | null
}

const EMPTY_SUMMARY: OrdersSummary = { totalRevenue: 0, totalRefunds: 0, netProfit: 0 }

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function computeStats(allRows: SummaryRow[], dateRangeDays: number): OrderStats {
  const now = Date.now()
  const oneDay = 86_400_000
  const thisWeekCutoff = now - 7 * oneDay
  const lastWeekCutoff = now - 14 * oneDay

  let thisWeekRevenue = 0
  let lastWeekRevenue = 0
  let thisWeekRefunds = 0
  let lastWeekRefunds = 0

  const dayRevenue = new Array<number>(7).fill(0)
  const hourlyCounts = new Array<number>(24).fill(0)
  let codRevenue = 0
  let prepaidRevenue = 0
  let codCount = 0
  let prepaidCount = 0

  for (const row of allRows) {
    const ts = new Date(row.created_at).getTime()
    const revenue = row.revenue
    const refund = row.refund_amount

    if (ts >= thisWeekCutoff) {
      thisWeekRevenue += revenue
      thisWeekRefunds += refund
    } else if (ts >= lastWeekCutoff) {
      lastWeekRevenue += revenue
      lastWeekRefunds += refund
    }

    const d = new Date(row.created_at)
    dayRevenue[d.getDay()] += revenue
    hourlyCounts[d.getHours()] += 1

    const s = row.status
    if (s === 'pending') {
      codRevenue += revenue
      codCount += 1
    } else if (s === 'paid' || s === 'fulfilled') {
      prepaidRevenue += revenue
      prepaidCount += 1
    }
  }

  const bestDayIdx = dayRevenue.reduce((best, v, i) => (v > dayRevenue[best] ? i : best), 0)
  const days = Math.max(dateRangeDays, 1)

  return {
    thisWeekRevenue,
    lastWeekRevenue,
    thisWeekRefunds,
    lastWeekRefunds,
    bestDayOfWeek: DAY_NAMES[bestDayIdx] ?? 'Monday',
    bestDayRevenue: dayRevenue[bestDayIdx] ?? 0,
    ordersPerDay: allRows.length / days,
    hourlyOrderCounts: hourlyCounts,
    codRevenue,
    prepaidRevenue,
    codCount,
    prepaidCount,
  }
}

export function useOrders(workspaceId: string, dateRange?: DateRange, dateRangeDays = 30): UseOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<OrdersSummary>(EMPTY_SUMMARY)
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    // Summary query — no limit, columns needed for profit math + temporal stats
    let summaryQ = supabase
      .from('orders')
      .select('revenue, refund_amount, status, created_at')
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
        const allRows = (summaryRes.data ?? []) as SummaryRow[]
        const computed = allRows.reduce<OrdersSummary>(
          (acc, row) => {
            const revenue = row.revenue
            const refund = row.refund_amount
            return {
              totalRevenue: acc.totalRevenue + revenue,
              totalRefunds: acc.totalRefunds + refund,
              netProfit: acc.netProfit + revenue - refund,
            }
          },
          { totalRevenue: 0, totalRefunds: 0, netProfit: 0 }
        )
        setSummary(computed)
        setStats(allRows.length > 0 ? computeStats(allRows, dateRangeDays) : null)
        setOrders(displayRes.data ?? [])
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [workspaceId, dateRange?.from, dateRange?.to, dateRangeDays])

  return { orders, summary, stats, loading, error }
}
