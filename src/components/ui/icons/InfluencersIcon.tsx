interface IconProps {
  size?: number
  className?: string
}

export function InfluencersIcon({ size = 20, className }: IconProps): JSX.Element {
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
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" />
      <path d="M15 5l1.5-1.5M16.5 7H18M15 9l1.5 1.5" />
    </svg>
  )
}
