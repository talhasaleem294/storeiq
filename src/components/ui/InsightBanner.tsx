import { useState } from 'react'
import { Link } from 'react-router-dom'

interface InsightBannerProps {
  message: string
  cta?: { label: string; href: string }
  variant?: 'info' | 'warning' | 'success'
  dismissKey: string
}

const VARIANT_CLASSES = {
  info:    'border-l-4 border-accent bg-accent-bg/20',
  warning: 'border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20',
  success: 'border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20',
} as const

const TEXT_CLASSES = {
  info:    'text-text',
  warning: 'text-amber-800 dark:text-amber-200',
  success: 'text-green-800 dark:text-green-200',
} as const

const CTA_CLASSES = {
  info:    'text-accent hover:underline',
  warning: 'text-amber-700 underline hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100',
  success: 'text-green-700 underline hover:text-green-900 dark:text-green-300 dark:hover:text-green-100',
} as const

export function InsightBanner({
  message,
  cta,
  variant = 'info',
  dismissKey,
}: InsightBannerProps): JSX.Element | null {
  const [dismissed, setDismissed] = useState<boolean>(
    () => localStorage.getItem(dismissKey) === '1',
  )

  if (dismissed) return null

  const handleDismiss = (): void => {
    localStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }

  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 ${VARIANT_CLASSES[variant]}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 text-sm ${TEXT_CLASSES[variant]}`}>💡</span>
        <p className={`text-sm ${TEXT_CLASSES[variant]}`}>
          {message}
          {cta && (
            <>
              {' '}
              <Link to={cta.href} className={`font-medium ${CTA_CLASSES[variant]}`}>
                {cta.label} →
              </Link>
            </>
          )}
        </p>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className={`min-h-[44px] min-w-[44px] shrink-0 rounded text-lg leading-none ${TEXT_CLASSES[variant]} hover:opacity-70`}
      >
        ×
      </button>
    </div>
  )
}
