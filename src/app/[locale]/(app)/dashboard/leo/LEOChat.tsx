'use client'

import { ChatControl } from '@/components/ChatControl'

/**
 * LEO dashboard page - single-channel chat with LEO.
 * Uses the first space available. In production, this would
 * use the user's default space or tenant space.
 */
export function LEOChat() {
  // TODO: Resolve space from user's tenant context
  // For now, use space ID "1" (seeded default)
  return (
    <ChatControl
      mode="single-channel"
      spaceId="1"
      channelSlug="general"
      className="h-full"
    />
  )
}
