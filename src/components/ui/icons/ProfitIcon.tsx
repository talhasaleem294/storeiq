interface IconProps {
  size?: number
  className?: string
}

export function ProfitIcon({ size = 20, className }: IconProps): JSX.Element {
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
      <path d="M10 2v16M6 6h6a2 2 0 010 4H7a2 2 0 000 4h7" />
    </svg>
  )
}
