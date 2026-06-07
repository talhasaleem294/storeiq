import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { CampaignAdLink, InfluencerDeal, MarketingCampaign } from '@/types/app'

interface UseCampaignDetailReturn {
  campaign: MarketingCampaign | null
  deals: InfluencerDeal[]
  adLinks: CampaignAdLink[]
  totalInfluencerSpend: number
  totalMetaSpend: number
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useCampaignDetail(
  workspaceId: string,
  campaignId: string,
): UseCampaignDetailReturn {
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null)
  const [deals, setDeals] = useState<InfluencerDeal[]>([])
  const [adLinks, setAdLinks] = useState<CampaignAdLink[]>([])
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
        payment_method, promo_code, notes, created_at
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

        const rawDeals = (dealRes.data ?? []) as InfluencerDeal[]
        const rawLinks = (linkRes.data ?? []) as CampaignAdLink[]

        const influencerTotal = rawDeals.reduce(
          (sum, d) => sum + d.total_amount + d.product_value, 0
        )

        // Pull Meta spend for linked campaigns
        let metaTotal = 0
        if (rawLinks.length > 0) {
          const linkedIds = rawLinks.map(l => l.ads_campaign_id)
          const { data: adsRows } = await supabase
            .from('ads_data')
            .select('spend')
            .eq('workspace_id', workspaceId)
            .in('campaign_id', linkedIds)
          metaTotal = ((adsRows ?? []) as { spend: number }[]).reduce(
            (sum, r) => sum + r.spend, 0
          )
        }

        setCampaign(campRes.data)
        setDeals(rawDeals)
        setAdLinks(rawLinks)
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
    totalInfluencerSpend,
    totalMetaSpend,
    loading,
    error,
    refetch: () => { setTick(t => t + 1) },
  }
}
