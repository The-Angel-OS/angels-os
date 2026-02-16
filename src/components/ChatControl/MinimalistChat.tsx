'use client'

import React, { useState } from 'react'
import { MessageCircle, X, Minus } from 'lucide-react'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { useChat } from './useChat'
import type { ChatControlProps } from './types'

/**
 * Minimalist mode - floating bubble in corner.
 * Click to expand into a chat window.
 * Glassmorphism styling with proper opacity for readability.
 */
export function MinimalistChat({
  spaceId,
  channelSlug,
  position = 'bottom-right',
}: ChatControlProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const { messages, isLoading, sendMessage, activeChannel } = useChat(spaceId, channelSlug)

  const positionClasses =
    position === 'bottom-left' ? 'bottom-5 left-5' : 'bottom-5 right-5'

  // Floating button (closed state)
  if (!isOpen) {
    return (
      <div className={`fixed z-50 ${positionClasses}`}>
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-sidebar text-sidebar-foreground border border-sidebar-border shadow-lg transition-all duration-300 hover:scale-105"
          title="Chat with LEO"
          aria-label="Open chat"
        >
          <MessageCircle size={24} />
        </button>
      </div>
    )
  }

  // Expanded chat window
  return (
    <div className={`fixed z-50 ${positionClasses}`}>
      <div
        className="flex flex-col overflow-hidden rounded-xl border border-border/50 shadow-2xl transition-all duration-300 bg-card text-card-foreground"
        style={{
          width: isMinimized ? '300px' : '380px',
          height: isMinimized ? '56px' : '520px',
        }}
      >
        {/* Header */}
        <div
          className="flex min-h-[56px] items-center justify-between px-4 bg-sidebar text-sidebar-foreground"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              L
            </div>
            <div>
              <div className="text-sm font-semibold">LEO</div>
              <div className="text-[11px] opacity-60">
                {activeChannel ? `#${activeChannel}` : 'Angel OS'}
              </div>
            </div>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="rounded p-1.5 opacity-70 transition-colors hover:bg-sidebar-accent hover:opacity-100"
              aria-label={isMinimized ? 'Expand' : 'Minimize'}
            >
              <Minus size={14} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded p-1.5 opacity-70 transition-colors hover:bg-sidebar-accent hover:opacity-100"
              aria-label="Close chat"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body (hidden when minimized) */}
        {!isMinimized && (
          <>
            <MessageList messages={messages} isLoading={isLoading} />
            <MessageInput
              onSend={sendMessage}
              disabled={isLoading}
              placeholder="Message LEO..."
            />
          </>
        )}
      </div>

    </div>
  )
}
