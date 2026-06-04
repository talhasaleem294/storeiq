import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useWorkspaceList } from '@/hooks/useWorkspaceList'
import { useWorkspaceMutations } from '@/hooks/useWorkspaceMutations'
import { BANK_DETAILS, PLAN_PRICES, ROUTES, WHATSAPP_NUMBER } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

const PENDING_PLAN_KEY = 'storeiq_pending_plan'

export function Workspaces(): JSX.Element {
  const navigate = useNavigate()
  const { workspaces, loading, refetch } = useWorkspaceList()
  const { createWorkspace, loading: creating } = useWorkspaceMutations()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  // Plan selected on the landing page — survives the email confirmation redirect
  const pendingPlan = localStorage.getItem(PENDING_PLAN_KEY)
  const pendingPrice = pendingPlan ? (PLAN_PRICES[pendingPlan] ?? null) : null

  // Clear the pending plan from localStorage once any workspace is active
  useEffect(() => {
    if (workspaces.some((ws) => ws.subscription_status === 'active')) {
      localStorage.removeItem(PENDING_PLAN_KEY)
    }
  }, [workspaces])

  // Show banner when a workspace exists and isn't active yet, or when user
  // just signed up and hasn't created a workspace yet but has a pending plan
  const showBanner =
    !loading &&
    (workspaces.some((ws) => ws.subscription_status !== 'active') ||
      (workspaces.length === 0 && pendingPlan !== null))

  const whatsappMessage = encodeURIComponent(
    `Hi, I have transferred ${pendingPrice ?? 'the plan amount'} for the ${pendingPlan ?? ''} plan. Receipt attached.`,
  )
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`

  async function handleCreate(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    setCreateError(null)
    try {
      const ws = await createWorkspace(name.trim(), pendingPlan)
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
          className="text-sm text-text transition-colors hover:text-heading"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">

        {/* Pending activation banner */}
        {showBanner && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">⏳</span>
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Account pending activation
              </h2>
            </div>

            {(pendingPlan ?? pendingPrice) && (
              <p className="mb-3 text-sm text-amber-800 dark:text-amber-300">
                Transfer{' '}
                <strong>{pendingPrice ?? 'your plan amount'}</strong> to activate your{' '}
                <strong className="capitalize">{pendingPlan}</strong> plan:
              </p>
            )}

            <div className="mb-4 space-y-1 rounded-lg border border-amber-200 bg-white/60 px-4 py-3 text-sm dark:border-amber-700 dark:bg-black/20">
              <div className="flex justify-between gap-4">
                <span className="text-amber-700 dark:text-amber-400">Bank</span>
                <span className="font-medium text-amber-900 dark:text-amber-200">{BANK_DETAILS.bankName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-amber-700 dark:text-amber-400">Account Title</span>
                <span className="font-medium text-amber-900 dark:text-amber-200">{BANK_DETAILS.accountTitle}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-amber-700 dark:text-amber-400">Account No.</span>
                <span className="font-medium text-amber-900 dark:text-amber-200">{BANK_DETAILS.accountNumber}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-amber-700 dark:text-amber-400">IBAN</span>
                <span className="font-medium text-amber-900 dark:text-amber-200">{BANK_DETAILS.iban}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.134.559 4.133 1.535 5.867L0 24l6.335-1.535A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.016-1.38l-.36-.214-3.73.904.921-3.648-.236-.374A9.818 9.818 0 1112 21.818z" />
                </svg>
                WhatsApp your receipt
              </a>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                We activate your account within 24 hours.
              </p>
            </div>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Your workspaces</h1>
            <p className="mt-1 text-sm text-text">Each workspace represents one Shopify store.</p>
          </div>
          {!showCreate && (
            <Button variant="primary" size="sm" onClick={() => { setShowCreate(true) }}>
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
                onChange={(e) => { setName(e.target.value) }}
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
            action={{ label: '+ New workspace', onClick: () => { setShowCreate(true) } }}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => { void navigate(ROUTES.APP.DASHBOARD(ws.id)) }}
                className="group rounded-xl border border-border bg-bg p-4 text-left shadow-sm transition-all duration-150 hover:border-accent/50 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-bg text-sm font-bold text-accent">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      ws.subscription_status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : ws.subscription_status === 'trial'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {ws.subscription_status}
                  </span>
                </div>
                <p className="mt-3 font-semibold text-heading transition-colors group-hover:text-accent">
                  {ws.name}
                </p>
                {ws.selected_plan && (
                  <p className="mt-0.5 text-xs text-text capitalize">{ws.selected_plan} plan</p>
                )}
                <p className="mt-0.5 text-xs text-text">Open dashboard →</p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
