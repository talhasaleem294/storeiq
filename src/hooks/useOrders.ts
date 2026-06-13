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
  hourlyRtoCounts: number[]   // length 24, index = hour 0-23
  codRevenue: number
  prepaidRevenue: number
  codCount: number
  prepaidCount: number
  rtoCount: number
  rtoRevenue: number
  thisWeekRtoCount: number
  lastWeekRtoCount: number
  orderCount: number
  thisMonthRevenue: number
  lastMonthRevenue: number
  netProfitByDay: number[] // 7 entries, index 0 = 6 days ago, index 6 = today
}

interface UseOrdersReturn {
  orders: Order[]
  summary: OrdersSummary
  stats: OrderStats | null
  totalCount: number
  loading: boolean
  error: string | null
}

const EMPTY_SUMMARY: OrdersSummary = { totalRevenue: 0, totalRefunds: 0, netProfit: 0 }
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Shape returned by get_order_stats RPC
interface RpcResult {
  orderCount: number
  totalRevenue: number
  totalRefunds: number
  thisWeekRevenue: number
  lastWeekRevenue: number
  thisWeekRefunds: number
  lastWeekRefunds: number
  thisMonthRevenue: number
  lastMonthRevenue: number
  codRevenue: number
  prepaidRevenue: number
  codCount: number
  prepaidCount: number
  rtoCount: number
  rtoRevenue: number
  thisWeekRtoCount: number
  lastWeekRtoCount: number
  dayRevenue: Record<string, number>
  hourlyOrders: Record<string, number>
  hourlyRto: Record<string, number>
  sparkline: Array<{ date: string; net: number }>
}

function parseRpcResult(rpc: RpcResult, dateRangeDays: number): { summary: OrdersSummary; stats: OrderStats } {
  // Build fixed-length arrays from sparse JSON objects keyed by index
  const hourlyOrderCounts = new Array<number>(24).fill(0)
  const hourlyRtoCounts = new Array<number>(24).fill(0)
  for (const [h, cnt] of Object.entries(rpc.hourlyOrders)) hourlyOrderCounts[Number(h)] = cnt
  for (const [h, cnt] of Object.entries(rpc.hourlyRto))    hourlyRtoCounts[Number(h)]   = cnt

  const dayRevenue = new Array<number>(7).fill(0)
  for (const [d, rev] of Object.entries(rpc.dayRevenue)) dayRevenue[Number(d)] = rev
  const bestDayIdx = dayRevenue.reduce((best, v, i) => (v > dayRevenue[best] ? i : best), 0)

  // 7-day sparkline: fill zeros for days with no orders then overwrite with actuals
  const now = new Date()
  const profitMap = new Map<string, number>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    profitMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const entry of rpc.sparkline) {
    profitMap.set(entry.date.slice(0, 10), entry.net)
  }

  return {
    summary: {
      totalRevenue: rpc.totalRevenue,
      totalRefunds: rpc.totalRefunds,
      netProfit: rpc.totalRevenue - rpc.totalRefunds,
    },
    stats: {
      thisWeekRevenue:  rpc.thisWeekRevenue,
      lastWeekRevenue:  rpc.lastWeekRevenue,
      thisWeekRefunds:  rpc.thisWeekRefunds,
      lastWeekRefunds:  rpc.lastWeekRefunds,
      bestDayOfWeek:    DAY_NAMES[bestDayIdx] ?? 'Monday',
      bestDayRevenue:   dayRevenue[bestDayIdx] ?? 0,
      ordersPerDay:     rpc.orderCount / Math.max(dateRangeDays, 1),
      hourlyOrderCounts,
      hourlyRtoCounts,
      codRevenue:       rpc.codRevenue,
      prepaidRevenue:   rpc.prepaidRevenue,
      codCount:         rpc.codCount,
      prepaidCount:     rpc.prepaidCount,
      rtoCount:         rpc.rtoCount,
      rtoRevenue:       rpc.rtoRevenue,
      thisWeekRtoCount: rpc.thisWeekRtoCount,
      lastWeekRtoCount: rpc.lastWeekRtoCount,
      orderCount:       rpc.orderCount,
      thisMonthRevenue: rpc.thisMonthRevenue,
      lastMonthRevenue: rpc.lastMonthRevenue,
      netProfitByDay:   [...profitMap.values()],
    },
  }
}

export function useOrders(workspaceId: string, dateRange?: DateRange, dateRangeDays = 30, page = 0): UseOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<OrdersSummary>(EMPTY_SUMMARY)
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    // Stats RPC — server-side aggregation, zero raw rows transferred to client
    const statsQ = supabase.rpc('get_order_stats', {
      p_workspace_id: workspaceId,
      p_from: dateRange?.from ?? null,
      p_to:   dateRange?.to   ?? null,
    })

    // Display query — paginated, only the columns shown in OrdersTable
    const from = page * PAGINATION.DEFAULT_PAGE_SIZE
    const to   = from + PAGINATION.DEFAULT_PAGE_SIZE - 1
    let displayQ = supabase
      .from('orders')
      .select('id, workspace_id, shopify_order_id, revenue, refund_amount, status, fulfillment_status, created_at, confirmation_status, city, customer_id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (dateRange?.from) displayQ = displayQ.gte('created_at', dateRange.from)
    if (dateRange?.to)   displayQ = displayQ.lte('created_at', dateRange.to)

    void Promise.all([statsQ, displayQ]).then(([statsRes, displayRes]) => {
      if (cancelled) return

      const err = statsRes.error ?? displayRes.error
      if (err) {
        setError(err.message)
      } else {
        const rpc = statsRes.data as RpcResult | null
        if (rpc && rpc.orderCount > 0) {
          const { summary: s, stats: st } = parseRpcResult(rpc, dateRangeDays)
          setSummary(s)
          setStats(st)
          setTotalCount(rpc.orderCount)
        } else {
          setSummary(EMPTY_SUMMARY)
          setStats(null)
          setTotalCount(0)
        }
        setOrders((displayRes.data ?? []) as Order[])
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [workspaceId, dateRange?.from, dateRange?.to, dateRangeDays, page])

  return { orders, summary, stats, totalCount, loading, error }
}
