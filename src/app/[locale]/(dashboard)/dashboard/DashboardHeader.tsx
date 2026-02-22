'use client'

import React from 'react'

/**
 * DashboardHeader — Minimal header bar.
 *
 * The Space selector has been moved exclusively to the Spaces page sidebar
 * to avoid redundancy. The header now shows a simple breadcrumb-style title
 * and the authenticated user's name.
 */

interface DashboardHeaderProps {
  prefix: string
  userName: string
}

export function DashboardHeader({ prefix, userName }: DashboardHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background pl-14 pr-4 md:px-6">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <h1 className="text-sm font-medium text-foreground">Angel OS Dashboard</h1>
      </div>

      <div className="flex items-center gap-3">
        {userName && (
          <span className="hidden text-xs text-muted-foreground sm:inline">{userName}</span>
        )}
      </div>
    </header>
  )
}
