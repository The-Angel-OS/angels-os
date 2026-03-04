'use client'

import React from 'react'
import Link from 'next/link'

interface LCARSQuickActionProps {
  label: string
  description?: string
  icon: React.ReactNode
  href: string
  accentColor?: string
}

export function LCARSQuickAction({
  label,
  description,
  icon,
  href,
  accentColor = 'var(--lcars-amber)',
}: LCARSQuickActionProps) {
  return (
    <Link
      href={href}
      className="group relative block rounded-lg border p-4 transition-all hover:scale-[1.02]"
      style={{
        background: 'rgba(17, 17, 34, 0.5)',
        borderColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
      }}
    >
      {/* Hover fill */}
      <div
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `color-mix(in srgb, ${accentColor} 6%, transparent)` }}
      />

      <div className="relative flex items-center gap-3">
        <div
          className="flex-shrink-0 w-9 h-9 rounded flex items-center justify-center"
          style={{
            background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
            color: accentColor,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p
            className="text-sm font-mono font-semibold uppercase tracking-wider"
            style={{ color: accentColor }}
          >
            {label}
          </p>
          {description && (
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: 'var(--lcars-text-muted)' }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
