'use client'

import { ChatControl } from '@/components/ChatControl'

/**
 * Dashboard LEO Sidebar — right-side collapsible chat panel.
 *
 * In the dashboard, the floating bubble becomes a sidebar.
 * Same ChatControl component, just mode="sidebar".
 *
 * @param spaceId - Resolved server-side from the tenant's default space.
 * @param dmSpaceId - The DMs system space for this tenant (for persistent LEO DMs).
 * @param tenantId - Current tenant ID.
 * @param userId - Current user ID.
 */
export function DashboardLEOSidebar({
  spaceId,
  dmSpaceId,
  tenantId,
  userId,
}: {
  spaceId?: string
  dmSpaceId?: string
  tenantId?: string
  userId?: string
}) {
  return (
    <ChatControl
      mode="sidebar"
      spaceId={dmSpaceId || spaceId || '1'}
      channelSlug="general"
      tenantId={tenantId}
      userId={userId}
      dmSpaceId={dmSpaceId}
    />
  )
}
