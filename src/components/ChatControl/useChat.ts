'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage, ChatChannel } from './types'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || ''

/** Tool call display names */
const TOOL_LABELS: Record<string, string> = {
  query_products: 'Looking up products',
  query_posts: 'Searching posts',
  query_bookings: 'Checking bookings',
  query_spaces: 'Finding spaces',
  query_projects: 'Browsing projects',
  query_availability: 'Checking availability',
  add_to_cart: 'Adding to cart',
  view_cart: 'Checking cart',
}

/**
 * Extract displayable text from UMS JSON content.
 * Backward-compatible: handles plain strings, JSON objects with `text` field,
 * and arbitrary JSON data.
 */
function extractText(content: unknown): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (typeof content !== 'object') return String(content)
  const obj = content as Record<string, unknown>
  if (typeof obj.text === 'string') return obj.text
  if (typeof obj.content === 'string') return obj.content
  if (typeof obj.message === 'string') return obj.message
  try { return JSON.stringify(content) } catch { return '[Message]' }
}

/**
 * Core chat hook - handles messages, channels, and LEO communication.
 * Supports SSE streaming responses with fallback to batch /api/leo.
 * Includes cursor-based pagination for infinite scroll.
 */
export function useChat(spaceId?: string, channelSlug?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<string>(channelSlug || 'general')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const conversationIdRef = useRef<string>(
    `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  )
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastMessageIdRef = useRef<string | null>(null)
  const authFailedRef = useRef(false)

  // Fetch channels for a space
  const loadChannels = useCallback(async () => {
    if (!spaceId || authFailedRef.current) return
    setIsLoadingChannels(true)
    try {
      const res = await fetch(
        `${SERVER_URL}/api/channels?where[space][equals]=${spaceId}&sort=name&limit=50`,
        { credentials: 'include' },
      )
      if (res.status === 401 || res.status === 403) {
        authFailedRef.current = true
        setIsLoadingChannels(false)
        return
      }
      if (res.ok) {
        const data = await res.json()
        const mapped: ChatChannel[] = (data.docs || []).map(
          (ch: Record<string, unknown>) => ({
            id: String(ch.id),
            name: String(ch.name || ''),
            slug: String(ch.slug || ch.name || ''),
            description: ch.description ? String(ch.description) : undefined,
            type: String(ch.type || 'general'),
            spaceId: String(
              typeof ch.space === 'object' && ch.space !== null
                ? (ch.space as Record<string, unknown>).id
                : ch.space,
            ),
            isDefault: Boolean(ch.isDefault),
          }),
        )
        setChannels(mapped)
        if (!channelSlug && mapped.length > 0) {
          const defaultCh = mapped.find((c) => c.isDefault) || mapped[0]
          setActiveChannel(defaultCh.slug)
        }
      }
    } catch (err) {
      console.error('Failed to load channels:', err)
    } finally {
      setIsLoadingChannels(false)
    }
  }, [spaceId, channelSlug])

  // Map a raw Payload message doc to our ChatMessage type
  // Handles UMS JSON content via extractText for backward compatibility
  const mapMessage = useCallback((msg: Record<string, unknown>): ChatMessage => {
    const author = msg.author as Record<string, unknown> | null
    const authorName = author
      ? String(author.name || author.email || 'Unknown')
      : 'Unknown'
    const isSystem =
      author &&
      (author.isSystemUser === true ||
        (author.roles && Array.isArray(author.roles) && author.roles.includes('system')))
    return {
      id: String(msg.id),
      role: isSystem
        ? 'leo'
        : msg.messageType === 'system' || msg.messageType === 'announcement'
          ? 'system'
          : 'user',
      content: extractText(msg.content),
      timestamp: new Date(String(msg.createdAt)),
      authorName,
      metadata: {
        messageType: String(msg.messageType || 'user'),
      },
    }
  }, [])

  // Fetch messages for active channel (latest page)
  const loadMessages = useCallback(async () => {
    if (!spaceId || !activeChannel || authFailedRef.current) return
    try {
      const res = await fetch(
        `${SERVER_URL}/api/messages?where[space][equals]=${spaceId}&where[channel][equals]=${activeChannel}&sort=-createdAt&limit=50`,
        { credentials: 'include' },
      )

      if (res.status === 401 || res.status === 403) {
        authFailedRef.current = true
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        return
      }

      if (res.ok) {
        const data = await res.json()
        const mapped: ChatMessage[] = (data.docs || []).reverse().map(mapMessage)
        // Only replace if not currently streaming (avoid clobbering in-progress stream)
        setMessages((prev) => {
          const streaming = prev.find((m) => m.isStreaming)
          if (streaming) return prev
          return mapped
        })
        if (mapped.length > 0) {
          lastMessageIdRef.current = mapped[mapped.length - 1].id
        }
        setHasMore(data.totalDocs > (data.docs || []).length)
      }
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }, [spaceId, activeChannel, mapMessage])

  // Load more (older) messages for infinite scroll — cursor-based
  const loadMoreMessages = useCallback(async () => {
    if (!spaceId || !activeChannel || isLoadingMore || !hasMore || authFailedRef.current) return

    setIsLoadingMore(true)
    try {
      // Use the oldest message's timestamp as cursor
      const oldestMsg = messages[0]
      if (!oldestMsg) {
        setIsLoadingMore(false)
        return
      }
      const cursor = oldestMsg.timestamp.toISOString()

      const res = await fetch(
        `${SERVER_URL}/api/messages?where[space][equals]=${spaceId}&where[channel][equals]=${activeChannel}&where[createdAt][less_than]=${encodeURIComponent(cursor)}&sort=-createdAt&limit=30`,
        { credentials: 'include' },
      )

      if (res.ok) {
        const data = await res.json()
        const older: ChatMessage[] = (data.docs || []).reverse().map(mapMessage)
        if (older.length === 0) {
          setHasMore(false)
        } else {
          // Prepend older messages
          setMessages((prev) => [...older, ...prev])
        }
      }
    } catch (err) {
      console.error('Failed to load older messages:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [spaceId, activeChannel, isLoadingMore, hasMore, messages, mapMessage])

  // ---------------------------------------------------------------------------
  // SSE Streaming Consumer
  // ---------------------------------------------------------------------------

  /**
   * Attempts to send message via SSE streaming endpoint.
   * Returns true if streaming succeeded, false if should fallback to batch.
   */
  const sendViaStream = useCallback(
    async (content: string, leoMsgId: string): Promise<boolean> => {
      try {
        const res = await fetch(`${SERVER_URL}/api/leo/stream`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            conversationId: conversationIdRef.current,
            channelSlug: activeChannel,
            spaceId,
          }),
        })

        if (!res.ok || !res.body) return false

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        // Add the streaming placeholder message
        setMessages((prev) => [
          ...prev,
          {
            id: leoMsgId,
            role: 'leo',
            content: '',
            timestamp: new Date(),
            authorName: 'LEO',
            isStreaming: true,
          },
        ])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Parse SSE events from buffer
          const lines = buffer.split('\n')
          buffer = ''

          let eventType = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              const dataStr = line.slice(6)
              try {
                const data = JSON.parse(dataStr) as Record<string, unknown>

                switch (eventType) {
                  case 'delta':
                    // Append text chunk to streaming message
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === leoMsgId
                          ? { ...m, content: m.content + String(data.text || '') }
                          : m,
                      ),
                    )
                    break

                  case 'tool_call':
                    // Show tool call status
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === leoMsgId
                          ? {
                              ...m,
                              activeToolCall:
                                data.status === 'executing'
                                  ? TOOL_LABELS[data.name as string] ||
                                    `Running ${data.name}`
                                  : TOOL_LABELS[data.name as string] ||
                                    `Calling ${data.name}`,
                            }
                          : m,
                      ),
                    )
                    break

                  case 'done':
                    // Finalize message
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === leoMsgId
                          ? {
                              ...m,
                              content: String(data.text || m.content),
                              isStreaming: false,
                              activeToolCall: undefined,
                              authorName: String(data.agentName || 'LEO'),
                              metadata: {
                                agentName: String(data.agentName || 'LEO'),
                                conversationId: String(
                                  data.conversationId || conversationIdRef.current,
                                ),
                              },
                            }
                          : m,
                      ),
                    )
                    if (data.conversationId) {
                      conversationIdRef.current = String(data.conversationId)
                    }
                    break

                  case 'error':
                    // Mark as error
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === leoMsgId
                          ? {
                              ...m,
                              content:
                                m.content ||
                                "I'm having trouble right now. Please try again.",
                              isStreaming: false,
                              activeToolCall: undefined,
                            }
                          : m,
                      ),
                    )
                    break
                }
              } catch {
                // Partial JSON — will be completed in next chunk
                buffer = line + '\n'
              }
            } else if (line === '') {
              eventType = ''
            } else {
              // Incomplete line — save for next read
              buffer += line + '\n'
            }
          }
        }

        return true
      } catch {
        return false
      }
    },
    [activeChannel, spaceId],
  )

  /**
   * Fallback: send via batch /api/leo endpoint
   */
  const sendViaBatch = useCallback(
    async (content: string, leoMsgId: string) => {
      try {
        const leoRes = await fetch(`${SERVER_URL}/api/leo`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            conversationId: conversationIdRef.current,
            channelSlug: activeChannel,
            spaceId,
          }),
        })

        if (leoRes.ok) {
          const leoData = await leoRes.json()
          const leoMessage: ChatMessage = {
            id: leoMsgId,
            role: 'leo',
            content:
              leoData.response || leoData.text || "I'm here to help. Could you tell me more?",
            timestamp: new Date(),
            authorName: leoData.agentName || 'LEO',
            metadata: {
              agentName: leoData.agentName || 'LEO',
              agentType: leoData.agentType || 'leo',
              conversationId: leoData.conversationId || conversationIdRef.current,
            },
          }
          setMessages((prev) => [...prev, leoMessage])
          if (leoData.conversationId) {
            conversationIdRef.current = leoData.conversationId
          }
        }
      } catch {
        console.warn('LEO response unavailable')
      }
    },
    [activeChannel, spaceId],
  )

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !spaceId) return

      // Optimistic UI update
      const tempId = `temp_${Date.now()}`
      const optimistic: ChatMessage = {
        id: tempId,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
        authorName: 'You',
      }
      setMessages((prev) => [...prev, optimistic])
      setIsLoading(true)

      try {
        // Send user message to Payload — UMS JSON content format
        const spaceIdNum = Number(spaceId)
        const umsContent = { type: 'text', text: content.trim() }
        const res = await fetch(`${SERVER_URL}/api/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: umsContent,
            space: Number.isNaN(spaceIdNum) ? spaceId : spaceIdNum,
            channel: activeChannel,
            messageType: 'user',
          }),
        })

        if (!res.ok) {
          throw new Error(`Failed to send: ${res.status}`)
        }

        const saved = await res.json()

        // Replace optimistic message with real one
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, id: String(saved.doc?.id || saved.id || tempId) }
              : m,
          ),
        )

        // Ask LEO to respond — try streaming first, fallback to batch
        const leoMsgId = `leo_${Date.now()}`
        const streamed = await sendViaStream(content.trim(), leoMsgId)
        if (!streamed) {
          await sendViaBatch(content.trim(), leoMsgId)
        }
      } catch (err) {
        console.error('Failed to send message:', err)
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'system',
            content: 'Failed to send message. Please try again.',
            timestamp: new Date(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [spaceId, activeChannel, sendViaStream, sendViaBatch],
  )

  // Switch channel
  const switchChannel = useCallback((slug: string) => {
    setActiveChannel(slug)
    setMessages([])
    setHasMore(true)
  }, [])

  // Load channels on mount
  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  // Load messages when channel changes
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Poll for new messages every 5s (but not while streaming)
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      loadMessages()
    }, 5000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [loadMessages])

  return {
    messages,
    channels,
    activeChannel,
    isLoading,
    isLoadingChannels,
    isLoadingMore,
    hasMore,
    sendMessage,
    switchChannel,
    loadMessages,
    loadMoreMessages,
  }
}
