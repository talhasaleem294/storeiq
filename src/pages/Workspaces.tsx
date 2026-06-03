import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useWorkspaceList } from '@/hooks/useWorkspaceList'
import { useWorkspaceMutations } from '@/hooks/useWorkspaceMutations'
import { ROUTES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

export function Workspaces(): JSX.Element {
  const navigate = useNavigate()
  const { workspaces, loading, refetch } = useWorkspaceList()
  const { createWorkspace, loading: creating } = useWorkspaceMutations()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  async function handleCreate(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    setCreateError(null)
    try {
      const ws = await createWorkspace(name.trim())
      setName('')
      setShowCreate(false)
      refetch()
      void navigate(ROUTES.APP.DASHBOARD(ws.id))
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create workspace')
    }
  }

  async function handleSignOut(): Promise<void> {
    await supabase.auth.signOut()
    void navigate(ROUTES.LOGIN, { replace: true })
  }

  return (
    <div className="min-h-svh bg-bg">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-8">
        <span className="text-base font-bold text-accent">StoreIQ</span>
        <button
          onClick={() => void handleSignOut()}
          className="text-sm text-text hover:text-heading transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Your workspaces</h1>
            <p className="mt-1 text-sm text-text">Each workspace represents one Shopify store.</p>
          </div>
          {!showCreate && (
            <Button variant="primary" size="sm" onClick={() => { setShowCreate(true); }}>
              + New workspace
            </Button>
          )}
        </div>

        {/* Create form */}
        {showCreate && (
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="mb-6 rounded-xl border border-accent/30 bg-accent-bg/20 p-4"
          >
            <p className="mb-3 text-sm font-medium text-heading">Create new workspace</p>
            {createError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Brand A Store"
                value={name}
                onChange={(e) => { setName(e.target.value); }}
                required
                className="flex-1"
              />
              <Button type="submit" variant="primary" loading={creating} disabled={!name.trim()}>
                Create
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setShowCreate(false); setName(''); setCreateError(null) }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Workspace list */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : workspaces.length === 0 ? (
          <EmptyState
            title="No workspaces yet"
            description="Create your first workspace to connect a Shopify store."
            action={{ label: '+ New workspace', onClick: () => { setShowCreate(true); } }}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => { void navigate(ROUTES.APP.DASHBOARD(ws.id)) }}
                className="group rounded-xl border border-border bg-bg p-4 text-left shadow-sm hover:border-accent/50 hover:shadow-md transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-bg text-sm font-bold text-accent">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-text capitalize">
                    {ws.subscription_status}
                  </span>
                </div>
                <p className="mt-3 font-semibold text-heading group-hover:text-accent transition-colors">
                  {ws.name}
                </p>
                <p className="mt-0.5 text-xs text-text">Open dashboard →</p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
