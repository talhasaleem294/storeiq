import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { DateRange } from '@/types/app'

export interface CodRemittanceEntry {
  id: string
  amount: number
  received_at: string
  notes: string | null
  created_at: string
}

interface UseCodRemittanceLogReturn {
  entries: CodRemittanceEntry[]
  totalReceived: number
  loading: boolean
  inserting: boolean
  insertError: string | null
  insert: (amount: number, receivedAt: string, notes?: string) => Promise<void>
}

export function useCodRemittanceLog(
  workspaceId: string,
  dateRange?: DateRange,
): UseCodRemittanceLogReturn {
  const [entries, setEntries] = useState<CodRemittanceEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [inserting, setInserting] = useState<boolean>(false)
  const [insertError, setInsertError] = useState<string | null>(null)

  const fetchEntries = async (): Promise<void> => {
    if (!workspaceId) {
      setLoading(false)
      return
    }

    let query = supabase
      .from('cod_remittance_log')
      .select('id, amount, received_at, notes, created_at')
      .eq('workspace_id', workspaceId)
      .order('received_at', { ascending: false })

    if (dateRange?.from) query = query.gte('received_at', dateRange.from.slice(0, 10))
    if (dateRange?.to)   query = query.lte('received_at', dateRange.to.slice(0, 10))

    const { data, error } = await query
    if (!error) {
      setEntries(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, dateRange?.from, dateRange?.to])

  const totalReceived = entries.reduce((sum, e) => sum + e.amount, 0)

  const insert = async (amount: number, receivedAt: string, notes?: string): Promise<void> => {
    if (!workspaceId) return
    setInserting(true)
    setInsertError(null)

    const { error } = await supabase.from('cod_remittance_log').insert({
      workspace_id: workspaceId,
      amount,
      received_at: receivedAt,
      notes: notes ?? null,
    })

    if (error) {
      setInsertError(error.message)
    } else {
      await fetchEntries()
    }
    setInserting(false)
  }

  return { entries, totalReceived, loading, inserting, insertError, insert }
}
