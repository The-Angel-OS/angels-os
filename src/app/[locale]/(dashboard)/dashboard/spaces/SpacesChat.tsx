'use client'

import { useEffect } from 'react'
import { ChatControl } from '@/components/ChatControl'
import type { ChatSpace } from '@/components/ChatControl/types'
import { useDashboard } from '@/providers/DashboardContext'

/**
 * Spaces dashboard page — multi-channel chat with space selector.
 *
 * Reads the active space from DashboardContext (single source of truth). When
 * mounted from a deep link (/dashboard/spaces/<spaceSlug>/<channelSlug>), it
 * opens that space + channel — shareable, bookmarkable URLs.
 *
 * @param liveKitEnabled - Whether LiveKit voice/video is available
 * @param initialSpaceSlug - Space slug from a deep-link URL (optional)
 * @param initialChannel - Channel slug from a deep-link URL (optional)
 */
export function SpacesChat({
  liveKitEnabled,
  initialSpaceSlug,
  initialChannel,
}: {
  liveKitEnabled?: boolean
  initialSpaceSlug?: string
  initialChannel?: string
}) {
  const { spaces, activeSpaceId, setActiveSpaceId } = useDashboard()

  // Deep-link entry: open the space named in the URL. setActiveSpaceId also makes
  // it the sticky space, so the link "lands" and stays.
  useEffect(() => {
    if (!initialSpaceSlug) return
    const match = spaces.find((s) => s.slug === initialSpaceSlug)
    if (match && match.id !== activeSpaceId) setActiveSpaceId(match.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- act once on the incoming deep link
  }, [initialSpaceSlug])

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
      channelSlug={initialChannel}
      liveKitEnabled={liveKitEnabled}
      className="h-full"
    />
  )
}
