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
  tenantId,
}: {
  liveKitEnabled?: boolean
  initialSpaceSlug?: string
  initialChannel?: string
  tenantId?: string
}) {
  const { spaces, activeSpaceId, setActiveSpaceId } = useDashboard()

  // The URL is the source of truth on a deep link. The segment is the canonical
  // numeric space id (/dashboard/spaces/{spaceId}/{channelId}); we still accept a
  // slug for older links. Resolve it SYNCHRONOUSLY so ChatControl mounts directly on
  // the URL's space — never on the last/sticky space first (which caused a load of
  // that space's default channel before switching, the double/triple-load + "returns
  // to the last space" bug). A numeric id works even before `spaces` has hydrated.
  const urlSpaceId = initialSpaceSlug
    ? (spaces.find((s) => String(s.id) === initialSpaceSlug || s.slug === initialSpaceSlug)?.id
        ?? (/^\d+$/.test(initialSpaceSlug) ? initialSpaceSlug : undefined))
    : undefined
  // Bare /dashboard/spaces (no deep link, no sticky space) resolves to THIS
  // tenant's default space — the Community town square if it has one, else the
  // first real (non-system) space, else the first space of any kind. Only if the
  // tenant has no spaces at all do we fall back to id 1. Previously this hardcoded
  // '1' (the platform's space), so a guardian-angel / tenant portal landed on a
  // space it doesn't own. ChatControl opens that space's Main channel by default.
  const defaultSpaceId =
    spaces.find((s) => !s.isSystem && s.visibility === 'public')?.id ??
    spaces.find((s) => !s.isSystem)?.id ??
    spaces[0]?.id ??
    '1'
  const effectiveSpaceId = urlSpaceId ?? activeSpaceId ?? defaultSpaceId

  // Keep the sticky/sidebar space in sync with the URL (highlight + return target).
  useEffect(() => {
    if (urlSpaceId != null && urlSpaceId !== activeSpaceId) setActiveSpaceId(urlSpaceId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- act on the incoming deep link
  }, [urlSpaceId])

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
      tenantId={tenantId}
      spaceId={String(effectiveSpaceId)}
      spaces={chatSpaces.length > 0 ? chatSpaces : undefined}
      channelSlug={initialChannel}
      liveKitEnabled={liveKitEnabled}
      className="h-full"
    />
  )
}
