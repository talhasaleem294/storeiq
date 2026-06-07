import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { DateRange } from '@/types/app'

interface SpendRow {
  total_amount: number
  product_value: number
}

interface UseInfluencerSpendReturn {
  totalCommittedSpend: number
  loading: boolean
}

export function useInfluencerSpend(
  workspaceId: string,
  dateRange?: DateRange,
): UseInfluencerSpendReturn {
  const [totalCommittedSpend, setTotalCommittedSpend] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    let q = supabase
      .from('influencer_deals')
      .select('total_amount, product_value')
      .eq('workspace_id', workspaceId)

    if (dateRange?.from) q = q.gte('deal_date', dateRange.from.substring(0, 10))
    if (dateRange?.to)   q = q.lte('deal_date', dateRange.to.substring(0, 10))

    void q.then(({ data }) => {
      if (cancelled) return
      const rows = (data ?? []) as SpendRow[]
      const total = rows.reduce((sum, r) => sum + r.total_amount + r.product_value, 0)
      setTotalCommittedSpend(total)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [workspaceId, dateRange?.from, dateRange?.to])

  return { totalCommittedSpend, loading }
}
