import type { AdsData, Order } from '@/types/app'

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
