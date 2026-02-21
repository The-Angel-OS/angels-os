'use client'

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Dashboard-wide space context.
 *
 * Provides the currently active space across all dashboard pages.
 * The layout resolves user spaces server-side and passes them here.
 * Any dashboard page can call `useDashboard()` to read the active space.
 */

export interface DashboardSpace {
  id: string
  name: string
  slug: string
  description?: string
  visibility?: 'public' | 'invite_only' | 'private'
  isSystem?: boolean
}

interface DashboardContextValue {
  spaces: DashboardSpace[]
  activeSpaceId: string | null
  activeSpace: DashboardSpace | null
  setActiveSpaceId: (id: string) => void
}

const DashboardCtx = createContext<DashboardContextValue>({
  spaces: [],
  activeSpaceId: null,
  activeSpace: null,
  setActiveSpaceId: () => {},
})

export function DashboardProvider({
  children,
  initialSpaces,
  defaultSpaceId,
}: {
  children: ReactNode
  initialSpaces: DashboardSpace[]
  defaultSpaceId?: string
}) {
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(
    defaultSpaceId || initialSpaces.find((s) => !s.isSystem)?.id || initialSpaces[0]?.id || null,
  )

  const activeSpace = initialSpaces.find((s) => s.id === activeSpaceId) || null

  return (
    <DashboardCtx.Provider
      value={{ spaces: initialSpaces, activeSpaceId, activeSpace, setActiveSpaceId }}
    >
      {children}
    </DashboardCtx.Provider>
  )
}

export function useDashboard() {
  return useContext(DashboardCtx)
}
