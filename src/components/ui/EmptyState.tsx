import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-text">
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-base font-semibold text-heading">{title}</h3>
      {description && <p className="mb-6 max-w-sm text-sm text-text">{description}</p>}
      {action && (
        <Button
          variant="primary"
          onClick={action.onClick}
          size="sm"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
