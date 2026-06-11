import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ProfitSummaryCard } from '@/components/features/ProfitSummaryCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SkeletonPage } from '@/components/ui/Skeleton'
import { useCampaignDetail } from '@/hooks/useCampaignDetail'
import { useWorkspaceRole } from '@/hooks/useWorkspaceRole'
import { ROUTES } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { hasPermission } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import type { AdsData, CampaignStatus } from '@/types/app'

function statusBadgeVariant(status: CampaignStatus): 'success' | 'warning' | 'neutral' | 'error' {
  if (status === 'active')    return 'success'
  if (status === 'planned')   return 'neutral'
  if (status === 'completed') return 'success'
  return 'error'
}

const INPUT_CLS = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent'

export function CampaignDetail(): JSX.Element {
  const { workspaceId, campaignId } = useParams<{ workspaceId: string; campaignId: string }>()
  const {
    campaign,
    deals,
    adLinks,
    deliverableStats,
    totalInfluencerSpend,
    totalMetaSpend,
    loading,
    error,
    refetch,
  } = useCampaignDetail(workspaceId ?? '', campaignId ?? '')
  const { role } = useWorkspaceRole(workspaceId ?? '')
  const canManage = hasPermission(role, 'influencers:manage')

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState<CampaignStatus>('planned')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Available Meta campaigns for linking
  const [availableAdCampaigns, setAvailableAdCampaigns] = useState<Pick<AdsData, 'campaign_id' | 'campaign_name'>[]>([])
  const [linkingAdId, setLinkingAdId] = useState('')
  const [linkSaving, setLinkSaving] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    void supabase
      .from('ads_data')
      .select('campaign_id, campaign_name')
      .eq('workspace_id', workspaceId)
      .then(({ data }) => {
        if (!data) return
        const seen = new Set<string>()
        const unique = (data as Pick<AdsData, 'campaign_id' | 'campaign_name'>[]).filter(r => {
          if (seen.has(r.campaign_id)) return false
          seen.add(r.campaign_id)
          return true
        })
        setAvailableAdCampaigns(unique)
      })
  }, [workspaceId])

  function openEdit(): void {
    if (!campaign) return
    setEditName(campaign.name)
    setEditStatus(campaign.status)
    setEditStartDate(campaign.start_date ?? '')
    setEditEndDate(campaign.end_date ?? '')
    setEditNotes(campaign.notes ?? '')
    setEditing(true)
  }

  async function saveCampaign(): Promise<void> {
    if (!editName.trim()) return
    setSaving(true)
    await supabase
      .from('marketing_campaigns')
      .update({
        name:       editName.trim(),
        status:     editStatus,
        start_date: editStartDate || null,
        end_date:   editEndDate || null,
        notes:      editNotes.trim() || null,
      })
      .eq('id', campaignId ?? '')
    setSaving(false)
    setEditing(false)
    refetch()
  }

  async function linkAdCampaign(): Promise<void> {
    if (!linkingAdId) return
    setLinkSaving(true)
    setLinkError(null)
    const found = availableAdCampaigns.find(c => c.campaign_id === linkingAdId)
    const { error: err } = await supabase.from('campaign_ad_links').insert({
      campaign_id:       campaignId,
      workspace_id:      workspaceId,
      ads_campaign_id:   linkingAdId,
      ads_campaign_name: found?.campaign_name ?? null,
    })
    setLinkSaving(false)
    if (err) { setLinkError(err.message.includes('unique') ? 'Already linked.' : err.message) }
    else { setLinkingAdId(''); refetch() }
  }

  async function unlinkAdCampaign(linkId: string): Promise<void> {
    await supabase.from('campaign_ad_links').delete().eq('id', linkId)
    refetch()
  }

  async function deleteCampaign(): Promise<void> {
    if (!confirm('Delete this campaign? Deals will be unlinked but not deleted.')) return
    await supabase.from('marketing_campaigns').delete().eq('id', campaignId ?? '')
    window.history.back()
  }

  if (loading) return <SkeletonPage />

  if (error || !campaign) {
    return (
      <div className="py-16 text-center text-sm text-text">
        {error ?? 'Campaign not found.'}
      </div>
    )
  }

  const combinedSpend = totalInfluencerSpend + totalMetaSpend
  const alreadyLinkedIds = new Set(adLinks.map(l => l.ads_campaign_id))
  const unlinkable = availableAdCampaigns.filter(c => !alreadyLinkedIds.has(c.campaign_id))

  // Deliverables bar segment widths
  const total = deliverableStats.total
  const pct = (n: number): string => total > 0 ? `${((n / total) * 100).toFixed(2)}%` : '0%'

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        to={ROUTES.APP.CAMPAIGNS(workspaceId ?? '')}
        className="text-xs text-accent hover:underline"
      >
        ← Campaigns
      </Link>

      {/* Header — view or edit mode */}
      {editing ? (
        <div className="space-y-3">
          <input
            className={INPUT_CLS}
            value={editName}
            onChange={e => { setEditName(e.target.value) }}
            placeholder="Campaign name"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-heading">Status</label>
              <select
                value={editStatus}
                onChange={e => { setEditStatus(e.target.value as CampaignStatus) }}
                className={INPUT_CLS}
              >
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-heading">Start Date</label>
              <input type="date" className={INPUT_CLS} value={editStartDate} onChange={e => { setEditStartDate(e.target.value) }} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-heading">End Date</label>
              <input type="date" className={INPUT_CLS} value={editEndDate} onChange={e => { setEditEndDate(e.target.value) }} />
            </div>
          </div>
          <input
            className={INPUT_CLS}
            value={editNotes}
            onChange={e => { setEditNotes(e.target.value) }}
            placeholder="Notes (optional)"
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => { void saveCampaign() }} loading={saving}>
              Save
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setEditing(false) }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-heading">{campaign.name}</h1>
              <Badge variant={statusBadgeVariant(campaign.status)}>{campaign.status}</Badge>
            </div>
            {(campaign.start_date ?? campaign.end_date) && (
              <p className="mt-1 text-sm text-text">
                {campaign.start_date ? formatDate(campaign.start_date) : '?'}
                {' → '}
                {campaign.end_date ? formatDate(campaign.end_date) : 'ongoing'}
              </p>
            )}
            {campaign.notes && <p className="mt-1 text-xs text-text italic">{campaign.notes}</p>}
          </div>
          {canManage && (
            <div className="flex items-center gap-3">
              <button onClick={openEdit} className="text-xs text-accent hover:underline">
                Edit
              </button>
              <button onClick={() => { void deleteCampaign() }} className="text-xs text-text hover:text-red-600">
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ProfitSummaryCard label="Influencer Spend" value={formatCurrency(totalInfluencerSpend)} loading={loading} />
        <ProfitSummaryCard label="Meta Ad Spend"    value={formatCurrency(totalMetaSpend)}       loading={loading} />
        <ProfitSummaryCard label="Combined Spend"   value={formatCurrency(combinedSpend)}        loading={loading} highlight />
      </div>

      {/* Deliverables summary */}
      {deliverableStats.total > 0 && (
        <Card padding="md">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text">Deliverables</p>

          {/* Progress bar */}
          <div className="flex h-2 w-full overflow-hidden rounded-full">
            <div className="bg-green-500 transition-all duration-500" style={{ width: pct(deliverableStats.posted) }} />
            <div className="bg-amber-400 transition-all duration-500" style={{ width: pct(deliverableStats.pending) }} />
            <div className="bg-red-500 transition-all duration-500"   style={{ width: pct(deliverableStats.late) }} />
            <div className="flex-1 bg-border" />
          </div>

          {/* Chips */}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 dark:border-green-800 dark:bg-green-900/20">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span className="text-green-700 dark:text-green-300">Posted</span>
              <span className="font-semibold text-green-800 dark:text-green-200">{String(deliverableStats.posted)}</span>
            </span>
            {deliverableStats.pending > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 dark:border-amber-800 dark:bg-amber-900/20">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span className="text-amber-700 dark:text-amber-300">Pending</span>
                <span className="font-semibold text-amber-800 dark:text-amber-200">{String(deliverableStats.pending)}</span>
              </span>
            )}
            {deliverableStats.late > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 dark:border-red-800 dark:bg-red-900/20">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span className="text-red-700 dark:text-red-300">Late</span>
                <span className="font-semibold text-red-800 dark:text-red-200">{String(deliverableStats.late)}</span>
              </span>
            )}
            {deliverableStats.no_show > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-text/40" />
                <span className="text-text">No-show</span>
                <span className="font-semibold text-heading">{String(deliverableStats.no_show)}</span>
              </span>
            )}
            <span className="flex items-center gap-1 px-1 text-text">
              {String(deliverableStats.posted)} / {String(deliverableStats.total)} delivered
            </span>
          </div>
        </Card>
      )}

      {/* Section 1 — Influencer Deals */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-heading">Influencer Deals</h2>
        {deals.length === 0 ? (
          <p className="text-sm text-text">
            No deals linked to this campaign yet.{' '}
            <Link to={ROUTES.APP.INFLUENCERS(workspaceId ?? '')} className="text-accent hover:underline">
              Go to Influencers
            </Link>
            {' '}to log a deal and select this campaign.
          </p>
        ) : (
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs font-medium uppercase tracking-wide text-text">
                  <th className="px-4 py-3 text-left">Influencer</th>
                  <th className="px-4 py-3 text-left">Deal Date</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Advance</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-left">Promo Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deals.map(deal => (
                  <tr key={deal.id} className="hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <Link
                        to={ROUTES.APP.INFLUENCERS(workspaceId ?? '') + '/' + deal.influencer_id}
                        className="font-medium text-heading hover:text-accent hover:underline"
                      >
                        {deal.influencer_name}
                      </Link>
                      {deal.influencer_handle && (
                        <p className="text-xs text-text">{deal.influencer_handle}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text">{formatDate(deal.deal_date)}</td>
                    <td className="px-4 py-3 text-right font-medium text-heading">
                      {formatCurrency(deal.total_amount + deal.product_value)}
                    </td>
                    <td className="px-4 py-3 text-right text-text">{formatCurrency(deal.advance_paid)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${deal.balance_due > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {formatCurrency(deal.balance_due)}
                    </td>
                    <td className="px-4 py-3">
                      {deal.promo_code
                        ? <span className="font-mono text-xs text-blue-700 dark:text-blue-300">{deal.promo_code}</span>
                        : <span className="text-text">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile deal cards */}
        {deals.length > 0 && (
          <div className="space-y-3 md:hidden">
            {deals.map(deal => (
              <Card key={deal.id} padding="md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <Link
                      to={ROUTES.APP.INFLUENCERS(workspaceId ?? '') + '/' + deal.influencer_id}
                      className="text-sm font-semibold text-heading hover:text-accent hover:underline"
                    >
                      {deal.influencer_name}
                    </Link>
                    {deal.influencer_handle && (
                      <p className="text-xs text-text">{deal.influencer_handle}</p>
                    )}
                  </div>
                  <span className="font-semibold text-accent text-sm">{formatCurrency(deal.total_amount + deal.product_value)}</span>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-text">{formatDate(deal.deal_date)}</span>
                  <span className="text-text">Advance: <span className="font-medium text-heading">{formatCurrency(deal.advance_paid)}</span></span>
                  <span className={deal.balance_due > 0 ? 'text-amber-600' : 'text-green-600'}>
                    Bal: {formatCurrency(deal.balance_due)}
                  </span>
                </div>
                {deal.promo_code && (
                  <p className="mt-1 font-mono text-xs text-blue-700 dark:text-blue-300">{deal.promo_code}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Section 2 — Linked Meta Campaigns */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-heading">Linked Meta Campaigns</h2>

        {adLinks.length === 0 && !canManage && (
          <p className="text-sm text-text">No Meta campaigns linked.</p>
        )}

        {adLinks.length > 0 && (
          <div className="mb-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs font-medium uppercase tracking-wide text-text">
                  <th className="px-4 py-3 text-left">Campaign Name</th>
                  <th className="px-4 py-3 text-left">Campaign ID</th>
                  {canManage && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {adLinks.map(link => (
                  <tr key={link.id} className="hover:bg-surface/50">
                    <td className="px-4 py-3 font-medium text-heading">{link.ads_campaign_name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text">{link.ads_campaign_id}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { void unlinkAdCampaign(link.id) }}
                          className="text-xs text-text hover:text-red-600"
                        >
                          Unlink
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage && unlinkable.length > 0 && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-heading">Link Meta Campaign</label>
              <select
                value={linkingAdId}
                onChange={e => { setLinkingAdId(e.target.value) }}
                className={INPUT_CLS}
              >
                <option value="">Select campaign…</option>
                {unlinkable.map(c => (
                  <option key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { void linkAdCampaign() }}
              loading={linkSaving}
              disabled={!linkingAdId}
            >
              + Link
            </Button>
          </div>
        )}
        {linkError && <p className="mt-2 text-xs text-red-600">{linkError}</p>}
      </div>
    </div>
  )
}
