'use client'

import React from 'react'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { useDashboard } from '@/providers/DashboardContext'
import { SpaceSelector } from '@/components/ChatControl/SpaceSelector'

/**
 * DashboardHeader — Dynamic header bar with Space Selector.
 *
 * Replaces the static "Angel OS Dashboard" heading with a space
 * selector/manager that lets users switch between their spaces.
 * Includes a gear icon linking to Space Settings and user display name.
 */

interface DashboardHeaderProps {
  prefix: string
  userName: string
}

export function DashboardHeader({ prefix, userName }: DashboardHeaderProps) {
  const { spaces, activeSpaceId, setActiveSpaceId } = useDashboard()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background pl-14 pr-4 md:px-6">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {spaces.length > 0 ? (
          <>
            <div className="w-56 max-w-[50%]">
              <SpaceSelector
                spaces={spaces}
                activeSpaceId={activeSpaceId || ''}
                onSelect={setActiveSpaceId}
              />
            </div>
            <Link
              href={`${prefix}/dashboard/spaces/settings`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Space Settings"
            >
              <Settings size={14} />
            </Link>
          </>
        ) : (
          <h1 className="text-sm font-medium text-foreground">Dashboard</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {userName && (
          <span className="hidden text-xs text-muted-foreground sm:inline">{userName}</span>
        )}
      </div>
    </header>
  )
}
