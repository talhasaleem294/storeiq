import type { ReactNode } from 'react'

import { APP_NAME } from '@/lib/constants'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps): JSX.Element {
  return (
    <div className="min-h-svh flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold text-accent">{APP_NAME}</span>
          <h1 className="mt-4 text-2xl font-semibold text-heading tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-text">{subtitle}</p>}
        </div>
        <div className="rounded-xl border border-border bg-bg shadow-sm p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
