'use client'

/**
 * The unread count on a channel row.
 *
 * A number rather than a dot, everywhere. Dots were the cheaper option and the
 * measurement said counts cost essentially nothing — the per-channel time floor
 * rides along in one VALUES join either way — so the UI gets to say the more
 * useful thing. "3 people are waiting on you" is not the same information as
 * "there is activity".
 *
 * Collapsed sidebar has no room for a number, so it degrades to a dot. That is
 * the one place the cheaper signal is the right one.
 */
export function UnreadBadge({
  count,
  cap = 99,
  compact = false,
  className = '',
}: {
  count?: number
  cap?: number
  /** Sidebar collapsed — render a dot, there is nowhere to put digits. */
  compact?: boolean
  className?: string
}) {
  if (!count || count < 1) return null

  const label = count >= cap ? `${cap}+` : String(count)
  const a11y = `${label} unread ${count === 1 ? 'message' : 'messages'}`

  if (compact) {
    return (
      <span
        className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-1 ring-background ${className}`}
        aria-label={a11y}
        role="status"
      />
    )
  }

  return (
    <span
      className={`ml-auto shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums ${className}`}
      aria-label={a11y}
      role="status"
    >
      {label}
    </span>
  )
}
