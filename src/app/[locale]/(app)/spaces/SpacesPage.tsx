'use client'

import { ChatControl } from '@/components/ChatControl'

/**
 * Public Spaces page — MultiChannelChat within the (app) layout.
 * Server name header and member count are handled in the parent server component.
 * Auth-gating: ChatControl itself handles unauthenticated state gracefully.
 */
export function SpacesPage({ spaceId }: { spaceId?: string }) {
  return (
    <ChatControl
      mode="multi-channel"
      spaceId={spaceId || '1'}
      className="h-full"
    />
  )
}
