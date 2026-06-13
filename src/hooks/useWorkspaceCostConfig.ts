import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

export interface WorkspaceCostConfig {
  cod_fee_flat: number
  cod_fee_karachi: number
  cod_fee_lahore: number
  cod_fee_islamabad: number
  cod_fee_other: number
  packaging_cost: number
  monthly_overheads: number
}

const DEFAULTS: WorkspaceCostConfig = {
  cod_fee_flat: 0,
  cod_fee_karachi: 0,
  cod_fee_lahore: 0,
  cod_fee_islamabad: 0,
  cod_fee_other: 0,
  packaging_cost: 0,
  monthly_overheads: 0,
}

interface UseCostConfigReturn {
  config: WorkspaceCostConfig
  loading: boolean
  saving: boolean
  update: (patch: Partial<WorkspaceCostConfig>) => Promise<void>
}

export function useWorkspaceCostConfig(workspaceId: string): UseCostConfigReturn {
  const [config, setConfig] = useState<WorkspaceCostConfig>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    setLoading(true)
    void supabase
      .from('workspace_cost_config')
      .select('cod_fee_flat,cod_fee_karachi,cod_fee_lahore,cod_fee_islamabad,cod_fee_other,packaging_cost,monthly_overheads')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setConfig(data)
        setLoading(false)
      })
  }, [workspaceId])

  const update = useCallback(async (patch: Partial<WorkspaceCostConfig>): Promise<void> => {
    setSaving(true)
    const merged = { ...config, ...patch }
    const { error } = await supabase
      .from('workspace_cost_config')
      .upsert({ workspace_id: workspaceId, ...merged, updated_at: new Date().toISOString() })
    if (!error) setConfig(merged)
    setSaving(false)
  }, [config, workspaceId])

  return { config, loading, saving, update }
}
