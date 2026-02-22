'use client'

import React, { useRef, useEffect, useCallback, useState } from 'react'
import type { ChatMessage } from './types'

interface MessageListProps {
  messages: ChatMessage[]
  isLoading?: boolean
  /** Full-page immersive mode (centered layout, avatars, streaming cursor) */
  fullPage?: boolean
  /** Infinite scroll support */
  isLoadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
}

// ---------------------------------------------------------------------------
// Date separator helpers
// ---------------------------------------------------------------------------

function formatDateSeparator(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' })
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// ---------------------------------------------------------------------------
// Tool call status pill
// ---------------------------------------------------------------------------

function ToolCallIndicator({ toolCall }: { toolCall: string }) {
  const toolLabels: Record<string, string> = {
    query_products: 'Searching products',
    query_posts: 'Looking up posts',
    query_bookings: 'Checking bookings',
    query_spaces: 'Listing spaces',
    query_projects: 'Searching projects',
    query_availability: 'Checking availability',
    create_booking: 'Creating booking',
    update_booking_status: 'Updating booking',
    add_to_cart: 'Adding to cart',
    view_cart: 'Loading cart',
    generate_image: '🎨 Generating image',
    improve_image: '✨ Improving image',
    attach_image_to_product: '📎 Attaching to product',
    replace_image: '🔄 Replacing image',
  }
  const label = toolLabels[toolCall] || toolCall
  return (
    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
      <span>{label}&hellip;</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline Image Display
// ---------------------------------------------------------------------------

function MessageImages({ images }: { images: NonNullable<ChatMessage['images']> }) {
  if (images.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {images.map((img, i) => (
        <a
          key={i}
          href={img.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative overflow-hidden rounded-lg border border-border/50 transition-shadow hover:shadow-lg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.alt || 'Generated image'}
            className="h-auto max-h-64 w-auto max-w-full rounded-lg object-cover"
            loading="lazy"
          />
          {img.mediaId && (
            <span className="absolute bottom-1 right-1 rounded bg-black/50 px-1.5 py-0.5 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              Media #{img.mediaId}
            </span>
          )}
        </a>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Streaming cursor (blinking bar)
// ---------------------------------------------------------------------------

function StreamingCursor() {
  return (
    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground/60" />
  )
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

/** Generate a deterministic HSL hue from a string (for consistent user avatar colors) */
function stringToHue(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

function Avatar({ name, isLeo, isStreaming }: { name: string; isLeo: boolean; isStreaming?: boolean }) {
  if (isLeo) {
    return (
      <div className="relative">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-[10px] font-bold text-white shadow-sm ${isStreaming ? 'ring-2 ring-blue-400/50 animate-pulse' : ''}`}>
          &#10022;
        </div>
        {/* Online status dot */}
        <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
      </div>
    )
  }
  const initials = name
    .split(/[\s@]/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const hue = stringToHue(name)
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
    >
      {initials || '?'}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Truncated Message — CSS line-clamp with expand/collapse toggle
// ---------------------------------------------------------------------------

const TRUNCATE_THRESHOLD = 200

function TruncatedMessage({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const shouldTruncate = !isStreaming && content.length > TRUNCATE_THRESHOLD

  return (
    <>
      <div className={`whitespace-pre-wrap ${shouldTruncate && !expanded ? 'line-clamp-4' : ''}`}>
        {content}
        {isStreaming && <StreamingCursor />}
      </div>
      {shouldTruncate && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          className="mt-1 text-xs font-medium text-primary/80 hover:text-primary transition-colors"
        >
          {expanded ? 'Show less' : 'More'}
        </button>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Compact Mode (existing bubble style — for MinimalistChat & MultiChannelChat)
// ---------------------------------------------------------------------------

function CompactMessageList({ messages, isLoading, isLoadingMore, hasMore, onLoadMore }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const prevScrollHeight = useRef<number>(0)
  const prevCountRef = useRef(messages.length)
  const [showNewBadge, setShowNewBadge] = useState(false)

  // Smart scroll — only auto-scroll if user is near bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const threshold = 100
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setShowNewBadge(false)
    } else if (messages.length > prevCountRef.current) {
      setShowNewBadge(true)
    }
    prevCountRef.current = messages.length
  }, [messages])

  // Dismiss badge when user scrolls back to bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      const threshold = 100
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
      if (isNearBottom) setShowNewBadge(false)
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  // Preserve scroll position when prepending older messages
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isLoadingMore) return
    prevScrollHeight.current = el.scrollHeight
  }, [isLoadingMore])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || isLoadingMore) return
    if (prevScrollHeight.current > 0) {
      const diff = el.scrollHeight - prevScrollHeight.current
      el.scrollTop += diff
      prevScrollHeight.current = 0
    }
  }, [messages, isLoadingMore])

  // Infinite scroll — IntersectionObserver on sentinel at top
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
        onLoadMore()
      }
    },
    [hasMore, isLoadingMore, onLoadMore],
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(observerCallback, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [observerCallback])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        No messages yet. Start a conversation!
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="relative flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {isLoadingMore && (
        <div className="flex justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        </div>
      )}

      {/* Spacer pushes messages toward the bottom when few messages exist */}
      <div className="flex-1" />
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : msg.role === 'system'
                  ? 'border border-border bg-muted/50 text-muted-foreground italic'
                  : 'bg-muted text-foreground'
            }`}
          >
            {msg.role === 'leo' && msg.authorName && (
              <div className="mb-1 text-xs font-medium opacity-70">{msg.authorName}</div>
            )}
            {msg.activeToolCall && <ToolCallIndicator toolCall={msg.activeToolCall} />}
            <TruncatedMessage content={msg.content} isStreaming={msg.isStreaming} />
            {msg.images && msg.images.length > 0 && <MessageImages images={msg.images} />}
            <div className="mt-1 text-[10px] opacity-50">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce [animation-delay:0.1s]">.</span>
              <span className="animate-bounce [animation-delay:0.2s]">.</span>
            </div>
          </div>
        </div>
      )}

      {/* New messages badge */}
      {showNewBadge && (
        <button
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            setShowNewBadge(false)
          }}
          className="sticky bottom-2 mx-auto flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          New messages
        </button>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Full-Page Mode (immersive centered layout)
// ---------------------------------------------------------------------------

type MessageGroup = {
  authorName: string
  role: ChatMessage['role']
  messages: ChatMessage[]
}

function FullPageMessageList({
  messages,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const prevScrollHeight = useRef<number>(0)

  // Auto-scroll to bottom on new messages (unless user scrolled up)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const threshold = 200
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Preserve scroll position when prepending older messages
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isLoadingMore) return
    prevScrollHeight.current = el.scrollHeight
  }, [isLoadingMore])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || isLoadingMore) return
    if (prevScrollHeight.current > 0) {
      const diff = el.scrollHeight - prevScrollHeight.current
      el.scrollTop += diff
      prevScrollHeight.current = 0
    }
  }, [messages, isLoadingMore])

  // Infinite scroll — IntersectionObserver on sentinel at top
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
        onLoadMore()
      }
    },
    [hasMore, isLoadingMore, onLoadMore],
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(observerCallback, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [observerCallback])

  // Build groups with date separators
  const groups: Array<{ type: 'date'; label: string } | { type: 'group'; group: MessageGroup }> =
    []
  let lastDate: Date | null = null
  let currentGroup: MessageGroup | null = null

  for (const msg of messages) {
    if (!lastDate || !isSameDay(lastDate, msg.timestamp)) {
      if (currentGroup) {
        groups.push({ type: 'group', group: currentGroup })
        currentGroup = null
      }
      groups.push({ type: 'date', label: formatDateSeparator(msg.timestamp) })
      lastDate = msg.timestamp
    }

    if (
      currentGroup &&
      currentGroup.role === msg.role &&
      currentGroup.authorName === (msg.authorName || '')
    ) {
      currentGroup.messages.push(msg)
    } else {
      if (currentGroup) {
        groups.push({ type: 'group', group: currentGroup })
      }
      currentGroup = {
        authorName: msg.authorName || '',
        role: msg.role,
        messages: [msg],
      }
    }
  }
  if (currentGroup) {
    groups.push({ type: 'group', group: currentGroup })
  }

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mb-3 text-4xl opacity-40">&#10022;</div>
          <p className="text-sm text-muted-foreground">Start a conversation with LEO.</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Ask about products, bookings, or anything on the platform.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          </div>
        )}

        {groups.map((item, idx) => {
          if (item.type === 'date') {
            return (
              <div key={`date-${idx}`} className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                  {item.label}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )
          }

          const { group } = item
          const isUser = group.role === 'user'
          const isSystem = group.role === 'system'
          const isLeo = group.role === 'leo'

          return (
            <div
              key={`group-${idx}`}
              className={`mb-5 flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar — only on first message of group */}
              {!isSystem && (
                <div className="mt-0.5 shrink-0">
                  <Avatar name={group.authorName || (isLeo ? 'LEO' : '?')} isLeo={isLeo} isStreaming={isLeo && group.messages.some((m) => m.isStreaming)} />
                </div>
              )}

              <div
                className={`flex min-w-0 flex-1 flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* Author name — only for LEO, shown once per group */}
                {isLeo && group.authorName && (
                  <span className="mb-0.5 text-xs font-medium text-muted-foreground">
                    {group.authorName}
                  </span>
                )}

                {group.messages.map((msg, msgIdx) => {
                  const isFirst = msgIdx === 0
                  const isLast = msgIdx === group.messages.length - 1

                  return (
                    <div
                      key={msg.id}
                      className={`max-w-[85%] ${isSystem ? 'mx-auto text-center' : ''}`}
                    >
                      {msg.activeToolCall && <ToolCallIndicator toolCall={msg.activeToolCall} />}

                      <div
                        className={`px-4 py-2.5 text-sm leading-relaxed ${
                          isUser
                            ? `bg-primary text-primary-foreground ${
                                isFirst && isLast
                                  ? 'rounded-2xl'
                                  : isFirst
                                    ? 'rounded-2xl rounded-br-lg'
                                    : isLast
                                      ? 'rounded-2xl rounded-tr-lg'
                                      : 'rounded-lg'
                              }`
                            : isSystem
                              ? 'rounded-xl border border-border bg-muted/50 text-xs text-muted-foreground italic'
                              : `bg-muted/60 text-foreground ${
                                  isFirst && isLast
                                    ? 'rounded-2xl'
                                    : isFirst
                                      ? 'rounded-2xl rounded-bl-lg'
                                      : isLast
                                        ? 'rounded-2xl rounded-tl-lg'
                                        : 'rounded-lg'
                                }`
                        }`}
                      >
                        {msg.isStreaming && !msg.content && !msg.activeToolCall ? (
                        <div className="whitespace-pre-wrap">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <span className="animate-bounce text-xs">.</span>
                            <span className="animate-bounce text-xs [animation-delay:0.1s]">
                              .
                            </span>
                            <span className="animate-bounce text-xs [animation-delay:0.2s]">
                              .
                            </span>
                          </span>
                        </div>
                      ) : (
                        <TruncatedMessage content={msg.content} isStreaming={msg.isStreaming} />
                      )}
                        {msg.images && msg.images.length > 0 && (
                          <MessageImages images={msg.images} />
                        )}
                      </div>

                      {isLast && (
                        <div
                          className={`mt-1 text-[10px] text-muted-foreground/40 ${isUser ? 'text-right' : ''}`}
                        >
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Loading dots for batch (non-streaming) responses */}
        {isLoading && !messages.some((m) => m.isStreaming) && (
          <div className="mb-5 flex gap-3">
            <div className="mt-0.5 shrink-0">
              <Avatar name="LEO" isLeo />
            </div>
            <div>
              <div className="rounded-2xl bg-muted/60 px-4 py-2.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="animate-bounce text-sm">.</span>
                  <span className="animate-bounce text-sm [animation-delay:0.1s]">.</span>
                  <span className="animate-bounce text-sm [animation-delay:0.2s]">.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Export — dual mode
// ---------------------------------------------------------------------------

export function MessageList(props: MessageListProps) {
  if (props.fullPage) {
    return <FullPageMessageList {...props} />
  }
  return <CompactMessageList {...props} />
}
