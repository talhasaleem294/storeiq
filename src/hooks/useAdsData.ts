import { useEffect, useState } from 'react'

import { PAGINATION } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import type { AdsData, AdsDataTotals, DateRange } from '@/types/app'

interface UseAdsDataReturn {
  campaigns: AdsData[]
  totals: AdsDataTotals
  loading: boolean
  error: string | null
}

export function useAdsData(workspaceId: string, dateRange?: DateRange): UseAdsDataReturn {
  const [campaigns, setCampaigns] = useState<AdsData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    let query = supabase
      .from('ads_data')
      .select('id, workspace_id, campaign_id, campaign_name, spend, roas, ctr, date')
      .eq('workspace_id', workspaceId)
      .order('spend', { ascending: false })
      .limit(PAGINATION.DEFAULT_PAGE_SIZE)

    if (dateRange?.from) {
      query = query.gte('date', dateRange.from)
    }
    if (dateRange?.to) {
      query = query.lte('date', dateRange.to)
    }

    void query.then(({ data, error: err }) => {
      if (cancelled) return
      if (err) {
        setError(err.message)
      } else {
        setCampaigns(data)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [workspaceId, dateRange?.from, dateRange?.to])

  const totals: AdsDataTotals =
    campaigns.length === 0
      ? { totalSpend: 0, avgRoas: 0, avgCtr: 0 }
      : {
          totalSpend: campaigns.reduce((sum, c) => sum + c.spend, 0),
          avgRoas: campaigns.reduce((sum, c) => sum + c.roas, 0) / campaigns.length,
          avgCtr: campaigns.reduce((sum, c) => sum + c.ctr, 0) / campaigns.length,
        }

  return { campaigns, totals, loading, error }
}
