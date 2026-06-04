import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { PLAN_PRICES, ROUTES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import type { AdminWorkspace, SubscriptionStatus } from '@/types/app'

type ActionState = Record<string, boolean> // workspaceId → loading

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

export function Admin(): JSX.Element {
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([])
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [actionState, setActionState] = useState<ActionState>({})

  const fetchAll = useCallback(async (): Promise<void> => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_get_all_workspaces')

    if (error) {
      if (error.message.includes('Unauthorized')) {
        setUnauthorized(true)
      }
      setLoading(false)
      return
    }

    setWorkspaces((data as AdminWorkspace[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])

  async function handleSetStatus(workspaceId: string, newStatus: SubscriptionStatus): Promise<void> {
    setActionState((prev) => ({ ...prev, [workspaceId]: true }))

    const { error } = await supabase.rpc('admin_set_subscription_status', {
      target_workspace_id: workspaceId,
      new_status: newStatus,
    })

    if (!error) {
      // Optimistically update local state for instant feedback
      setWorkspaces((prev) =>
        prev.map((ws) =>
          ws.id === workspaceId ? { ...ws, subscription_status: newStatus } : ws,
        ),
      )
    }

    setActionState((prev) => ({ ...prev, [workspaceId]: false }))
  }

  async function handleSignOut(): Promise<void> {
    await supabase.auth.signOut()
    void navigate(ROUTES.LOGIN, { replace: true })
  }

  if (unauthorized) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-bg px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl dark:bg-red-900/30">
            🔒
          </div>
          <h1 className="mb-2 text-lg font-bold text-heading">Access Denied</h1>
          <p className="mb-6 text-sm text-text">
            You do not have permission to view this page.
          </p>
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
          <span className="rounded-full bg-accent-bg px-2 py-0.5 text-xs font-medium text-accent">
            Admin
          </span>
        </div>
        <button
          onClick={() => void handleSignOut()}
          className="text-sm text-text transition-colors hover:text-heading"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-heading">Workspaces</h1>
            <p className="mt-0.5 text-sm text-text">
              {loading ? '—' : `${workspaces.length} total`}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void fetchAll()} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-xl border border-border bg-bg py-16 text-center">
            <p className="text-sm text-text">No workspaces yet.</p>
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
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {workspaces.map((ws) => {
                    const busy = actionState[ws.id] === true
                    const planPrice = ws.selected_plan ? (PLAN_PRICES[ws.selected_plan] ?? null) : null
                    return (
                      <tr key={ws.id} className="bg-bg transition-colors hover:bg-surface/50">
                        <td className="px-4 py-3 font-medium text-heading">{ws.name}</td>
                        <td className="px-4 py-3 text-text">{ws.owner_email}</td>
                        <td className="px-4 py-3">
                          {ws.selected_plan ? (
                            <span className="capitalize text-text">
                              {ws.selected_plan}
                              {planPrice && (
                                <span className="ml-1 text-xs text-text/60">({planPrice})</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-text/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[ws.subscription_status]}`}>
                            {ws.subscription_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text">{formatDate(ws.created_at)}</td>
                        <td className="px-4 py-3">
                          {ws.subscription_status !== 'active' ? (
                            <Button
                              variant="primary"
                              size="sm"
                              loading={busy}
                              onClick={() => void handleSetStatus(ws.id, 'active')}
                            >
                              Activate
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              size="sm"
                              loading={busy}
                              onClick={() => void handleSetStatus(ws.id, 'inactive')}
                            >
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
              {workspaces.map((ws) => {
                const busy = actionState[ws.id] === true
                const planPrice = ws.selected_plan ? (PLAN_PRICES[ws.selected_plan] ?? null) : null
                return (
                  <div key={ws.id} className="rounded-xl border border-border bg-bg p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-heading">{ws.name}</p>
                        <p className="text-xs text-text">{ws.owner_email}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[ws.subscription_status]}`}>
                        {ws.subscription_status}
                      </span>
                    </div>
                    <div className="mb-3 flex items-center justify-between text-xs text-text">
                      <span className="capitalize">
                        {ws.selected_plan ?? '—'}
                        {planPrice && <span className="ml-1 text-text/60">({planPrice})</span>}
                      </span>
                      <span>{formatDate(ws.created_at)}</span>
                    </div>
                    {ws.subscription_status !== 'active' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        loading={busy}
                        className="w-full"
                        onClick={() => void handleSetStatus(ws.id, 'active')}
                      >
                        Activate
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        loading={busy}
                        className="w-full"
                        onClick={() => void handleSetStatus(ws.id, 'inactive')}
                      >
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
