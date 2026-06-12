import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { InsightBanner } from '@/components/ui/InsightBanner'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { useDeliverablesDueThisWeek } from '@/hooks/useDeliverablesDueThisWeek'
import { useInfluencerData } from '@/hooks/useInfluencerData'
import { useWorkspaceRole } from '@/hooks/useWorkspaceRole'
import { ROUTES } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { hasPermission } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import type { InfluencerNiche, InfluencerPlatform } from '@/types/app'

const PLATFORMS: { value: InfluencerPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'other',     label: 'Other' },
]

const NICHES: { value: InfluencerNiche; label: string }[] = [
  { value: 'fashion',   label: 'Fashion' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'beauty',    label: 'Beauty' },
  { value: 'tech',      label: 'Tech' },
  { value: 'food',      label: 'Food' },
  { value: 'other',     label: 'Other' },
]

function platformLabel(p: InfluencerPlatform | null): string {
  if (!p) return '—'
  return PLATFORMS.find(x => x.value === p)?.label ?? p
}

export function Influencers(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { influencers, insights, loading } = useInfluencerData(workspaceId ?? '')
  const { deliverables: dueThisWeek } = useDeliverablesDueThisWeek(workspaceId ?? '')
  const { role } = useWorkspaceRole(workspaceId ?? '')
  const canManage = hasPermission(role, 'influencers:manage')

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [search, setSearch] = useState('')

  const [name, setName] = useState('')
  const [platform, setPlatform] = useState<InfluencerPlatform | ''>('')
  const [handle, setHandle] = useState('')
  const [niche, setNiche] = useState<InfluencerNiche | ''>('')
  const [followerCount, setFollowerCount] = useState('')
  const [notes, setNotes] = useState('')

  function resetForm(): void {
    setName('')
    setPlatform('')
    setHandle('')
    setNiche('')
    setFollowerCount('')
    setNotes('')
    setFormError(null)
  }

  async function handleSave(): Promise<void> {
    if (!name.trim()) { setFormError('Name is required'); return }
    setSaving(true)
    setFormError(null)

    const { error } = await supabase.from('influencers').insert({
      workspace_id:   workspaceId,
      name:           name.trim(),
      platform:       platform || null,
      handle:         handle.trim() || null,
      niche:          niche || null,
      follower_count: followerCount ? parseInt(followerCount, 10) : null,
      notes:          notes.trim() || null,
    })

    setSaving(false)
    if (error) {
      setFormError(error.message.includes('unique') ? 'An influencer with this handle already exists.' : error.message)
    } else {
      resetForm()
      setShowForm(false)
      // useInfluencerData re-fetches on its own interval; trigger via parent refetch if available
      if (typeof (influencers as unknown as { refetch?: () => void }).refetch === 'function') {
        (influencers as unknown as { refetch: () => void }).refetch()
      }
      window.location.reload()
    }
  }

  // Overdue deliverables across all influencers (need workspace-level query — done via insights)
  // The insight gives us the count; actual list needs a separate lightweight query which we
  // surface on the InfluencerDetail page. Here we show the count as a chip.

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-heading">Influencers</h1>
          <p className="mt-0.5 text-sm text-text">Track your PR partnerships, deals, and deliverables.</p>
        </div>
        {canManage && (
          <Button variant="primary" size="sm" onClick={() => { setShowForm(s => !s) }}>
            {showForm ? 'Cancel' : '+ Add Influencer'}
          </Button>
        )}
      </div>

      {/* Add Influencer Form */}
      {showForm && canManage && (
        <Card padding="md">
          <h2 className="mb-4 text-sm font-semibold text-heading">New Influencer</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Name *"
              value={name}
              onChange={e => { setName(e.target.value) }}
              placeholder="Sara Khan"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-heading">Platform</label>
              <select
                value={platform}
                onChange={e => { setPlatform(e.target.value as InfluencerPlatform | '') }}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Select platform</option>
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <Input
              label="Handle"
              value={handle}
              onChange={e => { setHandle(e.target.value) }}
              placeholder="@sarakhann"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-heading">Niche</label>
              <select
                value={niche}
                onChange={e => { setNiche(e.target.value as InfluencerNiche | '') }}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Select niche</option>
                {NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </div>
            <Input
              label="Follower Count"
              value={followerCount}
              onChange={e => { setFollowerCount(e.target.value) }}
              placeholder="180000"
              type="number"
            />
            <Input
              label="Notes"
              value={notes}
              onChange={e => { setNotes(e.target.value) }}
              placeholder="Any notes about this influencer"
            />
          </div>
          {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => { void handleSave() }} loading={saving}>Save Influencer</Button>
          </div>
        </Card>
      )}

      {/* Due This Week */}
      {dueThisWeek.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Due This Week
          </p>
          <div className="space-y-2">
            {dueThisWeek.slice(0, 5).map(d => {
              const today = new Date().toISOString().slice(0, 10)
              const isOverdue = d.due_date < today
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-medium text-heading">{d.influencer_name}</span>
                  {d.influencer_handle && (
                    <span className="text-text">{d.influencer_handle}</span>
                  )}
                  <span className="capitalize text-text">{d.content_type.replace('_', ' ')}</span>
                  <span className="text-text">{formatDate(d.due_date)}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${
                    isOverdue
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>
                    {isOverdue ? 'Overdue' : 'Due soon'}
                  </span>
                </div>
              )
            })}
          </div>
          {dueThisWeek.length > 5 && (
            <p className="mt-2 text-xs text-text">{String(dueThisWeek.length - 5)} more deliverables due this week.</p>
          )}
        </div>
      )}

      {/* InsightBanner — overdue deliverables */}
      {(() => {
        const today = new Date().toISOString().slice(0, 10)
        const overdueCount = dueThisWeek.filter(d => d.due_date < today).length
        if (overdueCount === 0) return null
        return (
          <InsightBanner
            dismissKey={`storeiq_insight_dismissed_${workspaceId ?? ''}_influencers`}
            variant="warning"
            message={`${String(overdueCount)} deliverable${overdueCount === 1 ? '' : 's'} are overdue — follow up before the campaign window closes`}
          />
        )
      })()}

      {/* Search */}
      {!loading && influencers.length > 0 && (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value) }}
            placeholder="Search by name, handle, or niche…"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 pr-8 text-sm text-heading placeholder:text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {search && (
            <button
              onClick={() => { setSearch('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex min-h-[44px] min-w-[44px] items-center justify-center text-text hover:text-heading"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Insights row */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
            <span className="text-text">Total Spend</span>
            <span className="font-semibold text-heading">{formatCurrency(insights.totalCommittedSpend)}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
            <span className="text-text">Deals</span>
            <span className="font-semibold text-heading">{String(insights.totalDeals)}</span>
          </div>
          {insights.totalDeals > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs">
              <span className="text-text">Delivery Rate</span>
              <span className={`font-semibold ${insights.deliveryRate >= 80 ? 'text-green-600' : insights.deliveryRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {insights.deliveryRate.toFixed(0)}%
              </span>
            </div>
          )}
          {insights.overdueCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs dark:border-red-800 dark:bg-red-900/20">
              <span className="text-red-700 dark:text-red-300">⚠ Overdue</span>
              <span className="font-semibold text-red-800 dark:text-red-200">{String(insights.overdueCount)} deliverable{insights.overdueCount === 1 ? '' : 's'}</span>
            </div>
          )}
          {insights.ghostCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs dark:border-amber-800 dark:bg-amber-900/20">
              <span className="text-amber-700 dark:text-amber-300">👻 Ghosts</span>
              <span className="font-semibold text-amber-800 dark:text-amber-200">{String(insights.ghostCount)} deal{insights.ghostCount === 1 ? '' : 's'} with zero posts</span>
            </div>
          )}
        </div>
      )}

      {/* Influencer Directory */}
      {loading ? (
        <SkeletonTable />
      ) : (() => {
        const q = search.toLowerCase()
        const filtered = search
          ? influencers.filter(i =>
              i.name.toLowerCase().includes(q) ||
              (i.handle ?? '').toLowerCase().includes(q) ||
              (i.niche ?? '').toLowerCase().includes(q)
            )
          : influencers

        if (influencers.length === 0) {
          return (
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              }
              title="No influencers yet"
              description="Add your first influencer to start tracking deals and deliverables."
              action={canManage ? { label: '+ Add Influencer', onClick: () => { setShowForm(true) } } : undefined}
            />
          )
        }

        if (filtered.length === 0) {
          return (
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              }
              title="No influencers match your search"
              description="Try a different name, handle, or niche."
            />
          )
        }

        return (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs font-medium uppercase tracking-wide text-text">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Platform</th>
                  <th className="px-4 py-3 text-left">Handle</th>
                  <th className="px-4 py-3 text-left">Niche</th>
                  <th className="px-4 py-3 text-right">Followers</th>
                  <th className="px-4 py-3 text-right">Deals</th>
                  <th className="px-4 py-3 text-right">Total Spend</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(inf => (
                  <tr key={inf.id} className="hover:bg-surface/50">
                    <td className="px-4 py-3 font-medium text-heading">{inf.name}</td>
                    <td className="px-4 py-3 text-text">{platformLabel(inf.platform)}</td>
                    <td className="px-4 py-3 text-text">{inf.handle ?? '—'}</td>
                    <td className="px-4 py-3 capitalize text-text">{inf.niche ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-text">
                      {inf.follower_count ? inf.follower_count.toLocaleString('en-PK') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-text">{String(inf.dealCount)}</td>
                    <td className="px-4 py-3 text-right font-medium text-heading">
                      {inf.totalSpend > 0 ? formatCurrency(inf.totalSpend) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={ROUTES.APP.INFLUENCERS(workspaceId ?? '') + '/' + inf.id}
                        className="text-xs text-accent hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map(inf => (
              <Card key={inf.id} padding="md">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-heading">{inf.name}</p>
                    <p className="mt-0.5 text-xs text-text">
                      {platformLabel(inf.platform)}{inf.handle ? ` · ${inf.handle}` : ''}
                      {inf.niche ? ` · ${inf.niche}` : ''}
                    </p>
                  </div>
                  <Link
                    to={ROUTES.APP.INFLUENCERS(workspaceId ?? '') + '/' + inf.id}
                    className="text-xs text-accent hover:underline"
                  >
                    View →
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-surface px-2 py-1">
                    {String(inf.dealCount)} deal{inf.dealCount === 1 ? '' : 's'}
                  </span>
                  {inf.totalSpend > 0 && (
                    <span className="rounded-full bg-surface px-2 py-1 font-medium text-heading">
                      {formatCurrency(inf.totalSpend)}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
        )
      })()}
    </div>
  )
}
