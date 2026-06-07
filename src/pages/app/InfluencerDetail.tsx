import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useCampaignData } from '@/hooks/useCampaignData'
import { useInfluencerDetail } from '@/hooks/useInfluencerDetail'
import { useWorkspaceRole } from '@/hooks/useWorkspaceRole'
import { ROUTES } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { hasPermission } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import type {
  ContentType,
  DeliverableStatus,
  PaymentMethod,
} from '@/types/app'

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'reel',           label: 'Reel' },
  { value: 'story',          label: 'Story' },
  { value: 'feed_post',      label: 'Feed Post' },
  { value: 'tiktok',         label: 'TikTok' },
  { value: 'youtube_video',  label: 'YouTube Video' },
  { value: 'youtube_short',  label: 'YouTube Short' },
  { value: 'live',           label: 'Live' },
  { value: 'other',          label: 'Other' },
]

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'easypaisa',     label: 'EasyPaisa' },
  { value: 'jazzcash',      label: 'JazzCash' },
  { value: 'cash',          label: 'Cash' },
  { value: 'barter',        label: 'Barter' },
  { value: 'other',         label: 'Other' },
]

function statusBadge(status: DeliverableStatus, dueDate: string | null): JSX.Element {
  const todayStr = new Date().toISOString().substring(0, 10)
  const isOverdue = status === 'pending' && dueDate !== null && dueDate < todayStr

  if (isOverdue) {
    const days = Math.floor(
      (new Date(todayStr).getTime() - new Date(dueDate).getTime()) / 86_400_000
    )
    return (
      <Badge variant="error">
        Overdue {String(days)}d
      </Badge>
    )
  }

  const map: Record<DeliverableStatus, 'neutral' | 'success' | 'warning' | 'error'> = {
    pending: 'neutral',
    posted:  'success',
    late:    'warning',
    no_show: 'error',
  }
  return <Badge variant={map[status]}>{status.replace('_', ' ')}</Badge>
}

function contentTypeLabel(ct: ContentType): string {
  return CONTENT_TYPES.find(x => x.value === ct)?.label ?? ct
}

function paymentMethodLabel(pm: PaymentMethod | null): string {
  if (!pm) return '—'
  return PAYMENT_METHODS.find(x => x.value === pm)?.label ?? pm
}

