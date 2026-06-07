import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type {
  Influencer,
  InfluencerPlatform,
} from '@/types/app'

export interface InfluencerInsights {
  totalCommittedSpend: number
  totalDeals: number
  deliveryRate: number
  overdueCount: number
  ghostCount: number
  spendByPlatform: { platform: InfluencerPlatform | null; spend: number }[]
}

interface DealSummaryRow {
  id: string
  influencer_id: string
  total_amount: number
  product_value: number
  deal_date: string
}

interface DeliverableSummaryRow {
  deal_id: string
  status: string
  due_date: string | null
}

interface InfluencerWithSpend extends Influencer {
  totalSpend: number
  dealCount: number
}

interface UseInfluencerDataReturn {
  influencers: InfluencerWithSpend[]
  insights: InfluencerInsights
  loading: boolean
  error: string | null
}

const EMPTY_INSIGHTS: InfluencerInsights = {
  totalCommittedSpend: 0,
  totalDeals: 0,
  deliveryRate: 0,
  overdueCount: 0,
  ghostCount: 0,
  spendByPlatform: [],
}

function computeInsights(
  deals: DealSummaryRow[],
  deliverables: DeliverableSummaryRow[],
  influencers: Influencer[],
): InfluencerInsights {
  const todayStr = new Date().toISOString().substring(0, 10)

  const totalCommittedSpend = deals.reduce(
    (sum, d) => sum + d.total_amount + d.product_value, 0
  )

  // deliverables grouped by deal_id
  const byDeal = new Map<string, DeliverableSummaryRow[]>()
  for (const d of deliverables) {
    const list = byDeal.get(d.deal_id) ?? []
    list.push(d)
    byDeal.set(d.deal_id, list)
  }

  let postedCount = 0
  let totalDeliverables = 0
  let overdueCount = 0
  let ghostCount = 0

  for (const deal of deals) {
    const dvs = byDeal.get(deal.id) ?? []
    if (dvs.length === 0) continue
    totalDeliverables += dvs.length
    const allNoShow = dvs.every(d => d.status === 'no_show')
    if (allNoShow) ghostCount += 1
    for (const d of dvs) {
      if (d.status === 'posted') postedCount += 1
      if (d.status === 'pending' && d.due_date !== null && d.due_date < todayStr) {
        overdueCount += 1
      }
    }
  }

  // spend by platform
  const platformMap = new Map<string | null, number>()
  const influencerMap = new Map<string, Influencer>()
  for (const inf of influencers) influencerMap.set(inf.id, inf)

  for (const deal of deals) {
    const inf = influencerMap.get(deal.influencer_id)
    const platform = inf?.platform ?? null
    const key = platform ?? '__null__'
    platformMap.set(key, (platformMap.get(key) ?? 0) + deal.total_amount + deal.product_value)
  }

  const spendByPlatform = Array.from(platformMap.entries()).map(([k, spend]) => ({
    platform: k === '__null__' ? null : (k as InfluencerPlatform),
    spend,
  }))

  return {
    totalCommittedSpend,
    totalDeals: deals.length,
    deliveryRate: totalDeliverables > 0 ? (postedCount / totalDeliverables) * 100 : 0,
    overdueCount,
    ghostCount,
    spendByPlatform,
  }
}

export function useInfluencerData(workspaceId: string): UseInfluencerDataReturn {
  const [influencers, setInfluencers] = useState<InfluencerWithSpend[]>([])
  const [insights, setInsights] = useState<InfluencerInsights>(EMPTY_INSIGHTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const influencersQ = supabase
      .from('influencers')
      .select('id, workspace_id, name, platform, handle, niche, follower_count, notes, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    const dealsQ = supabase
      .from('influencer_deals')
      .select('id, influencer_id, total_amount, product_value, deal_date')
      .eq('workspace_id', workspaceId)

    const deliverablesQ = supabase
      .from('influencer_deliverables')
      .select('deal_id, status, due_date')
      .eq('workspace_id', workspaceId)

    void Promise.all([influencersQ, dealsQ, deliverablesQ]).then(
      ([infRes, dealRes, dvRes]) => {
        if (cancelled) return

        const err = infRes.error ?? dealRes.error ?? dvRes.error
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }

        const rawInfluencers = (infRes.data ?? []) as Influencer[]
        const deals = (dealRes.data ?? []) as DealSummaryRow[]
        const deliverables = (dvRes.data ?? []) as DeliverableSummaryRow[]

        // compute per-influencer totals
        const spendMap = new Map<string, number>()
        const countMap = new Map<string, number>()
        for (const deal of deals) {
          spendMap.set(
            deal.influencer_id,
            (spendMap.get(deal.influencer_id) ?? 0) + deal.total_amount + deal.product_value
          )
          countMap.set(deal.influencer_id, (countMap.get(deal.influencer_id) ?? 0) + 1)
        }

        const enriched: InfluencerWithSpend[] = rawInfluencers.map(inf => ({
          ...inf,
          totalSpend: spendMap.get(inf.id) ?? 0,
          dealCount: countMap.get(inf.id) ?? 0,
        }))

        setInfluencers(enriched)
        setInsights(computeInsights(deals, deliverables, rawInfluencers))
        setLoading(false)
      }
    )

    return () => { cancelled = true }
  }, [workspaceId])

  return { influencers, insights, loading, error }
}
