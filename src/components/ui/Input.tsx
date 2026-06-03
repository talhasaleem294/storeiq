import { clsx } from 'clsx'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, id, className, ...props }: InputProps): JSX.Element {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-heading">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          'w-full rounded-lg border bg-bg px-3 py-2.5 text-sm text-heading placeholder:text-text/50',
          'min-h-[44px] transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1',
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-border hover:border-text/40',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-text">{hint}</p>}
    </div>
  )
}
