import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { DateRange } from '@/types/app'

export type RfmSegment = 'champion' | 'loyal' | 'at_risk' | 'new' | 'lost'

export interface RfmCustomer {
  customer_id: string
  lastOrderDaysAgo: number
  orderCount: number
  totalSpend: number
  segment: RfmSegment
}

export interface RfmCounts {
  champion: number
  loyal: number
  at_risk: number
  new: number
  lost: number
}

function classifyRFM(lastOrderDaysAgo: number, orderCount: number, totalSpend: number, spendQ3: number): RfmSegment {
  if (lastOrderDaysAgo <= 14 && orderCount >= 3 && totalSpend >= spendQ3) return 'champion'
  if (orderCount >= 3 && lastOrderDaysAgo <= 45) return 'loyal'
  if (lastOrderDaysAgo >= 45 && lastOrderDaysAgo <= 90 && orderCount >= 2) return 'at_risk'
  if (lastOrderDaysAgo <= 30 && orderCount === 1) return 'new'
  return 'lost'
}

interface UseCustomerRFMReturn {
  customers: RfmCustomer[]
  counts: RfmCounts
  loading: boolean
}

const EMPTY_COUNTS: RfmCounts = { champion: 0, loyal: 0, at_risk: 0, new: 0, lost: 0 }

export function useCustomerRFM(workspaceId: string, dateRange?: DateRange): UseCustomerRFMReturn {
  const [customers, setCustomers] = useState<RfmCustomer[]>([])
  const [counts, setCounts] = useState<RfmCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)

    void supabase
      .from('orders')
      .select('customer_id, created_at, revenue')
      .eq('workspace_id', workspaceId)
      .not('customer_id', 'is', null)
      .then(({ data }) => {
        if (cancelled) return
        if (!data || data.length === 0) {
          setCustomers([])
          setCounts(EMPTY_COUNTS)
          setLoading(false)
          return
        }

        // Group by customer_id client-side
        const map = new Map<string, { lastOrder: number; orderCount: number; totalSpend: number }>()
        const from = dateRange?.from ? new Date(dateRange.from).getTime() : 0
        const to = dateRange?.to ? new Date(dateRange.to).getTime() : Infinity

        for (const row of data as Array<{ customer_id: string; created_at: string; revenue: number }>) {
          const ts = new Date(row.created_at).getTime()
          if (ts < from || ts > to) continue
          const cid = row.customer_id
          const existing = map.get(cid) ?? { lastOrder: 0, orderCount: 0, totalSpend: 0 }
          map.set(cid, {
            lastOrder: Math.max(existing.lastOrder, ts),
            orderCount: existing.orderCount + 1,
            totalSpend: existing.totalSpend + row.revenue,
          })
        }

        if (map.size === 0) {
          setCustomers([])
          setCounts(EMPTY_COUNTS)
          setLoading(false)
          return
        }

        const now = Date.now()
        const rows = [...map.entries()].map(([cid, v]) => ({
          customer_id: cid,
          lastOrderDaysAgo: Math.floor((now - v.lastOrder) / 86_400_000),
          orderCount: v.orderCount,
          totalSpend: v.totalSpend,
        }))

        // Compute spend 75th percentile for "champion" threshold
        const sorted = [...rows].sort((a, b) => a.totalSpend - b.totalSpend)
        const q3Idx = Math.floor(sorted.length * 0.75)
        const spendQ3 = sorted[q3Idx]?.totalSpend ?? 0

        const classified: RfmCustomer[] = rows.map(r => ({
          ...r,
          segment: classifyRFM(r.lastOrderDaysAgo, r.orderCount, r.totalSpend, spendQ3),
        }))

        const c: RfmCounts = { champion: 0, loyal: 0, at_risk: 0, new: 0, lost: 0 }
        for (const r of classified) c[r.segment] += 1

        setCustomers(classified)
        setCounts(c)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [workspaceId, dateRange?.from, dateRange?.to])

  return { customers, counts, loading }
}
