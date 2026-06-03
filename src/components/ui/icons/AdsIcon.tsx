interface IconProps {
  size?: number
  className?: string
}

export function AdsIcon({ size = 20, className }: IconProps): JSX.Element {
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
      <path d="M2 14l4-6 4 4 3-5 3 3" />
      <path d="M2 18h16" />
    </svg>
  )
}
