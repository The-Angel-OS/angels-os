'use client'

import React from 'react'
import { MinimalistChat } from './MinimalistChat'
import { MultiChannelChat, SingleChannelChat } from './MultiChannelChat'
import { SidebarChat } from './SidebarChat'
import type { ChatControlProps } from './types'

/**
 * ChatControl - Angel OS unified chat component.
 *
 * Four modes:
 * - minimalist: Floating bubble (bottom corner), expands to chat window
 * - single-channel: Embedded single channel view, no sidebar
 * - multi-channel: Full dashboard with channel list sidebar
 * - sidebar: Dashboard right-panel collapsible LEO chat
 *
 * @example
 * // Floating bubble on any page
 * <ChatControl mode="minimalist" spaceId="1" />
 *
 * // Embedded single channel
 * <ChatControl mode="single-channel" spaceId="1" channelSlug="general" />
 *
 * // Full dashboard
 * <ChatControl mode="multi-channel" spaceId="1" />
 *
 * // Dashboard sidebar
 * <ChatControl mode="sidebar" spaceId="1" channelSlug="general" />
 */
export function ChatControl(props: ChatControlProps) {
  switch (props.mode) {
    case 'minimalist':
      return <MinimalistChat {...props} />
    case 'single-channel':
      return <SingleChannelChat {...props} />
    case 'multi-channel':
      return <MultiChannelChat {...props} />
    case 'sidebar':
      return <SidebarChat {...props} />
    default:
      return <MinimalistChat {...props} />
  }
}

export { MinimalistChat } from './MinimalistChat'
export { MultiChannelChat, SingleChannelChat } from './MultiChannelChat'
export { SidebarChat } from './SidebarChat'
export { SpaceSelector } from './SpaceSelector'
export { useChat } from './useChat'
export { useSpaces } from './useSpaces'
export type { ChatControlProps, ChatMessage, ChatChannel, ChatSpace, ChatMode } from './types'
