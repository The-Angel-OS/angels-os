import React from 'react'

/**
 * Angel OS mark — halo + wings + body. The canonical brand glyph (matches the
 * Payload admin AdminLogo/AdminIcon and the favicon). Uses `currentColor` so it
 * inherits whatever color the parent sets (brand gold #f5a623 by default in the
 * header).
 */
export function AngelIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Angel OS"
      {...props}
    >
      {/* Halo */}
      <ellipse cx="16" cy="8" rx="8" ry="3" stroke="currentColor" strokeWidth="2" fill="none" />
      {/* Wings */}
      <path
        d="M16 14 C10 14, 4 18, 2 26 C6 22, 10 20, 16 20"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M16 14 C22 14, 28 18, 30 26 C26 22, 22 20, 16 20"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Body */}
      <circle cx="16" cy="20" r="4" fill="currentColor" opacity="0.3" />
      <circle cx="16" cy="20" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}
