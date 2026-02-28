'use client'

import React, { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useClickOutside } from '@/hooks/useClickOutside'

/**
 * DashboardHeader — Header bar with user dropdown menu.
 *
 * Shows the dashboard title and a user avatar button (upper-right)
 * that opens a dropdown with Account Settings and Log Out.
 */

interface DashboardHeaderProps {
  prefix: string
  userName: string
  userInitials: string
}

export function DashboardHeader({ prefix, userName, userInitials }: DashboardHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  useClickOutside(menuRef, closeMenu, menuOpen)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background pl-14 pr-4 md:px-6">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <h1 className="text-sm font-medium text-foreground">Angel OS Dashboard</h1>
      </div>

      <div className="relative flex items-center gap-3" ref={menuRef}>
        {/* User avatar button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 rounded-full px-1 py-1 transition-colors hover:bg-muted"
          title="User menu"
        >
          <span className="hidden text-xs text-muted-foreground sm:inline">{userName}</span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
            {userInitials}
          </span>
          <svg
            className={`hidden h-3 w-3 text-muted-foreground transition-transform sm:block ${menuOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-background py-1 shadow-lg">
            <Link
              href={`${prefix}/dashboard/account`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Account Settings
            </Link>
            <div className="mx-2 my-1 h-px bg-border" />
            <Link
              href="/logout"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log out
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
