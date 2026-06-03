import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps): JSX.Element {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] cursor-pointer'

  const variants = {
    primary: 'bg-accent text-white hover:opacity-90 active:scale-[0.98]',
    secondary: 'border border-border bg-bg text-heading hover:bg-surface active:scale-[0.98]',
    ghost: 'text-text hover:bg-surface active:scale-[0.98]',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]',
  }

  const sizes = {
    sm: 'px-3 text-sm min-h-[36px]',
    md: 'px-4 text-sm',
    lg: 'px-6 text-base',
  }

  return (
    <button
      disabled={disabled ?? loading}
      className={clsx(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
