import { useState } from 'react'

import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDailyProfitCalendar } from '@/hooks/useDailyProfitCalendar'
import { formatCurrency } from '@/lib/formatters'

interface ProfitCalendarProps {
  workspaceId: string
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function dayBgClass(netProfit: number, maxAbsProfit: number): string {
  if (maxAbsProfit === 0) return 'bg-surface text-text'
  const ratio = Math.abs(netProfit) / maxAbsProfit
  if (netProfit > 0) {
    if (ratio > 0.6) return 'bg-green-500 text-white'
    if (ratio > 0.25) return 'bg-green-300 text-green-900'
    return 'bg-green-100 text-green-800'
  }
  if (netProfit < 0) {
    if (ratio > 0.6) return 'bg-red-300 text-red-900'
    return 'bg-red-100 text-red-800'
  }
  return 'bg-surface text-text'
}

export function ProfitCalendar({ workspaceId }: ProfitCalendarProps): JSX.Element {
  const now = new Date()
  const [offset, setOffset] = useState<0 | -1>(0)

  const year = offset === -1
    ? (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())
    : now.getFullYear()
  const month = offset === -1
    ? (now.getMonth() === 0 ? 11 : now.getMonth() - 1)
    : now.getMonth()

  const { days, loading } = useDailyProfitCalendar(workspaceId, year, month)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Day-of-week offset: Monday = 0 in our header, but Date.getDay() uses Sunday = 0
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  // Convert Sunday-based (0=Sun) to Monday-based (0=Mon)
  const leadingBlanks = (firstDayOfWeek + 6) % 7

  const allDayValues = Array.from(days.values())
  const maxAbsProfit = allDayValues.reduce((max, d) => Math.max(max, Math.abs(d.netProfit)), 0)

  const totalDays = new Date(year, month + 1, 0).getDate()
  const dayKeys = Array.from(days.keys()).sort()

  return (
    <Card padding="md">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-heading">Profit Calendar</h3>
        <div className="flex overflow-hidden rounded-lg border border-border text-xs">
          <button
            onClick={() => { setOffset(-1) }}
            className={`min-h-[32px] px-3 py-1 transition-colors ${
              offset === -1 ? 'bg-accent text-white' : 'bg-bg text-text hover:bg-surface'
            }`}
          >
            Last month
          </button>
          <button
            onClick={() => { setOffset(0) }}
            className={`min-h-[32px] px-3 py-1 transition-colors ${
              offset === 0 ? 'bg-accent text-white' : 'bg-bg text-text hover:bg-surface'
            }`}
          >
            This month
          </button>
        </div>
      </div>

      <p className="mb-3 text-xs text-text">{monthLabel}</p>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DAY_HEADERS.map(h => (
          <div key={h} className="text-center text-[10px] font-medium text-text">{h}</div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="h-10 rounded" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`empty-${String(i)}`} aria-hidden="true" />
          ))}
          {dayKeys.map(key => {
            const day = days.get(key)
            if (!day) return null
            const dayNum = Number(key.slice(8, 10))
            const cls = dayBgClass(day.netProfit, maxAbsProfit)
            return (
              <button
                key={key}
                onClick={() => { setSelectedDay(key) }}
                title={`${key}: ${formatCurrency(day.netProfit)}`}
                className={`flex h-10 flex-col items-center justify-center rounded text-[10px] transition-opacity hover:opacity-80 ${cls}`}
              >
                <span className="font-medium">{String(dayNum)}</span>
              </button>
            )
          })}
          {/* Trailing blanks to complete last week row */}
          {Array.from({ length: (7 - ((leadingBlanks + totalDays) % 7)) % 7 }, (_, i) => (
            <div key={`trail-${String(i)}`} aria-hidden="true" />
          ))}
        </div>
      )}

      {/* Day detail popover */}
      {selectedDay !== null && (() => {
        const detail = days.get(selectedDay)
        if (!detail) return null
        return (
          <div
            className="fixed inset-0 z-40 flex items-end justify-center sm:items-center"
            onClick={() => { setSelectedDay(null) }}
          >
            <div
              className="w-full max-w-sm"
              onClick={e => { e.stopPropagation() }}
            >
              <Card padding="md">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-heading">{selectedDay}</p>
                  <button
                    onClick={() => { setSelectedDay(null) }}
                    className="min-h-[44px] min-w-[44px] text-text hover:text-heading"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text">Revenue</span>
                    <span className="font-semibold text-heading">{formatCurrency(detail.revenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text">Ad Spend</span>
                    <span className="font-semibold text-heading">{formatCurrency(detail.adSpend)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-sm">
                    <span className="font-medium text-text">Net Profit</span>
                    <span className={`font-bold ${detail.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(detail.netProfit)}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )
      })()}
    </Card>
  )
}
