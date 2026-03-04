'use client'

import React from 'react'
import Link from 'next/link'

interface LCARSStatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  accentColor?: string
  href?: string
  delay?: number
}

export function LCARSStatCard({
  label,
  value,
  icon,
  accentColor = 'var(--lcars-amber)',
  href,
  delay = 0,
}: LCARSStatCardProps) {
  const content = (
    <div
      className="relative overflow-hidden rounded-lg border flex items-stretch gap-4 p-4 transition-transform hover:scale-[1.02]"
      style={{
        background: 'rgba(17, 17, 34, 0.6)',
        backdropFilter: 'blur(8px)',
        borderColor: 'rgba(245, 166, 35, 0.1)',
        animation: `lcars-fade-up 0.5s ease-out ${delay}ms both`,
      }}
    >
      {/* Left accent bar */}
      <div
        className="w-1 rounded-full flex-shrink-0"
        style={{ background: accentColor }}
      />

      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-mono uppercase tracking-wider mb-1"
          style={{ color: 'var(--lcars-text-muted)' }}
        >
          {label}
        </p>
        <p
          className="text-2xl font-mono font-bold tabular-nums"
          style={{
            color: accentColor,
            textShadow: `0 0 12px ${accentColor}40`,
          }}
        >
          {value}
        </p>
      </div>

      <div className="flex items-center flex-shrink-0" style={{ color: accentColor, opacity: 0.5 }}>
        {icon}
      </div>

      {/* Heartbeat dot */}
      <div
        className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
        style={{
          background: accentColor,
          animation: 'lcars-heartbeat 2s ease-in-out infinite',
        }}
      />
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {content}
      </Link>
    )
  }

  return content
}
