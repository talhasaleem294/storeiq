import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps): JSX.Element {
  return (
    <div
      className={clsx(
        'animate-pulse rounded bg-border',
        className
      )}
    />
  )
}

export function SkeletonCard(): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-bg p-4 shadow-sm">
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-8 w-1/2" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  )
}

export function SkeletonPage(): JSX.Element {
  return (
    <div className="flex min-h-svh items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

interface SkeletonTableProps {
  rows?: number
}

export function SkeletonTable({ rows = 5 }: SkeletonTableProps): JSX.Element {
  return (
    <div className="space-y-2">
      {/* Desktop table header */}
      <div className="hidden md:grid md:grid-cols-4 md:gap-4 rounded-lg bg-surface px-4 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-3/4" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>
          {/* Desktop row */}
          <div className="hidden md:grid md:grid-cols-4 md:gap-4 rounded-lg border border-border px-4 py-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
          {/* Mobile card */}
          <div className="md:hidden rounded-xl border border-border bg-bg p-3">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
