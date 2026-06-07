import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useCampaignData } from '@/hooks/useCampaignData'
import { useWorkspaceRole } from '@/hooks/useWorkspaceRole'
import { ROUTES } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import { hasPermission } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import type { CampaignStatus, MarketingCampaign } from '@/types/app'

const STATUS_FILTERS: { value: CampaignStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'active',    label: 'Active' },
  { value: 'planned',   label: 'Planned' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function statusBadgeVariant(status: CampaignStatus): 'success' | 'warning' | 'neutral' | 'error' {
  if (status === 'active')    return 'success'
  if (status === 'planned')   return 'neutral'
  if (status === 'completed') return 'success'
  return 'error'
}

function cardBorder(status: CampaignStatus): string {
  if (status === 'active')    return 'border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-900/10'
  if (status === 'planned')   return 'border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-900/10'
  if (status === 'completed') return 'border-border bg-surface/30'
  return 'border-border bg-bg opacity-70'
}

export function Campaigns(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { campaigns, loading, refetch } = useCampaignData(workspaceId ?? '')
  const { role } = useWorkspaceRole(workspaceId ?? '')
  const canManage = hasPermission(role, 'influencers:manage')

  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [campName, setCampName] = useState('')
  const [campStart, setCampStart] = useState('')
  const [campEnd, setCampEnd] = useState('')
  const [campStatus, setCampStatus] = useState<CampaignStatus>('planned')
  const [campNotes, setCampNotes] = useState('')

  const filtered: MarketingCampaign[] = statusFilter === 'all'
    ? campaigns
    : campaigns.filter(c => c.status === statusFilter)

  function resetForm(): void {
    setCampName('')
    setCampStart('')
    setCampEnd('')
    setCampStatus('planned')
    setCampNotes('')
    setFormError(null)
  }

  async function saveCampaign(): Promise<void> {
    if (!campName.trim()) { setFormError('Campaign name is required'); return }
    setSaving(true)
    setFormError(null)
    const { error } = await supabase.from('marketing_campaigns').insert({
      workspace_id: workspaceId,
      name:         campName.trim(),
      start_date:   campStart || null,
      end_date:     campEnd || null,
      status:       campStatus,
      notes:        campNotes.trim() || null,
    })
    setSaving(false)
    if (error) { setFormError(error.message) }
    else { resetForm(); setShowForm(false); refetch() }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-heading">Campaigns</h1>
          <p className="mt-0.5 text-sm text-text">Group influencer deals and Meta ads under one marketing effort.</p>
        </div>
        {canManage && (
          <Button variant="primary" size="sm" onClick={() => { setShowForm(s => !s) }}>
            {showForm ? 'Cancel' : '+ New Campaign'}
          </Button>
        )}
      </div>

      {/* Create Campaign Form */}
      {showForm && canManage && (
        <Card padding="md">
          <h2 className="mb-4 text-sm font-semibold text-heading">New Campaign</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Campaign Name *"
              value={campName}
              onChange={e => { setCampName(e.target.value) }}
              placeholder="Eid 2025 Launch"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-heading">Status</label>
              <select
                value={campStatus}
                onChange={e => { setCampStatus(e.target.value as CampaignStatus) }}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <Input
              label="Start Date"
              type="date"
              value={campStart}
              onChange={e => { setCampStart(e.target.value) }}
            />
            <Input
              label="End Date"
              type="date"
              value={campEnd}
              onChange={e => { setCampEnd(e.target.value) }}
            />
            <div className="sm:col-span-2">
              <Input
                label="Notes"
                value={campNotes}
                onChange={e => { setCampNotes(e.target.value) }}
                placeholder="Any notes about this campaign"
              />
            </div>
          </div>
          {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => { void saveCampaign() }} loading={saving}>Save</Button>
          </div>
        </Card>
      )}

      {/* Status filter tabs */}
      <div className="flex overflow-hidden rounded-lg border border-border">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value) }}
            className={`min-h-[36px] px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-accent text-white'
                : 'bg-bg text-text hover:bg-surface'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton variant="page" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l19-9-9 19-2-8-8-2z" />
            </svg>
          }
          title={statusFilter === 'all' ? 'No campaigns yet' : `No ${statusFilter} campaigns`}
          description={statusFilter === 'all' ? 'Create a campaign to group your influencer deals and Meta ads.' : ''}
          action={canManage && statusFilter === 'all' ? { label: '+ New Campaign', onClick: () => { setShowForm(true) } } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(camp => (
            <div
              key={camp.id}
              className={`rounded-xl border p-4 ${cardBorder(camp.status)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-heading">{camp.name}</p>
                <Badge variant={statusBadgeVariant(camp.status)}>
                  {camp.status}
                </Badge>
              </div>

              {(camp.start_date || camp.end_date) && (
                <p className="mt-1 text-xs text-text">
                  {camp.start_date ? formatDate(camp.start_date) : '?'}
                  {' → '}
                  {camp.end_date ? formatDate(camp.end_date) : 'ongoing'}
                </p>
              )}

              {camp.notes && (
                <p className="mt-2 text-xs text-text italic line-clamp-2">{camp.notes}</p>
              )}

              <div className="mt-4 flex items-center justify-between">
                <Link
                  to={ROUTES.APP.CAMPAIGNS(workspaceId ?? '') + '/' + camp.id}
                  className="text-xs text-accent hover:underline"
                >
                  View details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
