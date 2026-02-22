'use client'

import React, { useState, useEffect } from 'react'
import { Hash, ChevronDown } from 'lucide-react'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { useChat } from './useChat'
import { useIsMobile } from '@/utilities/useMediaQuery'
import type { ChatControlProps } from './types'

/**
 * SidebarChat — Dashboard right-panel LEO chat.
 *
 * Desktop: collapsible panel (w-96) that slides in from the right.
 * Mobile: full-screen overlay with backdrop.
 *
 * Now channel-aware: dropdown to switch between channels in the active space.
 */
export function SidebarChat({
  spaceId,
  channelSlug = 'general',
  className = '',
}: ChatControlProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showChannelMenu, setShowChannelMenu] = useState(false)
  const isMobile = useIsMobile()
  const {
    messages,
    channels,
    activeChannel,
    isLoading,
    isLoadingChannels,
    isLoadingMore,
    hasMore,
    sendMessage,
    switchChannel,
    loadMoreMessages,
  } = useChat(spaceId, channelSlug)

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
      {isMobile && isExpanded && (
        <div
          className="fixed inset-0 z-30 bg-black/40 transition-opacity"
          onClick={() => setIsExpanded(false)}
          aria-hidden="true"
        />
      )}

      {/* Chat Panel — full-width on mobile, w-96 on desktop */}
      <div
        className={`fixed right-0 top-0 z-30 h-full transform border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out ${
          isMobile ? 'w-full' : 'w-96'
        } ${isExpanded ? 'translate-x-0' : 'translate-x-full'} ${className}`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">LEO Assistant</h3>
                {/* Channel selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowChannelMenu(!showChannelMenu)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Hash size={10} />
                    <span className="truncate max-w-[120px]">
                      {activeChannelData?.name || activeChannel || 'general'}
                    </span>
                    <ChevronDown size={10} />
                  </button>
                  {showChannelMenu && !isLoadingChannels && channels.length > 1 && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-background shadow-lg py-1">
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
            <button
              onClick={() => setIsExpanded(false)}
              className={`flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
                isMobile ? 'h-8 w-8' : 'h-6 w-6'
              }`}
              title="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
