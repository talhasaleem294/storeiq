import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { CampaignAdLink, InfluencerDeal, MarketingCampaign } from '@/types/app'

export interface DealWithInfluencer extends InfluencerDeal {
  influencer_name: string
  influencer_handle: string | null
}

export interface DeliverableStats {
  posted: number
  pending: number
  late: number
  no_show: number
  total: number
}

interface RawDealRow extends Omit<InfluencerDeal, 'influencer_name' | 'influencer_handle'> {
  influencers: { name: string; handle: string | null }
}

interface UseCampaignDetailReturn {
  campaign: MarketingCampaign | null
  deals: DealWithInfluencer[]
  adLinks: CampaignAdLink[]
  deliverableStats: DeliverableStats
  totalInfluencerSpend: number
  totalMetaSpend: number
  loading: boolean
  error: string | null
  refetch: () => void
}

const EMPTY_STATS: DeliverableStats = { posted: 0, pending: 0, late: 0, no_show: 0, total: 0 }

export function useCampaignDetail(
  workspaceId: string,
  campaignId: string,
): UseCampaignDetailReturn {
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null)
  const [deals, setDeals] = useState<DealWithInfluencer[]>([])
  const [adLinks, setAdLinks] = useState<CampaignAdLink[]>([])
  const [deliverableStats, setDeliverableStats] = useState<DeliverableStats>(EMPTY_STATS)
  const [totalInfluencerSpend, setTotalInfluencerSpend] = useState(0)
  const [totalMetaSpend, setTotalMetaSpend] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!workspaceId || !campaignId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const campaignQ = supabase
      .from('marketing_campaigns')
      .select('id, workspace_id, name, start_date, end_date, status, notes, created_at')
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    const dealsQ = supabase
      .from('influencer_deals')
      .select(`
        id, workspace_id, influencer_id, campaign_id, deal_date,
        total_amount, advance_paid, balance_due, product_value,
        payment_method, promo_code, notes, created_at,
        influencers!inner(name, handle)
      `)
      .eq('campaign_id', campaignId)
      .eq('workspace_id', workspaceId)
      .order('deal_date', { ascending: false })

    const adLinksQ = supabase
      .from('campaign_ad_links')
      .select('id, campaign_id, workspace_id, ads_campaign_id, ads_campaign_name, created_at')
      .eq('campaign_id', campaignId)
      .eq('workspace_id', workspaceId)

    void Promise.all([campaignQ, dealsQ, adLinksQ]).then(
      async ([campRes, dealRes, linkRes]) => {
        if (cancelled) return

        const err = campRes.error ?? dealRes.error ?? linkRes.error
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }

        const rawDeals = (dealRes.data ?? []) as unknown as RawDealRow[]
        const rawLinks = (linkRes.data ?? []) as CampaignAdLink[]

        const mappedDeals: DealWithInfluencer[] = rawDeals.map(row => ({
          id:             row.id,
          workspace_id:   row.workspace_id,
          influencer_id:  row.influencer_id,
          campaign_id:    row.campaign_id,
          deal_date:      row.deal_date,
          total_amount:   row.total_amount,
          advance_paid:   row.advance_paid,
          balance_due:    row.balance_due,
          product_value:  row.product_value,
          payment_method: row.payment_method,
          promo_code:     row.promo_code,
          notes:          row.notes,
          created_at:     row.created_at,
          influencer_name:   row.influencers.name,
          influencer_handle: row.influencers.handle,
        }))

        const influencerTotal = mappedDeals.reduce(
          (sum, d) => sum + d.total_amount + d.product_value, 0
        )

        // Fetch deliverables + Meta spend in parallel (both need deal/link IDs from above)
        const dealIds = mappedDeals.map(d => d.id)
        const linkedIds = rawLinks.map(l => l.ads_campaign_id)

        const [deliverablesRes, adsRes] = await Promise.all([
          dealIds.length > 0
            ? supabase.from('influencer_deliverables').select('status').in('deal_id', dealIds)
            : Promise.resolve({ data: [], error: null }),
          linkedIds.length > 0
            ? supabase.from('ads_data').select('spend').eq('workspace_id', workspaceId).in('campaign_id', linkedIds)
            : Promise.resolve({ data: [], error: null }),
        ])

        if (cancelled as boolean) return

        const stats = ((deliverablesRes.data ?? []) as { status: string }[]).reduce<DeliverableStats>(
          (acc, row) => {
            const s = row.status as keyof Omit<DeliverableStats, 'total'>
            if (s in acc) acc[s] += 1
            acc.total += 1
            return acc
          },
          { posted: 0, pending: 0, late: 0, no_show: 0, total: 0 }
        )

        const metaTotal = ((adsRes.data ?? []) as { spend: number }[]).reduce(
          (sum, r) => sum + r.spend, 0
        )

        setCampaign(campRes.data)
        setDeals(mappedDeals)
        setAdLinks(rawLinks)
        setDeliverableStats(stats)
        setTotalInfluencerSpend(influencerTotal)
        setTotalMetaSpend(metaTotal)
        setLoading(false)
      }
    )

    return () => { cancelled = true }
  }, [workspaceId, campaignId, tick])

  return {
    campaign,
    deals,
    adLinks,
    deliverableStats,
    totalInfluencerSpend,
    totalMetaSpend,
    loading,
    error,
    refetch: () => { setTick(t => t + 1) },
  }
}
