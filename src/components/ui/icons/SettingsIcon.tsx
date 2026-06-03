interface IconProps {
  size?: number
  className?: string
}

export function SettingsIcon({ size = 20, className }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.5v1.75m0 11.5V17.5m5.3-12.8-1.24 1.24M5.94 14.06l-1.24 1.24M17.5 10h-1.75M4.25 10H2.5m12.8 5.3-1.24-1.24M5.94 5.94 4.7 4.7" />
    </svg>
  )
}
