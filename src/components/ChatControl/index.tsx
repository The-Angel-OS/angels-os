'use client'

import React from 'react'
import { MinimalistChat } from './MinimalistChat'
import { MultiChannelChat, SingleChannelChat } from './MultiChannelChat'
import type { ChatControlProps } from './types'

/**
 * ChatControl - Angel OS unified chat component.
 *
 * Three modes:
 * - minimalist: Floating bubble (bottom corner), expands to chat window
 * - single-channel: Embedded single channel view, no sidebar
 * - multi-channel: Full dashboard with channel list sidebar
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
 */
export function ChatControl(props: ChatControlProps) {
  switch (props.mode) {
    case 'minimalist':
      return <MinimalistChat {...props} />
    case 'single-channel':
      return <SingleChannelChat {...props} />
    case 'multi-channel':
      return <MultiChannelChat {...props} />
    default:
      return <MinimalistChat {...props} />
  }
}

export { MinimalistChat } from './MinimalistChat'
export { MultiChannelChat, SingleChannelChat } from './MultiChannelChat'
export { useChat } from './useChat'
export type { ChatControlProps, ChatMessage, ChatChannel, ChatMode } from './types'
