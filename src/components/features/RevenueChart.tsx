import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Order } from '@/types/app'

interface ChartPoint {
  date: string
  revenue: number
  refunds: number
}

interface TooltipEntry {
  name: string
  value: number
  color: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps): JSX.Element | null {
  if (!active || !payload?.length) return null
  const dateLabel = label
    ? new Date(`${label}T00:00:00`).toLocaleDateString('en-PK', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : ''
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ fontWeight: 600, color: '#111827', marginBottom: 6 }}>{dateLabel}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color, margin: '2px 0' }}>
          {entry.name === 'revenue' ? 'Revenue' : 'Refunds'}:{' '}
          <span style={{ fontWeight: 600 }}>
            PKR {entry.value.toLocaleString('en-PK')}
          </span>
        </p>
      ))}
    </div>
  )
}

function formatShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return value.toFixed(0)
}

interface RevenueChartProps {
  orders: Order[]
  loading?: boolean
}

export function RevenueChart({ orders, loading = false }: RevenueChartProps): JSX.Element {
  const data = useMemo<ChartPoint[]>(() => {
    const map = new Map<string, ChartPoint>()
    for (const order of orders) {
      const date = order.created_at.substring(0, 10)
      const existing = map.get(date) ?? { date, revenue: 0, refunds: 0 }
      map.set(date, {
        date,
        revenue: existing.revenue + order.revenue,
        refunds: existing.refunds + order.refund_amount,
      })
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [orders])

  if (loading) {
    return (
      <Card padding="md">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="h-52 w-full rounded-lg" />
      </Card>
    )
  }

  if (data.length === 0) return <></>

  return (
    <Card padding="md">
      <h3 className="mb-4 text-sm font-semibold text-heading">Revenue vs Refunds</h3>
      <ResponsiveContainer width="100%" height={210}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradRefunds" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            tickFormatter={(v: string) =>
              new Date(`${v}T00:00:00`).toLocaleDateString('en-PK', {
                month: 'short',
                day: 'numeric',
              })
            }
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={formatShort}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#4f46e5"
            strokeWidth={2}
            fill="url(#gradRevenue)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="refunds"
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#gradRefunds)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center justify-center gap-6">
        <span className="flex items-center gap-1.5 text-xs text-text">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4f46e5]" />
          Revenue
        </span>
        <span className="flex items-center gap-1.5 text-xs text-text">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
          Refunds
        </span>
      </div>
    </Card>
  )
}
