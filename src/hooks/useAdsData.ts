import { useEffect, useState } from 'react'

import { PAGINATION } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import type { AdsData, AdsDataTotals, DateRange } from '@/types/app'

export type AdsPerformanceFilter = 'all' | 'good' | 'losing'

interface UseAdsDataReturn {
  campaigns: AdsData[]
  totals: AdsDataTotals
  totalCount: number
  loading: boolean
  error: string | null
}

const EMPTY_TOTALS: AdsDataTotals = { totalSpend: 0, avgRoas: 0, avgCtr: 0 }

export function useAdsData(
  workspaceId: string,
  dateRange?: DateRange,
  page = 0,
  perfFilter: AdsPerformanceFilter = 'all',
): UseAdsDataReturn {
  const [campaigns, setCampaigns] = useState<AdsData[]>([])
  const [totals, setTotals] = useState<AdsDataTotals>(EMPTY_TOTALS)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    // Debounce page changes — avoids firing a query on every rapid Next/Prev click.
    // Filter/date changes fire immediately (page resets to 0 before this effect runs).
    const debounceMs = page > 0 ? 150 : 0
    let timer: ReturnType<typeof setTimeout>

    // Totals query — always unfiltered by perf so summary cards reflect all campaigns
    let totalsQ = supabase
      .from('ads_data')
      .select('spend, roas, ctr')
      .eq('workspace_id', workspaceId)

    // Display query — paginated and perf-filtered
    let displayQ = supabase
      .from('ads_data')
      .select('id, workspace_id, campaign_id, campaign_name, spend, roas, ctr, date, status', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('spend', { ascending: false })

    if (dateRange?.from) {
      totalsQ = totalsQ.gte('date', dateRange.from)
      displayQ = displayQ.gte('date', dateRange.from)
    }
    if (dateRange?.to) {
      totalsQ = totalsQ.lte('date', dateRange.to)
      displayQ = displayQ.lte('date', dateRange.to)
    }

    if (perfFilter === 'good') {
      displayQ = displayQ.gte('roas', 2.0)
    } else if (perfFilter === 'losing') {
      displayQ = displayQ.lt('roas', 1.0)
    }

    const rangeFrom = page * PAGINATION.DEFAULT_PAGE_SIZE
    const rangeTo = rangeFrom + PAGINATION.DEFAULT_PAGE_SIZE - 1
    displayQ = displayQ.range(rangeFrom, rangeTo)

    timer = setTimeout(() => {
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
          setTotalCount(displayRes.count ?? 0)
        }
        setLoading(false)
      })
    }, debounceMs)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [workspaceId, dateRange?.from, dateRange?.to, page, perfFilter])

  return { campaigns, totals, totalCount, loading, error }
}
