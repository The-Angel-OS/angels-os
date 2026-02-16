/**
 * ChatControl - Core types for Angel OS chat system.
 * Three modes: minimalist (floating bubble), single-channel, multi-channel (dashboard).
 */

export interface ChatMessage {
  id: string
  role: 'user' | 'leo' | 'system'
  content: string
  timestamp: Date
  authorName?: string
  /** True while SSE is still streaming this message's content */
  isStreaming?: boolean
  /** Active tool call name (shown as status indicator during data lookups) */
  activeToolCall?: string
  metadata?: {
    agentName?: string
    agentType?: string
    conversationId?: string
    messageType?: string
  }
}

export interface ChatChannel {
  id: string
  name: string
  slug: string
  description?: string
  type: string
  spaceId: string
  isDefault?: boolean
  unreadCount?: number
}

export interface ChatSpace {
  id: string
  name: string
  slug: string
  description?: string
}

export type ChatMode = 'minimalist' | 'single-channel' | 'multi-channel'

export interface ChatControlProps {
  mode: ChatMode
  /** Tenant slug for API calls */
  tenantSlug?: string
  /** Space ID to scope channels/messages */
  spaceId?: string
  /** Channel slug for single-channel mode */
  channelSlug?: string
  /** Position for minimalist floating bubble */
  position?: 'bottom-right' | 'bottom-left'
  /** Theme override */
  theme?: 'light' | 'dark' | 'auto'
  /** Class name for custom styling */
  className?: string
}
