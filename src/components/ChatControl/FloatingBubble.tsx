'use client'

import { ChatControl } from './index'
import { useAuth } from '@/providers/Auth'

/**
 * Global floating chat bubble - appears on every page.
 * Wrap this in the root layout for site-wide LEO access.
 *
 * Only renders when the user is authenticated to avoid
 * unauthenticated API polling (403 errors every 5s).
 */
export function FloatingBubble() {
  const { status } = useAuth()

  // Don't render until auth check completes, and only if logged in
  if (status !== 'loggedIn') return null

  return (
    <ChatControl
      mode="minimalist"
      spaceId="1"
      channelSlug="general"
      position="bottom-right"
    />
  )
}
