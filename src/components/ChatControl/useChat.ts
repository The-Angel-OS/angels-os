'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage, ChatChannel } from './types'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || ''

/**
 * Grace period (ms) after streaming finishes before allowing poll to overwrite.
 * Prevents race condition where poll replaces messages before server persists.
 */
const STREAM_DONE_GRACE_MS = 3000

import { TOOL_LABELS } from '@/constants/toolLabels'

/**
 * Extract image URLs and media IDs from LEO response text.
 * LEO includes image URLs inline — patterns like:
 *   URL: https://...  or  Media ID: 123  or  ![alt](url)
 */
function extractImagesFromText(text: string): Array<{ url: string; alt?: string; mediaId?: number }> {
  const images: Array<{ url: string; alt?: string; mediaId?: number }> = []
  const seen = new Set<string>()

  // Match markdown images: ![alt](url)
  const mdPattern = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = mdPattern.exec(text)) !== null) {
    const url = match[2]
    if (!seen.has(url)) {
      seen.add(url)
      images.push({ url, alt: match[1] || undefined })
    }
  }

  // Match standalone image URLs (common patterns from LEO's image generation)
  // Also match URLs without explicit extension (Vercel Blob URLs may not have one)
  const urlPattern = /(?:URL|Image|Preview|Generated):\s*(https?:\/\/[^\s"')]+)/gi
  while ((match = urlPattern.exec(text)) !== null) {
    const url = match[1]
    if (!seen.has(url)) {
      seen.add(url)
      images.push({ url })
    }
  }

  // Match Vercel Blob URLs (our storage) — broad pattern to catch all variants
  const blobPattern = /(https?:\/\/[a-z0-9._-]+\.public\.blob\.vercel-storage\.com\/[^\s"')]+)/gi
  while ((match = blobPattern.exec(text)) !== null) {
    const url = match[1]
    if (!seen.has(url)) {
      seen.add(url)
      images.push({ url })
    }
  }

  // Match Payload media URLs (local dev or self-hosted)
  const mediaUrlPattern = /(?:\/api\/media\/file\/|\/media\/)[^\s"')]+\.(?:png|jpg|jpeg|webp|gif|svg)/gi
  while ((match = mediaUrlPattern.exec(text)) !== null) {
    const url = match[0].startsWith('http') ? match[0] : `${typeof window !== 'undefined' ? window.location.origin : ''}${match[0]}`
    if (!seen.has(url)) {
      seen.add(url)
      images.push({ url })
    }
  }

  // Extract media IDs and associate with images
  const mediaIdPattern = /Media\s*(?:ID|#):\s*(\d+)/gi
  const mediaIds: number[] = []
  while ((match = mediaIdPattern.exec(text)) !== null) {
    mediaIds.push(parseInt(match[1], 10))
  }
  // Associate media IDs with images positionally
  for (let i = 0; i < Math.min(mediaIds.length, images.length); i++) {
    images[i].mediaId = mediaIds[i]
  }

  return images
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
 * Extended options for DM-aware channel loading.
 * All fields optional — existing callers pass (spaceId, channelSlug) unchanged.
 */
export interface UseChatOpts {
  /** Tenant ID for DM channel queries */
  tenantId?: string
  /** Direct channel ID — load this specific channel instead of querying by space */
  channelId?: string
  /**
   * Override the space used for channel LIST loading.
   * When set, channels are always fetched from this space, regardless of the
   * spaceId passed for message loading (which may switch to dmSpaceId for DMs).
   * Prevents the sidebar channel list from clearing when switching to DM channels.
   */
  channelSpaceId?: string
}

/**
 * Core chat hook - handles messages, channels, and LEO communication.
 * Supports SSE streaming responses with fallback to batch /api/leo.
 * Includes cursor-based pagination for infinite scroll.
 *
 * Extended in Sprint 12 with optional `opts` for DM-aware channel loading.
 * Existing callers pass (spaceId, channelSlug) — no changes needed.
 */
export function useChat(spaceId?: string, channelSlug?: string, opts?: UseChatOpts) {
  // Separate space IDs: channels always load from channelSpaceId (stable),
  // messages use spaceId which may flip to dmSpaceId for DM routing.
  const channelSpaceId = opts?.channelSpaceId ?? spaceId
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
  /** Abort controller for in-flight SSE stream — cancel on channel switch */
  const streamAbortRef = useRef<AbortController | null>(null)
  /** Timestamp when last stream finished — prevents poll from clobbering during grace period */
  const streamDoneAtRef = useRef<number>(0)

  // Fetch channels for a space
  const loadChannels = useCallback(async () => {
    if (!channelSpaceId || authFailedRef.current) return
    setIsLoadingChannels(true)
    try {
      const res = await fetch(
        `${SERVER_URL}/api/channels?where[space][equals]=${channelSpaceId}&sort=name&limit=50`,
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
  }, [channelSpaceId, channelSlug])

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
    // Extract metadata fields from the message's metadata JSON
    const msgMeta = msg.metadata && typeof msg.metadata === 'object'
      ? (msg.metadata as Record<string, unknown>)
      : undefined

    // Extract images from attachments array (relationship to media)
    const attachmentImages: ChatMessage['images'] = []
    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments as Array<Record<string, unknown>>) {
        const media = att.media as Record<string, unknown> | number | null
        if (media && typeof media === 'object') {
          const url = (media.url as string) || `/api/media/file/${media.filename as string}`
          if (url) {
            attachmentImages.push({
              url,
              alt: (att.caption as string) || (media.alt as string) || undefined,
              mediaId: media.id as number | undefined,
            })
          }
        }
      }
    }

    // Also extract images from message text content
    const content = extractText(msg.content)
    const textImages = extractImagesFromText(content)

    // Merge attachment images + text images (deduplicated)
    const seenUrls = new Set(attachmentImages.map((img) => img.url))
    const allImages = [
      ...attachmentImages,
      ...textImages.filter((img) => !seenUrls.has(img.url)),
    ]

    return {
      id: String(msg.id),
      role: isSystem || msg.messageType === 'ai_agent'
        ? 'leo'
        : msg.messageType === 'system' || msg.messageType === 'announcement'
          ? 'system'
          : 'user',
      content,
      timestamp: new Date(String(msg.createdAt)),
      authorName,
      ...(allImages.length > 0 ? { images: allImages } : {}),
      metadata: {
        messageType: String(msg.messageType || 'user'),
        agentName: msgMeta?.agentName as string | undefined,
        agentType: msgMeta?.agentType as string | undefined,
        conversationId: msgMeta?.conversationId as string | undefined,
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
        // Only replace if not currently streaming AND outside grace period
        // The grace period prevents poll from clobbering messages before server persists
        setMessages((prev) => {
          const streaming = prev.find((m) => m.isStreaming)
          if (streaming) return prev
          // Within grace period after stream finished — keep client state
          const msSinceDone = Date.now() - streamDoneAtRef.current
          if (streamDoneAtRef.current > 0 && msSinceDone < STREAM_DONE_GRACE_MS) return prev
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
    async (
      content: string,
      leoMsgId: string,
      images?: Array<{ url: string; mediaId?: number; alt?: string }>,
    ): Promise<boolean> => {
      try {
        // Cancel any previous stream
        streamAbortRef.current?.abort()
        const controller = new AbortController()
        streamAbortRef.current = controller

        const res = await fetch(`${SERVER_URL}/api/leo/stream`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            conversationId: conversationIdRef.current,
            channelSlug: activeChannel,
            spaceId,
            ...(images && images.length > 0 ? { images } : {}),
          }),
          signal: controller.signal,
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
            lastDeltaAt: Date.now(),
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
                    // Append text chunk to streaming message + update liveness timestamp
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === leoMsgId
                          ? { ...m, content: m.content + String(data.text || ''), lastDeltaAt: Date.now() }
                          : m,
                      ),
                    )
                    break

                  case 'tool_call':
                    // Show tool call status + update liveness timestamp
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === leoMsgId
                          ? {
                              ...m,
                              lastDeltaAt: Date.now(),
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

                  case 'done': {
                    // Finalize message — extract images from text + SSE data
                    const finalText = String(data.text || '')
                    const textImages = extractImagesFromText(finalText)
                    const sseImages = Array.isArray(data.images)
                      ? (data.images as Array<{ url: string; alt?: string; mediaId?: number }>)
                      : []
                    // Merge: SSE images first (authoritative), then text-extracted (deduplicated)
                    const seenUrls = new Set(sseImages.map((img) => img.url))
                    const allImages = [
                      ...sseImages,
                      ...textImages.filter((img) => !seenUrls.has(img.url)),
                    ]

                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === leoMsgId
                          ? {
                              ...m,
                              content: finalText || m.content,
                              isStreaming: false,
                              activeToolCall: undefined,
                              authorName: String(data.agentName || 'LEO'),
                              ...(allImages.length > 0 ? { images: allImages } : {}),
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
                    // Record when stream finished — protects against poll race condition
                    streamDoneAtRef.current = Date.now()
                    break
                  }

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

        streamAbortRef.current = null
        return true
      } catch (err) {
        streamAbortRef.current = null
        // AbortError is expected when switching channels — not a real failure
        if (err instanceof DOMException && err.name === 'AbortError') return true
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
          const responseText =
            leoData.response || leoData.text || "I'm here to help. Could you tell me more?"
          const batchImages = extractImagesFromText(responseText)
          const leoMessage: ChatMessage = {
            id: leoMsgId,
            role: 'leo',
            content: responseText,
            timestamp: new Date(),
            authorName: leoData.agentName || 'LEO',
            ...(batchImages.length > 0 ? { images: batchImages } : {}),
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

  // Send a message (with optional file attachments)
  const sendMessage = useCallback(
    async (content: string, files?: File[]) => {
      if ((!content.trim() && (!files || files.length === 0)) || !spaceId) return

      // Optimistic UI update — show images immediately from File objects
      const tempId = `temp_${Date.now()}`
      const previewImages = files?.map((f) => ({
        url: URL.createObjectURL(f),
        alt: f.name,
      }))
      const optimistic: ChatMessage = {
        id: tempId,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
        authorName: 'You',
        ...(previewImages && previewImages.length > 0 ? { images: previewImages } : {}),
      }
      setMessages((prev) => [...prev, optimistic])
      setIsLoading(true)

      try {
        // Upload files to /api/media if provided
        let attachments: Array<{ media: number; caption?: string }> | undefined
        const uploadedImageUrls: Array<{ url: string; mediaId: number; alt?: string }> = []

        if (files && files.length > 0) {
          attachments = []
          for (const file of files) {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('alt', file.name)
            const uploadRes = await fetch(`${SERVER_URL}/api/media`, {
              method: 'POST',
              credentials: 'include',
              body: formData,
            })
            if (uploadRes.ok) {
              const mediaDoc = await uploadRes.json()
              const mediaId = mediaDoc.doc?.id || mediaDoc.id
              attachments.push({ media: mediaId, caption: file.name })
              // Collect URLs for LEO vision
              const mediaUrl = mediaDoc.doc?.url || mediaDoc.url || `/api/media/file/${mediaDoc.doc?.filename || mediaDoc.filename}`
              uploadedImageUrls.push({ url: mediaUrl, mediaId, alt: file.name })
            }
          }
        }

        // Send user message via the /api/chat/send endpoint which uses
        // Payload's local API — bypasses the multi-tenant plugin's
        // filterOptions validation on the space relationship field.
        const spaceIdNum = Number(spaceId)
        const umsContent = { type: 'text', text: content.trim() }
        const res = await fetch(`${SERVER_URL}/api/chat/send`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: umsContent,
            space: Number.isNaN(spaceIdNum) ? spaceId : spaceIdNum,
            channel: activeChannel,
            messageType: 'user',
            ...(attachments && attachments.length > 0 ? { attachments } : {}),
          }),
        })

        if (!res.ok) {
          // Capture response body for diagnostics
          let detail = ''
          try {
            const body = await res.json()
            detail = JSON.stringify(body.errors || body, null, 2)
          } catch {
            // response wasn't JSON
          }
          console.error(`[useChat] POST /api/chat/send ${res.status}`, detail)
          throw new Error(`Failed to send: ${res.status}`)
        }

        const saved = await res.json()

        // Replace optimistic message with real one (and replace blob URLs with real media URLs)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: String(saved.doc?.id || saved.id || tempId),
                  ...(uploadedImageUrls.length > 0 ? { images: uploadedImageUrls } : {}),
                }
              : m,
          ),
        )

        // Ask LEO to respond — try streaming first, fallback to batch
        const leoMsgId = `leo_${Date.now()}`
        const streamed = await sendViaStream(content.trim(), leoMsgId, uploadedImageUrls)
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

  // Create a new channel in the current space
  const createChannel = useCallback(
    async (name: string, type: string = 'general', description?: string) => {
      if (!spaceId) return null
      try {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const spaceIdNum = Number(spaceId)
        const res = await fetch(`${SERVER_URL}/api/channels`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            slug,
            type,
            description: description || undefined,
            space: Number.isNaN(spaceIdNum) ? spaceId : spaceIdNum,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const newChannel: ChatChannel = {
            id: String(data.doc?.id || data.id),
            name,
            slug,
            description,
            type,
            spaceId: String(spaceId),
            isDefault: false,
          }
          setChannels((prev) => [...prev, newChannel])
          return newChannel
        }
        return null
      } catch (err) {
        console.error('Failed to create channel:', err)
        return null
      }
    },
    [spaceId],
  )

  // Delete a channel
  const deleteChannel = useCallback(
    async (channelId: string) => {
      try {
        const res = await fetch(`${SERVER_URL}/api/channels/${channelId}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (res.ok) {
          setChannels((prev) => {
            const remaining = prev.filter((c) => c.id !== channelId)
            // If active channel was deleted, switch to first remaining
            if (remaining.length > 0) {
              const deleted = prev.find((c) => c.id === channelId)
              if (deleted && deleted.slug === activeChannel) {
                const fallback = remaining.find((c) => c.isDefault) || remaining[0]
                setActiveChannel(fallback.slug)
                setMessages([])
                setHasMore(true)
              }
            }
            return remaining
          })
          return true
        }
        return false
      } catch (err) {
        console.error('Failed to delete channel:', err)
        return false
      }
    },
    [activeChannel],
  )

  // Switch channel — abort in-flight streams and reset state
  const switchChannel = useCallback((slug: string) => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    streamDoneAtRef.current = 0
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
    createChannel,
    deleteChannel,
    loadMessages,
    loadMoreMessages,
  }
}
