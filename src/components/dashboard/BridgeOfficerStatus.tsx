'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

interface BridgeOfficerStatusProps {
  agentName?: string
  isOnline?: boolean
}

export function BridgeOfficerStatus({
  agentName = 'LEO',
  isOnline = true,
}: BridgeOfficerStatusProps) {
  const router = useRouter()
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        background: 'rgba(17, 17, 34, 0.6)',
        backdropFilter: 'blur(8px)',
        borderColor: 'rgba(245, 166, 35, 0.1)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: 'var(--lcars-amber)' }}
        >
          Bridge Officer: {agentName}
        </p>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isOnline ? 'var(--lcars-green)' : 'var(--lcars-red)',
              animation: isOnline ? 'lcars-heartbeat 2s ease-in-out infinite' : 'none',
            }}
          />
          <span
            className="text-[10px] font-mono uppercase"
            style={{ color: isOnline ? 'var(--lcars-green)' : 'var(--lcars-red)' }}
          >
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--lcars-green)' }}
          />
          <span className="text-xs font-mono" style={{ color: 'var(--lcars-text-muted)' }}>
            Constitutional compliance active
          </span>
        </div>
      </div>

      <button
        type="button"
        className="w-full rounded px-3 py-2 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
        style={{
          background: 'rgba(245, 166, 35, 0.1)',
          color: 'var(--lcars-amber)',
          border: '1px solid rgba(245, 166, 35, 0.2)',
        }}
        onClick={() => {
          // Navigate to spaces where LEO lives — use Next.js router for locale-aware navigation
          router.push('/dashboard/spaces')
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'rgba(245, 166, 35, 0.2)'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'rgba(245, 166, 35, 0.1)'
        }}
      >
        Hail {agentName}
      </button>
    </div>
  )
}
