import { useCashFlowCalendar } from '@/hooks/useCashFlowCalendar'
import { formatCurrency } from '@/lib/formatters'

interface CashFlowCalendarProps {
  workspaceId: string
}

export function CashFlowCalendar({ workspaceId }: CashFlowCalendarProps): JSX.Element {
  const { weeks, loading } = useCashFlowCalendar(workspaceId)

  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="min-w-[110px] flex-1 animate-pulse rounded-xl border border-border bg-surface p-3 h-28" />
        ))}
      </div>
    )
  }

  if (weeks.length === 0) return <></>

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {weeks.map((week) => {
        const isCurrentWeek = !week.isPast && week.weekStart <= new Date() && new Date() <= week.weekEnd
        const cashAmount = week.isPast ? week.codReceived : week.estimatedIncoming
        const isPositive = week.netCash >= 0
        return (
          <div
            key={week.weekLabel}
            className={`min-w-[110px] flex-1 rounded-xl border p-3 ${
              isCurrentWeek
                ? 'border-accent bg-accent/5'
                : week.isPast
                  ? 'border-border bg-surface'
                  : 'border-border bg-bg'
            }`}
          >
            <p className={`mb-1 text-xs font-medium ${isCurrentWeek ? 'text-accent' : 'text-text'}`}>
              {isCurrentWeek ? '▶ ' : ''}{week.weekLabel}
            </p>
            <p className="text-xs text-text">{week.isPast ? 'Received' : 'Est. incoming'}</p>
            <p className="text-sm font-semibold text-heading">{formatCurrency(cashAmount)}</p>
            {week.adSpendEstimate > 0 && (
              <>
                <p className="mt-1 text-xs text-text">Meta spend</p>
                <p className="text-xs font-medium text-red-600 dark:text-red-400">-{formatCurrency(week.adSpendEstimate)}</p>
              </>
            )}
            <div className={`mt-2 border-t border-border pt-1.5 text-xs font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              Net: {isPositive ? '' : '-'}{formatCurrency(Math.abs(week.netCash))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
