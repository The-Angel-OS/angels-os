'use client'

import React, { useState, useEffect } from 'react'
import { Hash, ChevronDown } from 'lucide-react'
import { Backdrop } from '@/components/Backdrop'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { SpaceSelector } from './SpaceSelector'
import { useChat } from './useChat'
import { useChatContext } from './ChatProvider'
import { useIsMobile } from '@/utilities/useMediaQuery'
import type { ChatControlProps } from './types'

/**
 * SidebarChat — Dashboard right-panel LEO chat.
 *
 * Desktop: collapsible panel (w-96) that slides in from the right.
 * Mobile: full-screen overlay with backdrop.
 *
 * Sprint 12: Consumes ChatProvider when available for persistent LEO DMs.
 * Falls back to direct useChat() when no provider (safety net).
 */
export function SidebarChat({
  spaceId,
  channelSlug = 'general',
  className = '',
}: ChatControlProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showChannelMenu, setShowChannelMenu] = useState(false)
  const isMobile = useIsMobile()

  // Try ChatProvider context first (persistent LEO DM)
  const chatCtx = useChatContext()

  // Fallback: direct useChat for when no provider is available
  const directChat = useChat(spaceId, channelSlug)

  // Determine which state source to use
  const hasProvider = chatCtx !== null
  const leoDM = chatCtx?.leoDMChannel

  // If provider is available and has LEO DM, navigate to it on mount
  useEffect(() => {
    if (hasProvider && leoDM && chatCtx) {
      chatCtx.switchChannel(leoDM.slug)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProvider, leoDM?.slug])

  // Select the right state source
  const messages = hasProvider ? chatCtx!.messages : directChat.messages
  const channels = hasProvider ? chatCtx!.channels : directChat.channels
  const activeChannel = hasProvider ? chatCtx!.activeChannelSlug : directChat.activeChannel
  const isLoading = hasProvider ? chatCtx!.isLoading : directChat.isLoading
  const isLoadingChannels = hasProvider ? chatCtx!.isLoadingChannels : directChat.isLoadingChannels
  const isLoadingMore = hasProvider ? chatCtx!.isLoadingMore : directChat.isLoadingMore
  const hasMore = hasProvider ? chatCtx!.hasMore : directChat.hasMore
  const sendMessage = hasProvider ? chatCtx!.sendMessage : directChat.sendMessage
  const switchChannel = hasProvider ? chatCtx!.switchChannel : directChat.switchChannel
  const loadMoreMessages = hasProvider ? chatCtx!.loadMoreMessages : directChat.loadMoreMessages

  // Space switching (for SpaceSelector dropdown)
  const spaces = hasProvider ? chatCtx!.spaces : []
  const setActiveSpace = hasProvider ? chatCtx!.setActiveSpace : () => {}
  const activeSpaceId = hasProvider ? chatCtx!.activeSpaceId : spaceId

  // Lock body scroll when mobile overlay is open
  useEffect(() => {
    if (isMobile && isExpanded) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isMobile, isExpanded])

  const activeChannelData = channels.find((c) => c.slug === activeChannel)
  const displayName = leoDM ? 'LEO DM' : activeChannelData?.name || activeChannel || 'general'

  return (
    <>
      {/* Toggle Button — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`fixed right-0 top-1/2 z-40 -translate-y-1/2 flex items-center justify-center rounded-l-lg border border-r-0 border-border bg-background shadow-md transition-colors hover:bg-muted active:bg-muted/80 ${
          isMobile ? 'h-14 w-10' : 'h-12 w-8'
        }`}
        title={isExpanded ? 'Close LEO' : 'Chat with LEO'}
        aria-label={isExpanded ? 'Close LEO panel' : 'Open LEO panel'}
      >
        {isExpanded ? (
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
        )}
      </button>

      {/* Mobile backdrop */}
      <Backdrop isOpen={isMobile && isExpanded} onClick={() => setIsExpanded(false)} zIndex="z-30" opacity="bg-black/40" />

      {/* Chat Panel — full-width on mobile, w-96 on desktop */}
      <div
        className={`fixed right-0 top-0 z-30 h-full transform border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out ${
          isMobile ? 'w-full' : 'w-96'
        } ${isExpanded ? 'translate-x-0' : 'translate-x-full'} ${className}`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="shrink-0 border-b border-border">
            {/* Top row: Space selector + close button */}
            <div className="flex items-center justify-between px-2 pt-2">
              <div className="min-w-0 flex-1">
                {spaces.length > 0 && activeSpaceId ? (
                  <SpaceSelector
                    spaces={spaces}
                    activeSpaceId={activeSpaceId}
                    onSelect={setActiveSpace}
                    compact
                  />
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                      <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-foreground">LEO</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className={`shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
                  isMobile ? 'h-8 w-8' : 'h-6 w-6'
                }`}
                title="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Bottom row: Channel selector */}
            <div className="px-4 pb-2">
              <div className="relative">
                <button
                  onClick={() => setShowChannelMenu(!showChannelMenu)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {leoDM ? (
                    <span className="truncate max-w-[180px]">LEO DM</span>
                  ) : (
                    <>
                      <Hash size={10} />
                      <span className="truncate max-w-[180px]">{displayName}</span>
                    </>
                  )}
                  {channels.length > 1 && <ChevronDown size={10} />}
                </button>
                {showChannelMenu && !isLoadingChannels && channels.length > 1 && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-background shadow-lg py-1">
                    {/* Show LEO DM at the top if available */}
                    {leoDM && (
                      <button
                        onClick={() => {
                          switchChannel(leoDM.slug)
                          setShowChannelMenu(false)
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                          leoDM.slug === activeChannel
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        LEO DM
                      </button>
                    )}
                    {channels.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => {
                          switchChannel(ch.slug)
                          setShowChannelMenu(false)
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                          ch.slug === activeChannel
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <Hash size={10} />
                        {ch.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <MessageList messages={messages} isLoading={isLoading} isLoadingMore={isLoadingMore} hasMore={hasMore} onLoadMore={loadMoreMessages} />

          {/* Input */}
          <MessageInput
            onSend={sendMessage}
            disabled={isLoading}
            placeholder={`Ask LEO anything...`}
          />
        </div>
      </div>
    </>
  )
}
