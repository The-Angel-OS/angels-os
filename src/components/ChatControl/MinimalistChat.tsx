'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { MessageCircle, X, Minus, ChevronDown } from 'lucide-react'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { useChat } from './useChat'
import { useIsMobile } from '@/utilities/useMediaQuery'
import type { ChatControlProps } from './types'

/**
 * Minimalist mode - floating bubble in corner.
 *
 * Desktop: click to expand into a 380x520 chat window.
 * Mobile: click to expand into a bottom sheet (85vh, slides up from bottom).
 *   - Swipe down to dismiss
 *   - Backdrop overlay to close
 *   - Touch-friendly sizing
 */
export function MinimalistChat({
  spaceId,
  channelSlug,
  position = 'bottom-right',
}: ChatControlProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const isMobile = useIsMobile()
  const { messages, isLoading, sendMessage, activeChannel } = useChat(spaceId, channelSlug)

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isMobile, isOpen])

  // Swipe-to-dismiss for mobile bottom sheet
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchDelta, setTouchDelta] = useState(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY)
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (touchStart === null) return
      const delta = e.touches[0].clientY - touchStart
      // Only allow downward swipe
      if (delta > 0) setTouchDelta(delta)
    },
    [touchStart],
  )

  const handleTouchEnd = useCallback(() => {
    if (touchDelta > 100) {
      setIsOpen(false)
    }
    setTouchStart(null)
    setTouchDelta(0)
  }, [touchDelta])

  const positionClasses =
    position === 'bottom-left' ? 'bottom-5 left-5' : 'bottom-5 right-5'

  // Floating button (closed state)
  if (!isOpen) {
    return (
      <div className={`fixed z-50 ${positionClasses}`}>
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-sidebar text-sidebar-foreground border border-sidebar-border shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
          title="Chat with LEO"
          aria-label="Open chat"
        >
          <MessageCircle size={24} />
        </button>
      </div>
    )
  }

  // ─── Mobile Bottom Sheet ───
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-50 bg-black/40 transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />

        {/* Bottom Sheet */}
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-card text-card-foreground shadow-2xl transition-transform duration-300 ease-out"
          style={{
            height: '85vh',
            transform: touchDelta > 0 ? `translateY(${touchDelta}px)` : 'translateY(0)',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                L
              </div>
              <div>
                <div className="text-sm font-semibold">LEO</div>
                <div className="text-[11px] text-muted-foreground">
                  {activeChannel ? `#${activeChannel}` : 'Angel OS'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted active:bg-muted/80"
              aria-label="Close chat"
            >
              <ChevronDown size={20} />
            </button>
          </div>

          {/* Messages */}
          <MessageList messages={messages} isLoading={isLoading} />

          {/* Input - touch friendly */}
          <MessageInput
            onSend={sendMessage}
            disabled={isLoading}
            placeholder="Message LEO..."
          />
        </div>
      </>
    )
  }

  // ─── Desktop Chat Window ───
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
        <div className="flex min-h-[56px] items-center justify-between px-4 bg-sidebar text-sidebar-foreground">
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
