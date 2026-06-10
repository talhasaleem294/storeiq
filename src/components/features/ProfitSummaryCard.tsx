import { Area, AreaChart, ResponsiveContainer } from 'recharts'

import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

interface ProfitSummaryCardProps {
  label: string
  value: string
  trend?: number
  loading?: boolean
  highlight?: boolean
  sparklineData?: number[]
}

export function ProfitSummaryCard({
  label,
  value,
  trend,
  loading = false,
  highlight = false,
  sparklineData,
}: ProfitSummaryCardProps): JSX.Element {
  if (loading) {
    return (
      <Card padding="md">
        <Skeleton className="mb-2 h-3 w-1/3" />
        <Skeleton className="mb-2 h-7 w-2/3" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </Card>
    )
  }

  const trendVariant =
    trend === undefined
      ? undefined
      : trend >= 0
        ? 'success'
        : 'error'

  const hasSparkline = sparklineData !== undefined && sparklineData.length > 1
  const sparklineColor = hasSparkline && sparklineData[sparklineData.length - 1] >= sparklineData[0]
    ? '#22c55e'
    : '#ef4444'

  const sparklinePoints = hasSparkline
    ? sparklineData.map((v, i) => ({ i, v }))
    : []

  return (
    <Card
      padding="md"
      className={highlight ? 'border-accent/30 bg-accent-bg/30' : undefined}
    >
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text">{label}</p>
      <p className="mb-2 text-2xl font-bold text-heading">{value}</p>
      {trend !== undefined && trendVariant && (
        <Badge variant={trendVariant}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </Badge>
      )}
      {hasSparkline && (
        <div className="mt-3 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklinePoints} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${sparklineColor.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={sparklineColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={sparklineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={sparklineColor}
                strokeWidth={1.5}
                fill={`url(#spark-${sparklineColor.slice(1)})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
