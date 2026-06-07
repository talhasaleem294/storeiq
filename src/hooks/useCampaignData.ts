import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { MarketingCampaign } from '@/types/app'

interface UsecampaignDataReturn {
  campaigns: MarketingCampaign[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useCampaignData(workspaceId: string): UsecampaignDataReturn {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    void supabase
      .from('marketing_campaigns')
      .select('id, workspace_id, name, start_date, end_date, status, notes, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) { setError(err.message) }
        else { setCampaigns(data) }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [workspaceId, tick])

  return { campaigns, loading, error, refetch: () => { setTick(t => t + 1) } }
}
