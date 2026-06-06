import { useEffect, useState } from 'react'

import { PAGINATION } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import type { AdsData, AdsDataTotals, DateRange } from '@/types/app'

export type AdsPerformanceFilter = 'all' | 'good' | 'losing'

interface CampaignRow {
  campaign_name: string
  spend: number
  roas: number
  ctr: number
  status: string
}

export interface CampaignInsights {
  moneyAtRisk: number
  losingCount: number
  bestCampaign: { name: string; roas: number; spend: number } | null
  worstCampaign: { name: string; roas: number; spend: number } | null
  zeroPurchaseCount: number
  zeroPurchaseSpend: number
}

interface UseAdsDataReturn {
  campaigns: AdsData[]
  totals: AdsDataTotals
  totalCount: number
  insights: CampaignInsights | null
  loading: boolean
  error: string | null
}

const EMPTY_TOTALS: AdsDataTotals = { totalSpend: 0, avgRoas: 0, avgCtr: 0 }

function computeInsights(rows: CampaignRow[]): CampaignInsights {
  const losers = rows.filter((c) => c.roas < 1.0 && c.spend > 0)
  const spenders = rows.filter((c) => c.spend > 0)
  const zeroPurchase = rows.filter((c) => c.status === 'ACTIVE' && c.roas === 0 && c.spend > 0)

  const best = spenders.length ? spenders.reduce((a, b) => (a.roas > b.roas ? a : b)) : null
  const worst = losers.length ? losers.reduce((a, b) => (a.spend > b.spend ? a : b)) : null

  return {
    moneyAtRisk: losers.reduce((s, c) => s + c.spend, 0),
    losingCount: losers.length,
    bestCampaign: best ? { name: best.campaign_name, roas: best.roas, spend: best.spend } : null,
    worstCampaign: worst ? { name: worst.campaign_name, roas: worst.roas, spend: worst.spend } : null,
    zeroPurchaseCount: zeroPurchase.length,
    zeroPurchaseSpend: zeroPurchase.reduce((s, c) => s + c.spend, 0),
  }
}

export function useAdsData(
  workspaceId: string,
  dateRange?: DateRange,
  page = 0,
  perfFilter: AdsPerformanceFilter = 'all',
): UseAdsDataReturn {
  const [campaigns, setCampaigns] = useState<AdsData[]>([])
  const [totals, setTotals] = useState<AdsDataTotals>(EMPTY_TOTALS)
  const [totalCount, setTotalCount] = useState(0)
  const [insights, setInsights] = useState<CampaignInsights | null>(null)
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

    // Totals query — unfiltered by perf so summary cards and insights reflect all campaigns
    let totalsQ = supabase
      .from('ads_data')
      .select('campaign_name, spend, roas, ctr, status')
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

    const timer = setTimeout(() => {
      void Promise.all([totalsQ, displayQ]).then(([totalsRes, displayRes]) => {
        if (cancelled) return

        const err = totalsRes.error ?? displayRes.error
        if (err) {
          setError(err.message)
        } else {
          const allRows = (totalsRes.data ?? []) as CampaignRow[]
          if (allRows.length === 0) {
            setTotals(EMPTY_TOTALS)
            setInsights(null)
          } else {
            setTotals({
              totalSpend: allRows.reduce((sum, c) => sum + c.spend, 0),
              avgRoas: allRows.reduce((sum, c) => sum + c.roas, 0) / allRows.length,
              avgCtr: allRows.reduce((sum, c) => sum + c.ctr, 0) / allRows.length,
            })
            setInsights(computeInsights(allRows))
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

  return { campaigns, totals, totalCount, insights, loading, error }
}