export function InfluencerDetail(): JSX.Element {
  const { workspaceId, influencerId } = useParams<{ workspaceId: string; influencerId: string }>()
  const { influencer, deals, loading, error, refetch } = useInfluencerDetail(
    workspaceId ?? '', influencerId ?? ''
  )
  const { campaigns } = useCampaignData(workspaceId ?? '')
  const { role } = useWorkspaceRole(workspaceId ?? '')
  const canManage = hasPermission(role, 'influencers:manage')

  // Deal form state
  const [showDealForm, setShowDealForm] = useState(false)
  const [dealSaving, setDealSaving] = useState(false)
  const [dealError, setDealError] = useState<string | null>(null)
  const [dealDate, setDealDate] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [advancePaid, setAdvancePaid] = useState('')
  const [productValue, setProductValue] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')
  const [promoCode, setPromoCode] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [dealNotes, setDealNotes] = useState('')

  // Deliverable form state (per deal)
  const [openDeliverableForm, setOpenDeliverableForm] = useState<string | null>(null)
  const [dvType, setDvType] = useState<ContentType | ''>('')
  const [dvAmount, setDvAmount] = useState('')
  const [dvDueDate, setDvDueDate] = useState('')
  const [dvNotes, setDvNotes] = useState('')
  const [dvSaving, setDvSaving] = useState(false)
  const [dvError, setDvError] = useState<string | null>(null)

  function resetDealForm(): void {
    setDealDate('')
    setTotalAmount('')
    setAdvancePaid('')
    setProductValue('')
    setPaymentMethod('')
    setPromoCode('')
    setCampaignId('')
    setDealNotes('')
    setDealError(null)
  }

  function resetDvForm(): void {
    setDvType('')
    setDvAmount('')
    setDvDueDate('')
    setDvNotes('')
    setDvError(null)
  }

  async function saveDeal(): Promise<void> {
    if (!dealDate) { setDealError('Deal date is required'); return }
    const total = parseFloat(totalAmount) || 0
    const advance = parseFloat(advancePaid) || 0
    if (advance > total) { setDealError('Advance paid cannot exceed total amount'); return }

    setDealSaving(true)
    setDealError(null)
    const { error: err } = await supabase.from('influencer_deals').insert({
      workspace_id:   workspaceId,
      influencer_id:  influencerId,
      campaign_id:    campaignId || null,
      deal_date:      dealDate,
      total_amount:   total,
      advance_paid:   advance,
      product_value:  parseFloat(productValue) || 0,
      payment_method: paymentMethod || null,
      promo_code:     promoCode.trim() || null,
      notes:          dealNotes.trim() || null,
    })
    setDealSaving(false)
    if (err) { setDealError(err.message) }
    else {
      resetDealForm()
      setShowDealForm(false)
      refetch()
    }
  }

  async function saveDeliverable(dealId: string): Promise<void> {
    if (!dvType) { setDvError('Content type is required'); return }
    setDvSaving(true)
    setDvError(null)
    const { error: err } = await supabase.from('influencer_deliverables').insert({
      deal_id:      dealId,
      workspace_id: workspaceId,
      content_type: dvType,
      amount:       parseFloat(dvAmount) || 0,
      due_date:     dvDueDate || null,
      status:       'pending',
      notes:        dvNotes.trim() || null,
    })
    setDvSaving(false)
    if (err) { setDvError(err.message) }
    else {
      resetDvForm()
      setOpenDeliverableForm(null)
      refetch()
    }
  }

  async function markDeliverable(
    deliverableId: string,
    status: DeliverableStatus,
    postUrl?: string,
  ): Promise<void> {
    await supabase
      .from('influencer_deliverables')
      .update({
        status,
        posted_at: status === 'posted' ? new Date().toISOString().substring(0, 10) : null,
        post_url:  postUrl ?? null,
      })
      .eq('id', deliverableId)
    refetch()
  }

  async function deleteDeal(dealId: string): Promise<void> {
    if (!confirm('Delete this deal and all its deliverables?')) return
    await supabase.from('influencer_deals').delete().eq('id', dealId)
    refetch()
  }

  if (loading) return <Skeleton variant="page" />

  if (error || !influencer) {
    return (
      <div className="py-16 text-center text-sm text-text">
        {error ?? 'Influencer not found.'}
      </div>
    )
  }

  const totalSpent = deals.reduce((s, d) => s + d.total_amount + d.product_value, 0)
  const totalBalance = deals.reduce((s, d) => s + d.balance_due, 0)
  const allDeliverables = deals.flatMap(d => d.deliverables)
  const posted = allDeliverables.filter(d => d.status === 'posted').length
  const deliveryRate = allDeliverables.length > 0
    ? Math.round((posted / allDeliverables.length) * 100)
    : null

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        to={ROUTES.APP.INFLUENCERS(workspaceId ?? '')}
        className="text-xs text-accent hover:underline"
      >
        ← Influencers
      </Link>

      {/* Header */}
      <Card padding="md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-heading">{influencer.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text">
              {influencer.handle && <span>{influencer.handle}</span>}
              {influencer.platform && (
                <span className="rounded-full bg-accent-bg px-2 py-0.5 text-accent capitalize">
                  {influencer.platform}
                </span>
              )}
              {influencer.niche && (
                <span className="rounded-full bg-surface px-2 py-0.5 capitalize">
                  {influencer.niche}
                </span>
              )}
              {influencer.follower_count && (
                <span>{influencer.follower_count.toLocaleString('en-PK')} followers</span>
              )}
            </div>
          </div>
        </div>
        {/* Summary chips */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-border bg-surface px-3 py-1.5">
            <span className="text-text">Total Spent </span>
            <span className="font-semibold text-heading">{formatCurrency(totalSpent)}</span>
          </span>
          <span className="rounded-full border border-border bg-surface px-3 py-1.5">
            <span className="text-text">Deals </span>
            <span className="font-semibold text-heading">{String(deals.length)}</span>
          </span>
          {deliveryRate !== null && (
            <span className="rounded-full border border-border bg-surface px-3 py-1.5">
              <span className="text-text">Delivery Rate </span>
              <span className={`font-semibold ${deliveryRate >= 80 ? 'text-green-600' : deliveryRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {String(deliveryRate)}%
              </span>
            </span>
          )}
          {totalBalance > 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 dark:border-amber-800 dark:bg-amber-900/20">
              <span className="text-amber-700 dark:text-amber-300">Balance Due </span>
              <span className="font-semibold text-amber-800 dark:text-amber-200">{formatCurrency(totalBalance)}</span>
            </span>
          )}
        </div>
      </Card>

      {/* Log New Deal button */}
      {canManage && (
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={() => { setShowDealForm(s => !s) }}>
            {showDealForm ? 'Cancel' : '+ Log New Deal'}
          </Button>
        </div>
      )}

      {/* New Deal Form */}
      {showDealForm && canManage && (
        <Card padding="md">
          <h2 className="mb-4 text-sm font-semibold text-heading">Log New Deal</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Deal Date *"
              type="date"
              value={dealDate}
              onChange={e => { setDealDate(e.target.value) }}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-heading">Campaign (optional)</label>
              <select
                value={campaignId}
                onChange={e => { setCampaignId(e.target.value) }}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">No campaign</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Input
              label="Total Amount (PKR)"
              type="number"
              value={totalAmount}
              onChange={e => { setTotalAmount(e.target.value) }}
              placeholder="20000"
            />
            <Input
              label="Advance Paid (PKR)"
              type="number"
              value={advancePaid}
              onChange={e => { setAdvancePaid(e.target.value) }}
              placeholder="8000"
            />
            <Input
              label="Product Value (PKR)"
              type="number"
              value={productValue}
              onChange={e => { setProductValue(e.target.value) }}
              placeholder="0"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-heading">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={e => { setPaymentMethod(e.target.value as PaymentMethod | '') }}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Select method</option>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <Input
              label="Promo Code"
              value={promoCode}
              onChange={e => { setPromoCode(e.target.value) }}
              placeholder="SARA10"
            />
            <Input
              label="Notes"
              value={dealNotes}
              onChange={e => { setDealNotes(e.target.value) }}
              placeholder="Paid advance via JazzCash, balance after posting"
            />
          </div>
          {dealError && <p className="mt-2 text-xs text-red-600">{dealError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowDealForm(false); resetDealForm() }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => { void saveDeal() }} loading={dealSaving}>Save Deal</Button>
          </div>
        </Card>
      )}

      {/* Deal Timeline */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-heading">Deal History</h2>
        {deals.length === 0 ? (
          <p className="text-sm text-text">No deals yet. Log the first deal above.</p>
        ) : (
          <div className="space-y-4">
            {deals.map(deal => {
              const balance = deal.balance_due
              return (
                <Card key={deal.id} padding="md">
                  {/* Deal header */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-heading text-sm">
                        {formatDate(deal.deal_date)}
                      </span>
                      <span className="rounded-full bg-accent-bg px-2 py-0.5 font-semibold text-accent">
                        {formatCurrency(deal.total_amount + deal.product_value)}
                      </span>
                      {deal.payment_method && (
                        <span className="rounded-full bg-surface px-2 py-0.5 text-text">
                          {paymentMethodLabel(deal.payment_method)}
                        </span>
                      )}
                      {deal.promo_code && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                          {deal.promo_code}
                        </span>
                      )}
                    </div>
                    {canManage && (
                      <button
                        onClick={() => { void deleteDeal(deal.id) }}
                        className="text-xs text-text hover:text-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Payment breakdown */}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-surface px-2 py-1">
                      <span className="text-text">Advance: </span>
                      <span className="font-medium text-heading">{formatCurrency(deal.advance_paid)}</span>
                    </span>
                    <span className={`rounded-full px-2 py-1 ${
                      balance > 0
                        ? 'bg-amber-50 dark:bg-amber-900/20'
                        : 'bg-green-50 dark:bg-green-900/20'
                    }`}>
                      <span className={balance > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}>
                        Balance: {formatCurrency(balance)}
                      </span>
                    </span>
                    {deal.product_value > 0 && (
                      <span className="rounded-full bg-surface px-2 py-1">
                        <span className="text-text">Products: </span>
                        <span className="font-medium text-heading">{formatCurrency(deal.product_value)}</span>
                      </span>
                    )}
                  </div>

                  {deal.notes && (
                    <p className="mt-2 text-xs text-text italic">{deal.notes}</p>
                  )}

                  {/* Deliverables */}
                  {deal.deliverables.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-text uppercase tracking-wide">Deliverables</p>
                      {deal.deliverables.map(dv => (
                        <div key={dv.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs">
                          <span className="font-medium text-heading">{contentTypeLabel(dv.content_type)}</span>
                          {dv.due_date && (
                            <span className="text-text">due {formatDate(dv.due_date)}</span>
                          )}
                          {statusBadge(dv.status, dv.due_date)}
                          {dv.post_url && (
                            <a
                              href={dv.post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent hover:underline"
                            >
                              View post ↗
                            </a>
                          )}
                          {canManage && dv.status === 'pending' && (
                            <div className="ml-auto flex gap-1">
                              <button
                                onClick={() => {
                                  const url = window.prompt('Post URL (optional):') ?? undefined
                                  void markDeliverable(dv.id, 'posted', url)
                                }}
                                className="rounded bg-green-100 px-2 py-0.5 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300"
                              >
                                ✓ Posted
                              </button>
                              <button
                                onClick={() => { void markDeliverable(dv.id, 'no_show') }}
                                className="rounded bg-red-100 px-2 py-0.5 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                              >
                                ✗ No-show
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Deliverable */}
                  {canManage && (
                    <div className="mt-3">
                      {openDeliverableForm === deal.id ? (
                        <div className="rounded-lg border border-border p-3 space-y-3">
                          <p className="text-xs font-medium text-heading">Add Deliverable</p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-heading">Type *</label>
                              <select
                                value={dvType}
                                onChange={e => { setDvType(e.target.value as ContentType | '') }}
                                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
                              >
                                <option value="">Select type</option>
                                {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <Input
                              label="Due Date"
                              type="date"
                              value={dvDueDate}
                              onChange={e => { setDvDueDate(e.target.value) }}
                            />
                            <Input
                              label="Amount (PKR)"
                              type="number"
                              value={dvAmount}
                              onChange={e => { setDvAmount(e.target.value) }}
                              placeholder="0"
                            />
                          </div>
                          <Input
                            label="Notes"
                            value={dvNotes}
                            onChange={e => { setDvNotes(e.target.value) }}
                            placeholder="Any notes"
                          />
                          {dvError && <p className="text-xs text-red-600">{dvError}</p>}
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => { setOpenDeliverableForm(null); resetDvForm() }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => { void saveDeliverable(deal.id) }}
                              loading={dvSaving}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setOpenDeliverableForm(deal.id); resetDvForm() }}
                          className="text-xs text-accent hover:underline"
                        >
                          + Add Deliverable
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
