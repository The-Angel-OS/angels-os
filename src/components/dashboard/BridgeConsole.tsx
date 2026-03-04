'use client'

import React, { useState } from 'react'
import { StandingOrders } from './StandingOrders'
import { OfficerLog } from './OfficerLog'

interface SystemStatus {
  name: string
  label: string
  count: number
  status: 'online' | 'standby' | 'offline'
  color: string
}

interface BridgeConsoleProps {
  systems: SystemStatus[]
  leoOnline: boolean
}

const STATUS_COLORS = {
  online: 'var(--lcars-green)',
  standby: 'var(--lcars-amber)',
  offline: 'var(--lcars-red)',
}

export function BridgeConsole({ systems, leoOnline }: BridgeConsoleProps) {
  const [centerTab, setCenterTab] = useState<'operations' | 'orders'>('operations')

  // Stardate
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000)
  const stardate = `${now.getFullYear()}.${String(dayOfYear).padStart(3, '0')}`

  return (
    <div className="space-y-4">
      {/* LCARS Header Bar */}
      <div className="flex items-stretch gap-2">
        <div className="w-16 rounded-l-full py-3 px-4 flex-shrink-0" style={{ background: 'var(--lcars-amber)' }}>
          <span className="sr-only">LCARS</span>
        </div>
        <div className="flex-1 flex items-center justify-between px-4 rounded-r-sm" style={{ background: 'rgba(245, 166, 35, 0.08)' }}>
          <div className="flex items-center gap-3">
            <h1
              className="text-lg font-mono font-bold uppercase tracking-wider"
              style={{ color: 'var(--lcars-amber)' }}
            >
              Enterprise Bridge
            </h1>
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: leoOnline ? 'var(--lcars-green)' : 'var(--lcars-red)',
                  animation: leoOnline ? 'lcars-heartbeat 2s ease-in-out infinite' : 'none',
                }}
              />
              <span
                className="text-[10px] font-mono uppercase"
                style={{ color: leoOnline ? 'var(--lcars-green)' : 'var(--lcars-red)' }}
              >
                {leoOnline ? 'LEO Online' : 'LEO Offline'}
              </span>
            </div>
          </div>
          <span
            className="text-xs font-mono hidden sm:block"
            style={{ color: 'var(--lcars-text-muted)' }}
          >
            STARDATE {stardate}
          </span>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="grid gap-4 lg:grid-cols-[240px_1fr_280px]">
        {/* Left Panel — Systems Status */}
        <div
          className="rounded-lg border p-4 space-y-3"
          style={{
            background: 'rgba(17, 17, 34, 0.6)',
            backdropFilter: 'blur(8px)',
            borderColor: 'rgba(245, 166, 35, 0.1)',
          }}
        >
          <p
            className="text-xs font-mono uppercase tracking-wider"
            style={{ color: 'var(--lcars-amber)' }}
          >
            Systems Status
          </p>

          <div className="space-y-2">
            {systems.map((sys) => (
              <div
                key={sys.name}
                className="flex items-center gap-3 rounded px-2.5 py-2"
                style={{ background: 'rgba(17, 17, 34, 0.4)' }}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: STATUS_COLORS[sys.status],
                    animation: sys.status === 'online' ? 'lcars-heartbeat 2s ease-in-out infinite' : 'none',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[10px] font-mono uppercase tracking-wider"
                    style={{ color: sys.color }}
                  >
                    {sys.label}
                  </p>
                  <p
                    className="text-lg font-mono font-bold tabular-nums"
                    style={{ color: sys.color }}
                  >
                    {sys.count}
                  </p>
                </div>
                <span
                  className="text-[8px] font-mono uppercase"
                  style={{ color: STATUS_COLORS[sys.status] }}
                >
                  {sys.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Center Panel — Tabs */}
        <div
          className="rounded-lg border p-4"
          style={{
            background: 'rgba(17, 17, 34, 0.6)',
            backdropFilter: 'blur(8px)',
            borderColor: 'rgba(245, 166, 35, 0.1)',
          }}
        >
          {/* Tab buttons */}
          <div className="flex gap-1 mb-4">
            <button
              type="button"
              onClick={() => setCenterTab('operations')}
              className="px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
              style={{
                background: centerTab === 'operations' ? 'rgba(245, 166, 35, 0.15)' : 'transparent',
                color: centerTab === 'operations' ? 'var(--lcars-amber)' : 'var(--lcars-text-muted)',
                border: `1px solid ${centerTab === 'operations' ? 'rgba(245, 166, 35, 0.2)' : 'transparent'}`,
              }}
            >
              Operations
            </button>
            <button
              type="button"
              onClick={() => setCenterTab('orders')}
              className="px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
              style={{
                background: centerTab === 'orders' ? 'rgba(245, 166, 35, 0.15)' : 'transparent',
                color: centerTab === 'orders' ? 'var(--lcars-amber)' : 'var(--lcars-text-muted)',
                border: `1px solid ${centerTab === 'orders' ? 'rgba(245, 166, 35, 0.2)' : 'transparent'}`,
              }}
            >
              Standing Orders
            </button>
          </div>

          {/* Tab content */}
          {centerTab === 'operations' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {systems.map((sys) => (
                <div
                  key={sys.name}
                  className="rounded-lg border p-3 text-center"
                  style={{
                    background: 'rgba(17, 17, 34, 0.4)',
                    borderColor: `color-mix(in srgb, ${sys.color} 15%, transparent)`,
                  }}
                >
                  <p
                    className="text-2xl font-mono font-bold tabular-nums"
                    style={{
                      color: sys.color,
                      textShadow: `0 0 12px color-mix(in srgb, ${sys.color} 25%, transparent)`,
                    }}
                  >
                    {sys.count}
                  </p>
                  <p
                    className="text-[10px] font-mono uppercase tracking-wider mt-1"
                    style={{ color: 'var(--lcars-text-muted)' }}
                  >
                    {sys.label}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: STATUS_COLORS[sys.status] }}
                    />
                    <span
                      className="text-[8px] font-mono uppercase"
                      style={{ color: STATUS_COLORS[sys.status] }}
                    >
                      {sys.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <StandingOrders />
          )}
        </div>

        {/* Right Panel — Officer Log */}
        <div
          className="rounded-lg border p-4"
          style={{
            background: 'rgba(17, 17, 34, 0.6)',
            backdropFilter: 'blur(8px)',
            borderColor: 'rgba(153, 204, 255, 0.1)',
          }}
        >
          <OfficerLog />
        </div>
      </div>

      {/* Status Bar */}
      <div
        className="flex items-center justify-between rounded-lg px-4 py-2"
        style={{
          background: 'rgba(17, 17, 34, 0.4)',
          borderTop: '1px solid rgba(245, 166, 35, 0.08)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--lcars-green)', animation: 'lcars-heartbeat 2s ease-in-out infinite' }}
            />
            <span className="text-[9px] font-mono uppercase" style={{ color: 'var(--lcars-text-muted)' }}>
              Mesh Connected
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--lcars-green)' }} />
            <span className="text-[9px] font-mono uppercase" style={{ color: 'var(--lcars-text-muted)' }}>
              Constitution Active
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono uppercase" style={{ color: 'var(--lcars-text-muted)' }}>
            Herald Protocol v1
          </span>
        </div>
      </div>
    </div>
  )
}
