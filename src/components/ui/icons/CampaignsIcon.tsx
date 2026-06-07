interface IconProps {
  size?: number
  className?: string
}

export function CampaignsIcon({ size = 20, className }: IconProps): JSX.Element {
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
      <path d="M3 10 L17 4 L14 16 L9 12 Z" />
      <path d="M9 12 L7 17" />
    </svg>
  )
}
