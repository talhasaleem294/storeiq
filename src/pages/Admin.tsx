import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { PLAN_PRICES, ROUTES, TRIAL_DAYS } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import type { AdminWorkspace, SubscriptionStatus } from '@/types/app'

type ActionState = Record<string, boolean>
type SortDir = 'none' | 'asc' | 'desc'

const STATUS_ORDER: Record<SubscriptionStatus, number> = { active: 0, trial: 1, inactive: 2 }

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  active:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  trial:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  inactive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function trialDaysLeft(ws: AdminWorkspace): number | null {
  if (ws.subscription_status !== 'trial' || !ws.trial_started_at) return null
  const elapsed = Math.floor((Date.now() - new Date(ws.trial_started_at).getTime()) / 86_400_000)
  return Math.max(0, TRIAL_DAYS - elapsed)
}

export function Admin(): JSX.Element {
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([])
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [actionState, setActionState] = useState<ActionState>({})
  const [filter, setFilter] = useState('')
  const [sortDir, setSortDir] = useState<SortDir>('none')

  const fetchAll = useCallback(async (): Promise<void> => {
    setLoading(true)
    const rpcResult = await supabase.rpc('admin_get_all_workspaces')

    if (rpcResult.error) {
      if (rpcResult.error.message.includes('Unauthorized')) setUnauthorized(true)
      setLoading(false)
      return
    }

    const safe = Array.isArray(rpcResult.data)
      ? (rpcResult.data as unknown as AdminWorkspace[])
      : []
    setWorkspaces(safe)
    setLoading(false)
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])

  const filtered = useMemo(() => {
    const q = filter.toLowerCase()
    let list = q
      ? workspaces.filter(w =>
          w.name.toLowerCase().includes(q) ||
          w.owner_email.toLowerCase().includes(q)
        )
      : [...workspaces]

    if (sortDir !== 'none') {
      list = list.sort((a, b) => {
        const diff = STATUS_ORDER[a.subscription_status] - STATUS_ORDER[b.subscription_status]
        return sortDir === 'asc' ? diff : -diff
      })
    }
    return list
  }, [workspaces, filter, sortDir])

  function cycleSortDir(): void {
    setSortDir(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none')
  }

  const sortIcon = sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '↕'

  async function handleSetStatus(workspaceId: string, newStatus: SubscriptionStatus): Promise<void> {
    setActionState(prev => ({ ...prev, [workspaceId]: true }))
    const { error } = await supabase.rpc('admin_set_subscription_status', {
      target_workspace_id: workspaceId,
      new_status: newStatus,
    })
    if (!error) {
      setWorkspaces(prev =>
        prev.map(ws => ws.id === workspaceId ? { ...ws, subscription_status: newStatus } : ws)
      )
    }
    setActionState(prev => ({ ...prev, [workspaceId]: false }))
  }

  async function handleSignOut(): Promise<void> {
    await supabase.auth.signOut()
    void navigate(ROUTES.LOGIN, { replace: true })
  }

  const totalCount  = workspaces.length
  const activeCount = workspaces.filter(w => w.subscription_status === 'active').length
  const trialCount  = workspaces.filter(w => w.subscription_status === 'trial').length

  if (unauthorized) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-bg px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl dark:bg-red-900/30">
            🔒
          </div>
          <h1 className="mb-2 text-lg font-bold text-heading">Access Denied</h1>
          <p className="mb-6 text-sm text-text">You do not have permission to view this page.</p>
          <Button variant="secondary" onClick={() => void navigate(ROUTES.WORKSPACES)}>
            Back to workspaces
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-bg">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-accent">StoreIQ</span>
          <span className="rounded-full bg-accent-bg px-2 py-0.5 text-xs font-medium text-accent">Admin</span>
        </div>
        <button
          onClick={() => void handleSignOut()}
          className="text-sm text-text transition-colors hover:text-heading"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">

        {/* Summary stats */}
        {!loading && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-bg p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text">Total Workspaces</p>
              <p className="mt-1 text-3xl font-bold text-heading">{String(totalCount)}</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/10">
              <p className="text-xs font-medium uppercase tracking-wide text-green-700 dark:text-green-400">Active</p>
              <p className="mt-1 text-3xl font-bold text-green-800 dark:text-green-300">{String(activeCount)}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Trial</p>
              <p className="mt-1 text-3xl font-bold text-amber-800 dark:text-amber-300">{String(trialCount)}</p>
            </div>
          </div>
        )}

        {/* Page title + actions */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-heading">Workspaces</h1>
            <p className="mt-0.5 text-sm text-text">
              {loading ? '—' : `${String(filtered.length)} of ${String(totalCount)}`}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void fetchAll()} disabled={loading}>
            Refresh
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search by workspace name or owner email…"
            value={filter}
            onChange={e => { setFilter(e.target.value) }}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-heading placeholder:text-text/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {filter && (
            <button
              onClick={() => { setFilter('') }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text hover:text-heading min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-bg py-16 text-center">
            <p className="text-sm text-text">
              {filter ? 'No workspaces match your search.' : 'No workspaces yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Workspace</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">
                      <button
                        onClick={cycleSortDir}
                        className="flex items-center gap-1 hover:text-heading min-h-[44px]"
                      >
                        Status <span className="text-text/60">{sortIcon}</span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((ws) => {
                    const busy = actionState[ws.id]
                    const planPrice = ws.selected_plan ? (PLAN_PRICES[ws.selected_plan] ?? null) : null
                    const daysLeft = trialDaysLeft(ws)
                    return (
                      <tr key={ws.id} className="bg-bg transition-colors hover:bg-surface/50">
                        <td className="px-4 py-3 font-medium text-heading">{ws.name}</td>
                        <td className="px-4 py-3 text-text">{ws.owner_email}</td>
                        <td className="px-4 py-3">
                          {ws.selected_plan ? (
                            <span className="capitalize text-text">
                              {ws.selected_plan}
                              {planPrice && <span className="ml-1 text-xs text-text/60">({planPrice})</span>}
                            </span>
                          ) : (
                            <span className="text-text/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[ws.subscription_status]}`}>
                              {ws.subscription_status}
                            </span>
                            {daysLeft !== null && (
                              <span className={`text-xs ${daysLeft === 0 ? 'text-red-600 dark:text-red-400' : 'text-text/60'}`}>
                                {daysLeft === 0 ? 'Expired' : `${String(daysLeft)}d left`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text">{formatDate(ws.created_at)}</td>
                        <td className="px-4 py-3">
                          {ws.subscription_status !== 'active' ? (
                            <Button variant="primary" size="sm" loading={busy} onClick={() => void handleSetStatus(ws.id, 'active')}>
                              Activate
                            </Button>
                          ) : (
                            <Button variant="danger" size="sm" loading={busy} onClick={() => void handleSetStatus(ws.id, 'inactive')}>
                              Deactivate
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filtered.map((ws) => {
                const busy = actionState[ws.id]
                const planPrice = ws.selected_plan ? (PLAN_PRICES[ws.selected_plan] ?? null) : null
                const daysLeft = trialDaysLeft(ws)
                return (
                  <div key={ws.id} className="rounded-xl border border-border bg-bg p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-heading">{ws.name}</p>
                        <p className="text-xs text-text">{ws.owner_email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[ws.subscription_status]}`}>
                          {ws.subscription_status}
                        </span>
                        {daysLeft !== null && (
                          <span className={`text-xs ${daysLeft === 0 ? 'text-red-600 dark:text-red-400' : 'text-text/60'}`}>
                            {daysLeft === 0 ? 'Expired' : `${String(daysLeft)}d left`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mb-3 flex items-center justify-between text-xs text-text">
                      <span className="capitalize">
                        {ws.selected_plan ?? '—'}
                        {planPrice && <span className="ml-1 text-text/60">({planPrice})</span>}
                      </span>
                      <span>{formatDate(ws.created_at)}</span>
                    </div>
                    {ws.subscription_status !== 'active' ? (
                      <Button variant="primary" size="sm" loading={busy} className="w-full" onClick={() => void handleSetStatus(ws.id, 'active')}>
                        Activate
                      </Button>
                    ) : (
                      <Button variant="danger" size="sm" loading={busy} className="w-full" onClick={() => void handleSetStatus(ws.id, 'inactive')}>
                        Deactivate
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
