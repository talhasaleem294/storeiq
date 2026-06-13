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

// Shape returned by get_rfm_data RPC (TABLE — one row per customer, not per order)
interface RfmRpcRow {
  customer_id: string
  last_order_at: string
  order_count: number
  total_spend: number
}

export function useCustomerRFM(workspaceId: string, dateRange?: DateRange): UseCustomerRFMReturn {
  const [customers, setCustomers] = useState<RfmCustomer[]>([])
  const [counts, setCounts] = useState<RfmCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)

    // get_rfm_data returns M rows (one per customer) not N rows (one per order)
    void supabase
      .rpc('get_rfm_data', {
        p_workspace_id: workspaceId,
        p_from: dateRange?.from ?? null,
        p_to:   dateRange?.to   ?? null,
      })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error !== null || !data) {
          setCustomers([])
          setCounts(EMPTY_COUNTS)
          setLoading(false)
          return
        }

        const rows = data as RfmRpcRow[]
        if (rows.length === 0) {
          setCustomers([])
          setCounts(EMPTY_COUNTS)
          setLoading(false)
          return
        }

        const now = Date.now()
        const mapped = rows.map(r => ({
          customer_id:      r.customer_id,
          lastOrderDaysAgo: Math.floor((now - new Date(r.last_order_at).getTime()) / 86_400_000),
          orderCount:       r.order_count,
          totalSpend:       r.total_spend,
        }))

        // Compute 75th-percentile spend for champion threshold
        const sorted = [...mapped].sort((a, b) => a.totalSpend - b.totalSpend)
        const q3Idx = Math.floor(sorted.length * 0.75)
        const spendQ3 = sorted[q3Idx]?.totalSpend ?? 0

        const classified: RfmCustomer[] = mapped.map(r => ({
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
