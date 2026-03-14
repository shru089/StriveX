export default function StriveXLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none">
      <path d="M25 5L45 15V35L25 45L5 35V15L25 5Z" stroke="url(#lg1)" strokeWidth="3" fill="none" />
      <circle cx="25" cy="25" r="8" fill="url(#lg2)" />
      <defs>
        <linearGradient id="lg1" x1="5" y1="5" x2="45" y2="45">
          <stop offset="0%" stopColor="#667eea" />
          <stop offset="100%" stopColor="#764ba2" />
        </linearGradient>
        <linearGradient id="lg2" x1="17" y1="17" x2="33" y2="33">
          <stop offset="0%" stopColor="#f093fb" />
          <stop offset="100%" stopColor="#f5576c" />
        </linearGradient>
      </defs>
    </svg>
  )
}
