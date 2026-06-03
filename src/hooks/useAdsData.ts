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

const EMPTY_TOTALS: AdsDataTotals = { totalSpend: 0, avgRoas: 0, avgCtr: 0 }

export function useAdsData(workspaceId: string, dateRange?: DateRange): UseAdsDataReturn {
  const [campaigns, setCampaigns] = useState<AdsData[]>([])
  const [totals, setTotals] = useState<AdsDataTotals>(EMPTY_TOTALS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    // Totals query — no limit, only the columns needed for spend/roas/ctr math
    let totalsQ = supabase
      .from('ads_data')
      .select('spend, roas, ctr')
      .eq('workspace_id', workspaceId)

    // Display query — paginated, full columns for the campaigns table
    let displayQ = supabase
      .from('ads_data')
      .select('id, workspace_id, campaign_id, campaign_name, spend, roas, ctr, date, status')
      .eq('workspace_id', workspaceId)
      .order('spend', { ascending: false })
      .limit(PAGINATION.DEFAULT_PAGE_SIZE)

    if (dateRange?.from) {
      totalsQ = totalsQ.gte('date', dateRange.from)
      displayQ = displayQ.gte('date', dateRange.from)
    }
    if (dateRange?.to) {
      totalsQ = totalsQ.lte('date', dateRange.to)
      displayQ = displayQ.lte('date', dateRange.to)
    }

    void Promise.all([totalsQ, displayQ]).then(([totalsRes, displayRes]) => {
      if (cancelled) return

      const err = totalsRes.error ?? displayRes.error
      if (err) {
        setError(err.message)
      } else {
        const allRows = totalsRes.data ?? []
        if (allRows.length === 0) {
          setTotals(EMPTY_TOTALS)
        } else {
          setTotals({
            totalSpend: allRows.reduce((sum, c) => sum + Number(c.spend), 0),
            avgRoas: allRows.reduce((sum, c) => sum + Number(c.roas), 0) / allRows.length,
            avgCtr: allRows.reduce((sum, c) => sum + Number(c.ctr), 0) / allRows.length,
          })
        }
        setCampaigns(displayRes.data ?? [])
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [workspaceId, dateRange?.from, dateRange?.to])

  return { campaigns, totals, loading, error }
}
