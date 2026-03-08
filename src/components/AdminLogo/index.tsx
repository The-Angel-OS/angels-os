import React from 'react'

/**
 * AdminLogo — Angel OS wordmark for Payload admin panel login/sidebar.
 *
 * Registered via admin.components.graphics.Logo in payload.config.ts.
 * Server component (no 'use client' needed for Payload admin graphics).
 */
export const AdminLogo = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {/* Angel wing / halo icon */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Angel OS"
      >
        {/* Halo */}
        <ellipse cx="16" cy="8" rx="8" ry="3" stroke="#f5a623" strokeWidth="2" fill="none" />
        {/* Wings */}
        <path
          d="M16 14 C10 14, 4 18, 2 26 C6 22, 10 20, 16 20"
          stroke="#f5a623"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M16 14 C22 14, 28 18, 30 26 C26 22, 22 20, 16 20"
          stroke="#f5a623"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Body */}
        <circle cx="16" cy="20" r="4" fill="#f5a623" opacity="0.3" />
        <circle cx="16" cy="20" r="4" stroke="#f5a623" strokeWidth="1.5" fill="none" />
      </svg>
      <span
        style={{
          fontSize: '18px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: '#f5a623',
        }}
      >
        Angel OS
      </span>
    </div>
  )
}
