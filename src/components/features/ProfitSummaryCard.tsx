import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

interface ProfitSummaryCardProps {
  label: string
  value: string
  trend?: number
  loading?: boolean
  highlight?: boolean
}

export function ProfitSummaryCard({
  label,
  value,
  trend,
  loading = false,
  highlight = false,
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
    </Card>
  )
}
