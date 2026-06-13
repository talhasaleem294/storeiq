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

export function useCityAndCustomerStats(
  workspaceId: string,
  dateRange: DateRange,
): UseCityAndCustomerStatsReturn {
  const [cityRows, setCityRows] = useState<CityRow[]>([])
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)

    const cityQ = supabase
      .from('orders')
      .select('city, revenue, refund_amount, fulfillment_status')
      .eq('workspace_id', workspaceId)
      .not('city', 'is', null)
      .gte('created_at', dateRange.from)
      .lte('created_at', dateRange.to)

    const customerQ = supabase
      .from('orders')
      .select('customer_id, customer_email, revenue')
      .eq('workspace_id', workspaceId)
      .not('customer_id', 'is', null)
      .gte('created_at', dateRange.from)
      .lte('created_at', dateRange.to)

    // Fetch prior customer IDs to identify new customers in the current range
    const priorCustQ = supabase
      .from('orders')
      .select('customer_id')
      .eq('workspace_id', workspaceId)
      .not('customer_id', 'is', null)
      .lt('created_at', dateRange.from)

    void Promise.all([cityQ, customerQ, priorCustQ]).then(([cityRes, custRes, priorCustRes]) => {
      if (cancelled) return

      // --- City breakdown ---
      type CityRaw = { city: string | null; revenue: number; fulfillment_status: string }
      const cityData = (cityRes.data ?? []) as CityRaw[]

      const cityMap = new Map<string, { orderCount: number; revenue: number; rtoCount: number }>()
      for (const row of cityData) {
        if (!row.city) continue
        const existing = cityMap.get(row.city) ?? { orderCount: 0, revenue: 0, rtoCount: 0 }
        existing.orderCount += 1
        existing.revenue += row.revenue
        if (row.fulfillment_status === 'returned') existing.rtoCount += 1
        cityMap.set(row.city, existing)
      }

      const rows: CityRow[] = Array.from(cityMap.entries())
        .map(([city, data]) => ({
          city,
          orderCount: data.orderCount,
          revenue: data.revenue,
          rtoCount: data.rtoCount,
          rtoRate: data.orderCount > 0 ? (data.rtoCount / data.orderCount) * 100 : 0,
        }))
        .sort((a, b) => b.orderCount - a.orderCount)

      // --- Customer repeat rate ---
      type CustRaw = { customer_id: string | null; customer_email: string | null; revenue: number }
      const custData = (custRes.data ?? []) as CustRaw[]

      const custMap = new Map<string, { email: string | null; orderCount: number; totalSpend: number }>()
      for (const row of custData) {
        if (!row.customer_id) continue
        const existing = custMap.get(row.customer_id) ?? { email: row.customer_email, orderCount: 0, totalSpend: 0 }
        existing.orderCount += 1
        existing.totalSpend += row.revenue
        custMap.set(row.customer_id, existing)
      }

      const customers = Array.from(custMap.values())
      const totalCustomers = customers.length
      const totalRevenue = customers.reduce((s, c) => s + c.totalSpend, 0)
      const repeatCustomers = customers.filter(c => c.orderCount > 1)
      const repeatRevenue = repeatCustomers.reduce((s, c) => s + c.totalSpend, 0)

      type PriorCustRaw = { customer_id: string | null }
      const priorCustData = (priorCustRes.data ?? []) as PriorCustRaw[]
      const priorCustomerIds = new Set(priorCustData.map(r => r.customer_id).filter((id): id is string => id !== null))
      const newCustomerCount = Array.from(custMap.keys()).filter(id => !priorCustomerIds.has(id)).length

      const stats: CustomerStats | null = totalCustomers > 0
        ? {
            repeatRate: (repeatCustomers.length / totalCustomers) * 100,
            repeatRevenuePct: totalRevenue > 0 ? (repeatRevenue / totalRevenue) * 100 : 0,
            topCustomers: customers
              .sort((a, b) => b.totalSpend - a.totalSpend)
              .slice(0, 5)
              .map(c => ({
                email: c.email ? maskEmail(c.email) : null,
                orderCount: c.orderCount,
                totalSpend: c.totalSpend,
              })),
            newCustomerCount,
            priorCustomerIds,
          }
        : null

      setCityRows(rows)
      setCustomerStats(stats)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [workspaceId, dateRange.from, dateRange.to])

  return { cityRows, customerStats, loading }
}
