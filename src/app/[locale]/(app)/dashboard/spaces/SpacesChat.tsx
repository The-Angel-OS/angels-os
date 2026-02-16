'use client'

import { ChatControl } from '@/components/ChatControl'

/**
 * Spaces dashboard page - multi-channel chat with sidebar.
 * Full Discord-like experience.
 *
 * @param spaceId - Resolved server-side from the tenant's default space.
 */
export function SpacesChat({ spaceId }: { spaceId?: string }) {
  return (
    <ChatControl
      mode="multi-channel"
      spaceId={spaceId || '1'}
      className="h-full"
    />
  )
}
