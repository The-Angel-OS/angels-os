'use client'

import React, { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useClickOutside } from '@/hooks/useClickOutside'

/**
 * DashboardHeader — LCARS-styled header bar with user dropdown menu.
 *
 * Shows "FEDERATION COMMAND CENTER" title with LCARS accent bars
 * and a user avatar button (upper-right) for Account Settings / Log Out.
 */

interface DashboardHeaderProps {
  prefix: string
  userName: string
  userInitials: string
  isAuthenticated?: boolean
}

export function DashboardHeader({ prefix, userName, userInitials, isAuthenticated = true }: DashboardHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  useClickOutside(menuRef, closeMenu, menuOpen)

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b pl-14 pr-4 md:px-6"
      style={{
        background: 'var(--lcars-dark-bg)',
        borderColor: 'rgba(245, 166, 35, 0.1)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* LCARS accent pill */}
        <div
          className="hidden sm:block h-6 w-1.5 rounded-full flex-shrink-0"
          style={{ background: 'var(--lcars-amber)' }}
        />
        <h1
          className="text-xs font-mono font-semibold uppercase tracking-[0.15em]"
          style={{ color: 'var(--lcars-amber)' }}
        >
          Federation Command Center
        </h1>
        {/* Decorative segments */}
        <div className="hidden md:flex items-center gap-1 ml-2">
          <div className="h-1 w-8 rounded-full" style={{ background: 'rgba(245, 166, 35, 0.2)' }} />
          <div className="h-1 w-4 rounded-full" style={{ background: 'rgba(153, 204, 255, 0.2)' }} />
          <div className="h-1 w-2 rounded-full" style={{ background: 'rgba(204, 153, 204, 0.2)' }} />
        </div>
      </div>

      <div className="relative flex items-center gap-3" ref={menuRef}>
        {isAuthenticated ? (
          <>
            {/* User avatar button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-full px-1 py-1 transition-colors"
              style={{ color: 'var(--lcars-text-muted)' }}
              title="User menu"
            >
              <span className="hidden text-xs font-mono sm:inline">{userName}</span>
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold font-mono"
                style={{
                  background: 'rgba(245, 166, 35, 0.15)',
                  color: 'var(--lcars-amber)',
                }}
              >
                {userInitials}
              </span>
              <svg
                className={`hidden h-3 w-3 transition-transform sm:block ${menuOpen ? 'rotate-180' : ''}`}
                style={{ color: 'var(--lcars-text-muted)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border py-1 shadow-lg"
                style={{
                  background: 'var(--lcars-panel-bg)',
                  borderColor: 'rgba(245, 166, 35, 0.15)',
                }}
              >
                <Link
                  href={`${prefix}/dashboard/account`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-mono transition-colors"
                  style={{ color: 'var(--lcars-text-muted)' }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Account Settings
                </Link>
                <div className="mx-2 my-1 h-px" style={{ background: 'rgba(245, 166, 35, 0.1)' }} />
                <Link
                  href="/logout"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-mono transition-colors"
                  style={{ color: 'var(--lcars-text-muted)' }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Log out
                </Link>
              </div>
            )}
          </>
        ) : (
          /* Anonymous — show Sign In button */
          <Link
            href={`${prefix}/login?redirect=${encodeURIComponent(`${prefix}/dashboard`)}`}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-mono font-semibold transition-colors"
            style={{
              background: 'rgba(245, 166, 35, 0.15)',
              color: 'var(--lcars-amber)',
              border: '1px solid rgba(245, 166, 35, 0.25)',
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign In
          </Link>
        )}
      </div>
    </header>
  )
}
