import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { DateRange } from '@/types/app'

export interface CityRow {
  city: string
  orderCount: number
  revenue: number
  rtoCount: number
  rtoRate: number
}

export interface TopCustomer {
  email: string | null
  orderCount: number
  totalSpend: number
}

export interface CustomerStats {
  repeatRate: number
  repeatRevenuePct: number
  topCustomers: TopCustomer[]
  newCustomerCount: number
  priorCustomerIds: Set<string>
}

export interface UseCityAndCustomerStatsReturn {
  cityRows: CityRow[]
  customerStats: CustomerStats | null
  loading: boolean
}

function maskEmail(email: string): string {
  const atIdx = email.indexOf('@')
  if (atIdx <= 2) return email
  return email.slice(0, 2) + '*'.repeat(atIdx - 2) + email.slice(atIdx)
}

// RPC return shapes
interface CityRpcRow {
  city: string
  order_count: number
  total_revenue: number
  rto_count: number
}

interface CustomerRpcResult {
  repeatRate: number
  repeatRevenuePct: number
  topCustomers: Array<{ customer_email: string | null; order_count: number; total_spend: number }> | null
  newCustomerCount: number
}

export function useCityAndCustomerStats(
  workspaceId: string,
  dateRange: DateRange,
): UseCityAndCustomerStatsReturn {
  const [cityRows, setCityRows] = useState<CityRow[]>([])
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)

    // 1. City stats — server-side GROUP BY, returns one row per city
    const cityQ = supabase.rpc('get_city_stats', {
      p_workspace_id: workspaceId,
      p_from: dateRange.from ?? null,
      p_to:   dateRange.to   ?? null,
    })

    // 2. Customer stats — server-side aggregation
    const custQ = supabase.rpc('get_customer_stats', {
      p_workspace_id: workspaceId,
      p_from: dateRange.from ?? null,
      p_to:   dateRange.to   ?? null,
    })

    // 3. Prior customer IDs — narrow query (one column), needed for per-order RTO scoring
    let priorQ = supabase
      .from('orders')
      .select('customer_id')
      .eq('workspace_id', workspaceId)
      .not('customer_id', 'is', null)
    if (dateRange.from) priorQ = priorQ.lt('created_at', dateRange.from)

    void Promise.all([cityQ, custQ, priorQ]).then(([cityRes, custRes, priorRes]) => {
      if (cancelled) return

      // City rows
      const rawCities = (cityRes.data ?? []) as CityRpcRow[]
      const rows: CityRow[] = rawCities.map(r => ({
        city:       r.city,
        orderCount: r.order_count,
        revenue:    r.total_revenue,
        rtoCount:   r.rto_count,
        rtoRate:    r.order_count > 0 ? (r.rto_count / r.order_count) * 100 : 0,
      }))
      setCityRows(rows)

      // Prior customer IDs set (for RTO scoring in OrdersTable)
      type PriorRow = { customer_id: string | null }
      const priorCustomerIds = new Set(
        ((priorRes.data ?? []) as PriorRow[])
          .map(r => r.customer_id)
          .filter((id): id is string => id !== null)
      )

      // Customer stats
      const rpc = custRes.data as CustomerRpcResult | null
      if (rpc) {
        const topCustomers: TopCustomer[] = (rpc.topCustomers ?? []).map(c => ({
          email:      c.customer_email ? maskEmail(c.customer_email) : null,
          orderCount: c.order_count,
          totalSpend: c.total_spend,
        }))
        setCustomerStats({
          repeatRate:       rpc.repeatRate,
          repeatRevenuePct: rpc.repeatRevenuePct,
          topCustomers,
          newCustomerCount: rpc.newCustomerCount,
          priorCustomerIds,
        })
      } else {
        setCustomerStats(null)
      }

      setLoading(false)
    })

    return () => { cancelled = true }
  }, [workspaceId, dateRange.from, dateRange.to])

  return { cityRows, customerStats, loading }
}
