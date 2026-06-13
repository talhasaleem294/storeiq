import type { RfmCustomer, RfmSegment } from '@/hooks/useCustomerRFM'
import type { AdsData, Influencer, InfluencerDeal, Order } from '@/types/app'

function downloadCSV(filename: string, rows: string[][]): void {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportOrdersCSV(orders: Order[]): void {
  const headers = ['Order ID', 'Revenue (PKR)', 'Refund (PKR)', 'Status', 'Date']
  const rows = orders.map((o) => [
    o.shopify_order_id,
    o.revenue.toFixed(2),
    o.refund_amount.toFixed(2),
    o.status,
    new Date(o.created_at).toLocaleDateString('en-PK'),
  ])
  downloadCSV('storeiq-orders.csv', [headers, ...rows])
}

export function exportDealsCSV(
  deals: InfluencerDeal[],
  influencerMap: Map<string, string>,
): void {
  const headers = [
    'Influencer', 'Deal Date', 'Total Amount (PKR)', 'Advance Paid (PKR)',
    'Balance Due (PKR)', 'Product Value (PKR)', 'Payment Method', 'Promo Code', 'Notes',
  ]
  const rows = deals.map(d => [
    influencerMap.get(d.influencer_id) ?? d.influencer_id,
    d.deal_date,
    d.total_amount.toFixed(2),
    d.advance_paid.toFixed(2),
    d.balance_due.toFixed(2),
    d.product_value.toFixed(2),
    d.payment_method ?? '',
    d.promo_code ?? '',
    d.notes ?? '',
  ])
  downloadCSV('storeiq-influencer-deals.csv', [headers, ...rows])
}

export function exportInfluencersCSV(
  influencers: Array<Influencer & { totalSpend: number; dealCount: number }>,
): void {
  const headers = ['Name', 'Platform', 'Handle', 'Niche', 'Followers', 'Deals', 'Total Spend (PKR)']
  const rows = influencers.map(inf => [
    inf.name,
    inf.platform ?? '',
    inf.handle ?? '',
    inf.niche ?? '',
    inf.follower_count ? String(inf.follower_count) : '',
    String(inf.dealCount),
    inf.totalSpend.toFixed(2),
  ])
  downloadCSV('storeiq-influencers.csv', [headers, ...rows])
}

export function exportTaxReportCSV(
  periodLabel: string,
  totalRevenue: number,
  totalRefunds: number,
  adSpend: number,
  influencerSpend: number,
): void {
  const netRevenue = totalRevenue - totalRefunds
  const totalMarketing = adSpend + influencerSpend
  const netTaxable = netRevenue - totalMarketing
  downloadCSV(`storeiq-tax-report-${periodLabel}.csv`, [
    ['Period', 'Gross Revenue (PKR)', 'Total Refunds (PKR)', 'Net Revenue (PKR)', 'Ad Spend (PKR)', 'Influencer Spend (PKR)', 'Total Marketing (PKR)', 'Net Taxable Income (PKR)'],
    [periodLabel, totalRevenue.toFixed(2), totalRefunds.toFixed(2), netRevenue.toFixed(2), adSpend.toFixed(2), influencerSpend.toFixed(2), totalMarketing.toFixed(2), netTaxable.toFixed(2)],
  ])
}

export function exportRFMSegmentCSV(segment: RfmSegment, customers: RfmCustomer[]): void {
  const label = segment.replace('_', '-')
  const headers = ['Customer ID', 'Last Order (days ago)', 'Order Count', 'Total Spend (PKR)', 'Segment']
  const rows = customers
    .filter(c => c.segment === segment)
    .map(c => [c.customer_id, String(c.lastOrderDaysAgo), String(c.orderCount), c.totalSpend.toFixed(2), segment])
  downloadCSV(`storeiq-rfm-${label}.csv`, [headers, ...rows])
}

export function exportCampaignsCSV(campaigns: AdsData[]): void {
  const headers = ['Campaign', 'Spend (USD)', 'ROAS', 'CTR (%)', 'Date']
  const rows = campaigns.map((c) => [
    c.campaign_name,
    c.spend.toFixed(2),
    c.roas.toFixed(4),
    (c.ctr * 100).toFixed(2),
    c.date,
  ])
  downloadCSV('storeiq-campaigns.csv', [headers, ...rows])
}
