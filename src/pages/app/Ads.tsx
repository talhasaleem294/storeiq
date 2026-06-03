import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

import { ProfitSummaryCard } from '@/components/features/ProfitSummaryCard'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { useAdsData } from '@/hooks/useAdsData'
import { useMetaConnection } from '@/hooks/useMetaConnection'
import { ROUTES } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import { supabase } from '@/lib/supabase'

export function Ads(): JSX.Element {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { connection: metaConn, loading: connLoading } = useMetaConnection(workspaceId ?? '')
  const { campaigns, totals, loading: adsLoading } = useAdsData(workspaceId ?? '')
  const syncedRef = useRef(false)

  // Trigger a background sync when Meta is connected (once per session)
  useEffect(() => {
    if (!metaConn || syncedRef.current || !workspaceId) return
    syncedRef.current = true

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(
        `${String(import.meta.env.VITE_SUPABASE_URL)}/functions/v1/meta-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ workspaceId }),
        }
      )
    })()
  }, [metaConn, workspaceId])

  const loading = connLoading || adsLoading

  if (!connLoading && !metaConn) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <EmptyState
          title="Connect Meta Ads"
          description="Connect your Meta Ads account in Settings to see campaign performance here."
          action={{
            label: 'Go to Settings',
            onClick: () => {
              if (workspaceId) window.location.href = ROUTES.APP.SETTINGS(workspaceId)
            },
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-heading">Meta Ads</h1>
        <p className="mt-0.5 text-sm text-text">Ad spend, ROAS, and campaign performance.</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ProfitSummaryCard label="Total Spend" value={formatCurrency(totals.totalSpend)} loading={loading} />
        <ProfitSummaryCard label="Avg ROAS" value={`${totals.avgRoas.toFixed(2)}x`} loading={loading} />
        <ProfitSummaryCard label="Avg CTR" value={`${(totals.avgCtr * 100).toFixed(2)}%`} loading={loading} />
      </div>

      {/* Campaigns table */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-heading">Top Campaigns by Spend</h2>

        {loading ? (
          <SkeletonTable rows={5} />
        ) : campaigns.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              title="No Meta Ads data yet"
              description="Connect your Meta Ads account in Settings to see campaign performance here."
              action={{
                label: 'Connect Meta Ads',
                onClick: () => {
                  if (workspaceId) window.location.href = ROUTES.APP.SETTINGS(workspaceId)
                },
              }}
            />
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Campaign</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text">Spend</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text">ROAS</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text">CTR</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {campaigns.map((c) => (
                    <tr key={c.id} className="bg-bg hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-heading max-w-xs truncate">{c.campaign_name}</td>
                      <td className="px-4 py-3 text-right text-heading">{formatCurrency(c.spend)}</td>
                      <td className="px-4 py-3 text-right text-heading">{c.roas.toFixed(2)}x</td>
                      <td className="px-4 py-3 text-right text-heading">{(c.ctr * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3">
                        <Badge variant={c.roas >= 2 ? 'success' : c.roas >= 1 ? 'warning' : 'error'}>
                          {c.roas >= 2 ? 'Good' : c.roas >= 1 ? 'Break-even' : 'Losing'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {campaigns.map((c) => (
                <Card key={c.id} padding="md">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-sm font-semibold text-heading leading-tight">{c.campaign_name}</p>
                    <Badge variant={c.roas >= 2 ? 'success' : c.roas >= 1 ? 'warning' : 'error'}>
                      {c.roas >= 2 ? 'Good' : c.roas >= 1 ? 'Break-even' : 'Losing'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-text">Spend</p>
                      <p className="text-sm font-semibold text-heading">{formatCurrency(c.spend)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text">ROAS</p>
                      <p className="text-sm font-semibold text-heading">{c.roas.toFixed(2)}x</p>
                    </div>
                    <div>
                      <p className="text-xs text-text">CTR</p>
                      <p className="text-sm font-semibold text-heading">{(c.ctr * 100).toFixed(2)}%</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
