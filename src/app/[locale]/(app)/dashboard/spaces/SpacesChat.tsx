'use client'

import { ChatControl } from '@/components/ChatControl'

/**
 * Spaces dashboard page - multi-channel chat with sidebar.
 * Full Discord-like experience.
 */
export function SpacesChat() {
  // TODO: Resolve space from URL params or user's tenant
  // For now, use space ID "1" (seeded default)
  return (
    <ChatControl
      mode="multi-channel"
      spaceId="1"
      className="h-full"
    />
  )
}
