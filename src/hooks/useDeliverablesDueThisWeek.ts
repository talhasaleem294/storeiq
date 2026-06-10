import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { ContentType, DeliverableStatus } from '@/types/app'

export interface DueDeliverable {
  id: string
  content_type: ContentType
  due_date: string
  status: DeliverableStatus
  influencer_name: string
  influencer_handle: string | null
  deal_id: string
}

interface RawRow {
  id: string
  content_type: ContentType
  due_date: string
  status: DeliverableStatus
  deal_id: string
  influencer_deals: {
    influencers: {
      name: string
      handle: string | null
    }
  }
}

export function useDeliverablesDueThisWeek(workspaceId: string): {
  deliverables: DueDeliverable[]
  loading: boolean
} {
  const [deliverables, setDeliverables] = useState<DueDeliverable[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false
    setLoading(true)

    const today = new Date().toISOString().slice(0, 10)
    const sevenDaysLater = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

    void supabase
      .from('influencer_deliverables')
      .select(`
        id, content_type, due_date, status, deal_id,
        influencer_deals!inner(
          influencers!inner(name, handle)
        )
      `)
      .eq('workspace_id', workspaceId)
      .in('status', ['pending', 'late'])
      .gte('due_date', today)
      .lte('due_date', sevenDaysLater)
      .order('due_date', { ascending: true })
      .limit(10)
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error) {
          const rows = (data as unknown as RawRow[] | null ?? []).map(row => ({
            id: row.id,
            content_type: row.content_type,
            due_date: row.due_date,
            status: row.status,
            deal_id: row.deal_id,
            influencer_name: row.influencer_deals.influencers.name,
            influencer_handle: row.influencer_deals.influencers.handle,
          }))
          setDeliverables(rows)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId])

  return { deliverables, loading }
}
