'use client'

import { ChatControl } from '@/components/ChatControl'

/**
 * Dashboard LEO Sidebar — right-side collapsible chat panel.
 *
 * In the dashboard, the floating bubble becomes a sidebar.
 * Same ChatControl component, just mode="sidebar".
 *
 * @param spaceId - Resolved server-side from the tenant's default space.
 */
export function DashboardLEOSidebar({ spaceId }: { spaceId?: string }) {
  return (
    <ChatControl
      mode="sidebar"
      spaceId={spaceId || '1'}
      channelSlug="general"
    />
  )
}
