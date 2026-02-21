'use client'

import { ChatControl } from '@/components/ChatControl'
import type { ChatSpace } from '@/components/ChatControl/types'
import { useDashboard } from '@/providers/DashboardContext'

/**
 * Spaces dashboard page — multi-channel chat with space selector.
 *
 * Reads the active space from DashboardContext (single source of truth).
 * The dashboard layout provides spaces and default space ID to the context.
 *
 * @param liveKitEnabled - Whether LiveKit voice/video is available
 */
export function SpacesChat({
  liveKitEnabled,
}: {
  liveKitEnabled?: boolean
}) {
  const { spaces, activeSpaceId } = useDashboard()

  // Convert DashboardSpace to ChatSpace format
  const chatSpaces: ChatSpace[] = spaces.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    visibility: s.visibility,
    isSystem: s.isSystem,
  }))

  return (
    <ChatControl
      mode="multi-channel"
      spaceId={activeSpaceId || '1'}
      spaces={chatSpaces.length > 0 ? chatSpaces : undefined}
      liveKitEnabled={liveKitEnabled}
      className="h-full"
    />
  )
}
