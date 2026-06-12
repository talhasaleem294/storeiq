import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

export interface DayProfit {
  revenue: number
  adSpend: number
  netProfit: number
}

interface UseDailyProfitCalendarReturn {
  days: Map<string, DayProfit>
  loading: boolean
  error: string | null
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function padDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${String(year)}-${mm}-${dd}`
}

export function useDailyProfitCalendar(
  workspaceId: string,
  year: number,
  month: number,
): UseDailyProfitCalendarReturn {
  const [days, setDays] = useState<Map<string, DayProfit>>(new Map())
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const monthStart = padDate(year, month, 1)
    const totalDays = daysInMonth(year, month)
    const monthEnd = padDate(year, month, totalDays)

    const ordersQ = supabase
      .from('orders')
      .select('created_at, revenue, refund_amount')
      .eq('workspace_id', workspaceId)
      .gte('created_at', monthStart)
      .lte('created_at', `${monthEnd}T23:59:59`)

    const adsQ = supabase
      .from('ads_data')
      .select('date, spend')
      .eq('workspace_id', workspaceId)
      .gte('date', monthStart)
      .lte('date', monthEnd)

    void Promise.all([ordersQ, adsQ]).then(([ordersRes, adsRes]) => {
      if (cancelled) return

      const err = ordersRes.error ?? adsRes.error
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      // Zero-fill all days
      const result = new Map<string, DayProfit>()
      for (let d = 1; d <= totalDays; d++) {
        result.set(padDate(year, month, d), { revenue: 0, adSpend: 0, netProfit: 0 })
      }

      type OrderRow = { created_at: string; revenue: number; refund_amount: number }
      for (const row of ordersRes.data as OrderRow[]) {
        const key = row.created_at.slice(0, 10)
        const existing = result.get(key)
        if (existing) {
          existing.revenue += row.revenue
          existing.netProfit += row.revenue - row.refund_amount
        }
      }

      type AdsRow = { date: string; spend: number }
      for (const row of adsRes.data as AdsRow[]) {
        const key = row.date.slice(0, 10)
        const existing = result.get(key)
        if (existing) {
          existing.adSpend += row.spend
          existing.netProfit -= row.spend
        }
      }

      setDays(result)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [workspaceId, year, month])

  return { days, loading, error }
}
