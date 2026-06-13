import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

export interface CashFlowWeek {
  weekLabel: string      // e.g. "Jun 9–15"
  weekStart: Date
  weekEnd: Date
  codReceived: number    // from cod_remittance_log
  estimatedIncoming: number  // COD orders placed 7-14d ago × revenue
  adSpendEstimate: number    // ads spend velocity for this week
  netCash: number
  isPast: boolean
}

interface RemittanceRow { amount: number; received_at: string }
interface OrderRow { revenue: number; created_at: string; status: string }
interface AdsRow { spend: number; date: string }

function weekRange(offsetWeeks: number): { start: Date; end: Date } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek + 1 + offsetWeeks * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function weekLabel(start: Date, end: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const m = months[start.getMonth()] ?? ''
  return `${m} ${String(start.getDate())}–${String(end.getDate())}`
}

export function useCashFlowCalendar(workspaceId: string): { weeks: CashFlowWeek[]; loading: boolean } {
  const [weeks, setWeeks] = useState<CashFlowWeek[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)

    // Fetch 8 weeks of data: 4 weeks back, current, 3 weeks forward
    const rangeStart = weekRange(-4).start
    const rangeEnd = weekRange(4).end

    void Promise.all([
      // Remittances received
      supabase
        .from('cod_remittance_log')
        .select('amount, received_at')
        .eq('workspace_id', workspaceId)
        .gte('received_at', fmt(rangeStart))
        .lte('received_at', fmt(rangeEnd)),

      // COD orders placed 7-21 days ago (likely incoming remittances for future weeks)
      supabase
        .from('orders')
        .select('revenue, created_at, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .gte('created_at', fmt(rangeStart))
        .lte('created_at', fmt(rangeEnd)),

      // Ads spend
      supabase
        .from('ads_data')
        .select('spend, date')
        .eq('workspace_id', workspaceId)
        .gte('date', fmt(rangeStart))
        .lte('date', fmt(rangeEnd)),
    ]).then(([remittanceRes, ordersRes, adsRes]) => {
      if (cancelled) return

      const remittances = (remittanceRes.data ?? []) as RemittanceRow[]
      const codOrders = (ordersRes.data ?? []) as OrderRow[]
      const adsRows = (adsRes.data ?? []) as AdsRow[]

      const now = new Date()
      const result: CashFlowWeek[] = []

      for (let w = -1; w <= 4; w++) {
        const { start, end } = weekRange(w)
        const isPast = end < now

        // Actual COD received in this week
        const codReceived = remittances
          .filter(r => {
            const d = new Date(r.received_at)
            return d >= start && d <= end
          })
          .reduce((s, r) => s + r.amount, 0)

        // COD orders placed 7-14 days before this week = estimated to be remitted this week
        const windowStart = new Date(start)
        windowStart.setDate(windowStart.getDate() - 14)
        const windowEnd = new Date(start)
        windowEnd.setDate(windowEnd.getDate() - 7)
        const estimatedIncoming = codOrders
          .filter(o => {
            const d = new Date(o.created_at)
            return d >= windowStart && d <= windowEnd
          })
          .reduce((s, o) => s + o.revenue, 0)

        // Ads spend in this week
        const adSpendEstimate = adsRows
          .filter(a => {
            const d = new Date(a.date)
            return d >= start && d <= end
          })
          .reduce((s, a) => s + a.spend, 0)

        const netCash = (isPast ? codReceived : estimatedIncoming) - adSpendEstimate

        result.push({
          weekLabel: weekLabel(start, end),
          weekStart: start,
          weekEnd: end,
          codReceived,
          estimatedIncoming,
          adSpendEstimate,
          netCash,
          isPast,
        })
      }

      setWeeks(result)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [workspaceId])

  return { weeks, loading }
}
