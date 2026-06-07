import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type {
  DealWithDeliverables,
  Influencer,
  InfluencerDeliverable,
} from '@/types/app'

interface UseInfluencerDetailReturn {
  influencer: Influencer | null
  deals: DealWithDeliverables[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useInfluencerDetail(
  workspaceId: string,
  influencerId: string,
): UseInfluencerDetailReturn {
  const [influencer, setInfluencer] = useState<Influencer | null>(null)
  const [deals, setDeals] = useState<DealWithDeliverables[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!workspaceId || !influencerId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const influencerQ = supabase
      .from('influencers')
      .select('id, workspace_id, name, platform, handle, niche, follower_count, notes, created_at')
      .eq('id', influencerId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
      .overrideTypes<Influencer | null, { merge: false }>()

    // Fetch deals and their deliverables in one query using nested select
    const dealsQ = supabase
      .from('influencer_deals')
      .select(`
        id, workspace_id, influencer_id, campaign_id, deal_date,
        total_amount, advance_paid, balance_due, product_value,
        payment_method, promo_code, notes, created_at,
        deliverables:influencer_deliverables (
          id, deal_id, workspace_id, content_type, amount,
          due_date, posted_at, post_url, status, notes, created_at
        )
      `)
      .eq('influencer_id', influencerId)
      .eq('workspace_id', workspaceId)
      .order('deal_date', { ascending: false })

    void Promise.all([influencerQ, dealsQ]).then(([infRes, dealRes]) => {
      if (cancelled) return

      const err = infRes.error ?? dealRes.error
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      const inf = infRes.data
      setInfluencer(inf)

      const rawDeals = (dealRes.data ?? []) as Array<Record<string, unknown>>
      const enriched: DealWithDeliverables[] = rawDeals.map(d => ({
        id:             d['id'] as string,
        workspace_id:   d['workspace_id'] as string,
        influencer_id:  d['influencer_id'] as string,
        campaign_id:    d['campaign_id'] as string | null,
        deal_date:      d['deal_date'] as string,
        total_amount:   d['total_amount'] as number,
        advance_paid:   d['advance_paid'] as number,
        balance_due:    d['balance_due'] as number,
        product_value:  d['product_value'] as number,
        payment_method: d['payment_method'] as DealWithDeliverables['payment_method'],
        promo_code:     d['promo_code'] as string | null,
        notes:          d['notes'] as string | null,
        created_at:     d['created_at'] as string,
        deliverables:   (d['deliverables'] ?? []) as InfluencerDeliverable[],
        influencer: {
          id:       influencerId,
          name:     inf?.name ?? '',
          platform: inf?.platform ?? null,
          handle:   inf?.handle ?? null,
        },
      }))

      setDeals(enriched)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [workspaceId, influencerId, tick])

  return {
    influencer,
    deals,
    loading,
    error,
    refetch: () => { setTick(t => t + 1) },
  }
}
