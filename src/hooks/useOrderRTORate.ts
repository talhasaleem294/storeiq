import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { DateRange } from '@/types/app'

interface UseOrderRTORateReturn {
  rtoRate: number
  loading: boolean
}

// TODO: migrate to RPC if workspace exceeds 50k orders — fetches fulfillment_status column only
export function useOrderRTORate(
  workspaceId: string,
  dateRange?: DateRange,
): UseOrderRTORateReturn {
  const [rtoRate, setRtoRate] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    let query = supabase
      .from('orders')
      .select('fulfillment_status')
      .eq('workspace_id', workspaceId)

    if (dateRange?.from) query = query.gte('created_at', dateRange.from)
    if (dateRange?.to)   query = query.lte('created_at', dateRange.to)

    void query.then(({ data, error }) => {
      if (cancelled) return
      if (!error) {
        const total = data.length
        const rto = data.filter(r => r.fulfillment_status === 'returned').length
        setRtoRate(total > 0 ? rto / total : 0)
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [workspaceId, dateRange?.from, dateRange?.to])

  return { rtoRate, loading }
}
