import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

export interface CampaignHistoryRow {
  date: string
  roas: number
  spend: number
}

interface UseCampaignHistoryReturn {
  rows: CampaignHistoryRow[]
  loading: boolean
}

export function useCampaignHistory(
  workspaceId: string,
  campaignId: string | null,
): UseCampaignHistoryReturn {
  const [rows, setRows] = useState<CampaignHistoryRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!workspaceId || !campaignId) {
      setRows([])
      return
    }

    let cancelled = false
    setLoading(true)

    void supabase
      .from('ads_data')
      .select('date, roas, spend')
      .eq('workspace_id', workspaceId)
      .eq('campaign_id', campaignId)
      .order('date', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setRows((data ?? []) as CampaignHistoryRow[])
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [workspaceId, campaignId])

  return { rows, loading }
}
