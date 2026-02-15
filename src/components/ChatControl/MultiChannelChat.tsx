'use client'

import React from 'react'
import { Hash, MessageSquare } from 'lucide-react'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { useChat } from './useChat'
import type { ChatControlProps } from './types'

/**
 * Multi-channel mode - full dashboard with sidebar.
 * Shows channel list on left, messages on right.
 * This is the main dashboard view.
 */
export function MultiChannelChat({
  spaceId,
  channelSlug,
  className = '',
}: ChatControlProps) {
  const {
    messages,
    channels,
    activeChannel,
    isLoading,
    isLoadingChannels,
    sendMessage,
    switchChannel,
  } = useChat(spaceId, channelSlug)

  const activeChannelData = channels.find((c) => c.slug === activeChannel)

  return (
    <div className={`flex h-full min-h-[500px] overflow-hidden rounded-lg border border-border bg-background ${className}`}>
      {/* Channel sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/30">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Channels</h3>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {isLoadingChannels ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : channels.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">No channels yet</div>
          ) : (
            channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => switchChannel(ch.slug)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                  ch.slug === activeChannel
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <Hash size={14} className="shrink-0 opacity-50" />
                <span className="truncate">{ch.name}</span>
              </button>
            ))
          )}
        </nav>
      </aside>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Channel header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Hash size={16} className="text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {activeChannelData?.name || activeChannel}
            </h2>
            {activeChannelData?.description && (
              <p className="text-xs text-muted-foreground">
                {activeChannelData.description}
              </p>
            )}
          </div>
        </div>

        {/* Messages */}
        <MessageList messages={messages} isLoading={isLoading} />

        {/* Input */}
        <MessageInput
          onSend={sendMessage}
          disabled={isLoading}
          placeholder={`Message #${activeChannelData?.name || activeChannel}...`}
        />
      </div>
    </div>
  )
}

/**
 * Single-channel mode - just the chat area, no sidebar.
 * Literally MultiChannelChat minus the sidebar.
 */
export function SingleChannelChat({
  spaceId,
  channelSlug = 'general',
  className = '',
}: ChatControlProps) {
  const { messages, activeChannel, isLoading, sendMessage } = useChat(
    spaceId,
    channelSlug,
  )

  return (
    <div className={`flex h-full min-h-[400px] flex-col overflow-hidden rounded-lg border border-border bg-background ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquare size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          #{activeChannel}
        </h2>
      </div>

      <MessageList messages={messages} isLoading={isLoading} />
      <MessageInput
        onSend={sendMessage}
        disabled={isLoading}
        placeholder={`Message #${activeChannel}...`}
      />
    </div>
  )
}
