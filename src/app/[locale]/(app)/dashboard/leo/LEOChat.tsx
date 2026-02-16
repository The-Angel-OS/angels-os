'use client'

import { ChatControl } from '@/components/ChatControl'

/**
 * LEO dashboard page - single-channel chat with LEO.
 *
 * @param spaceId - Resolved server-side from the tenant's default space.
 */
export function LEOChat({ spaceId }: { spaceId?: string }) {
  return (
    <ChatControl
      mode="single-channel"
      spaceId={spaceId || '1'}
      channelSlug="general"
      className="h-full"
    />
  )
}
