'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage, ChatChannel } from './types'
import { logClientError } from '@/utilities/logClientError'

// Use relative URLs so fetch always targets the current domain/subdomain.
// Previously used NEXT_PUBLIC_SERVER_URL which was baked at build time to
// www.spacesangels.com — breaking cross-origin on tenant subdomains like
// clearwater-cruisin.spacesangels.com (requests went to wrong host → 503).
const SERVER_URL = ''

/**
 * Grace period (ms) after streaming finishes before allowing poll to overwrite.
 * Prevents race condition where poll replaces messages before server persists.
 */
const STREAM_DONE_GRACE_MS = 3000

// ─── Decaying Poll Interval ──────────────────────────────────────────────
// Starts fast when activity is detected, backs off exponentially when idle.
// Resets to fast on any user activity (send, receive, channel switch).
//
//   Active:  2s → 3s → 5s → 8s → 12s → 20s → 30s (cap)
//   Factor:  ×1.5 per idle tick, capped at 30s
//   Reset:   any user/LEO message → back to 2s
// ──────────────────────────────────────────────────────────────────────────
const POLL_MIN_MS = 2000
const POLL_MAX_MS = 30000
const POLL_DECAY_FACTOR = 1.5

/** Initial message window per channel. Kept small — a screenful; older messages
 *  page in on scroll-up (rarely needed). Trimmed from 50 to cut the first paint. */
const INITIAL_MESSAGE_LIMIT = 25

/** Pseudo-channel slug for the space-level Catch-All triage view (also a real
 *  AI Bus channel; the view aggregates messages whose channel isn't curated). */
export const CATCH_ALL_SLUG = 'catch-all'

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
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollIntervalRef = useRef(POLL_MIN_MS)
  const lastMessageIdRef = useRef<string | null>(null)
  /** Tracks auth failures — resets on channel/space switch so users aren't permanently locked out */
  const authFailedRef = useRef(false)
  /** Abort controller for in-flight SSE stream — cancel on channel switch */
  const streamAbortRef = useRef<AbortController | null>(null)
  /** Oldest message timestamp for loadMoreMessages cursor — avoids `messages` dep in callback */
  const oldestTimestampRef = useRef<string | null>(null)
  /** Timestamp when last stream finished — prevents poll from clobbering during grace period */
  const streamDoneAtRef = useRef<number>(0)

  // Keep oldest-message cursor ref in sync (avoids messages dep in loadMoreMessages)
  useEffect(() => {
    if (messages.length > 0) {
      oldestTimestampRef.current = messages[0].timestamp.toISOString()
    } else {
      oldestTimestampRef.current = null
    }
  }, [messages])

  // Fetch channels for a space
  const loadChannels = useCallback(async () => {
    if (!channelSpaceId || authFailedRef.current) return
    setIsLoadingChannels(true)
    try {
      const res = await fetch(
        `${SERVER_URL}/api/channels?where[space][equals]=${channelSpaceId}&where[type][not_equals]=dm&sort=name&limit=50`,
        { credentials: 'include' },
      )
      if (res.status === 401 || res.status === 403) {
        authFailedRef.current = true
        setIsLoadingChannels(false)
        // Show the user what happened instead of silently failing
        setMessages((prev) => {
          if (prev.some((m) => m.id === 'auth_error')) return prev
          return [...prev, {
            id: 'auth_error',
            role: 'system' as const,
            content: res.status === 401
              ? 'You need to sign in to access this space.'
              : 'You don\'t have access to this space yet. Ask an admin to invite you.',
            timestamp: new Date(),
          }]
        })
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
        if (mapped.length > 0) {
          // Resolve the incoming channel identifier to its SLUG. Deep-link URLs use
          // the channel ID (/dashboard/spaces/{spaceId}/{channelId}); older links use
          // the slug. Messages.channel is the SLUG, so passing a raw id straight
          // through made every message query (channel=<id>) return nothing — the
          // "message vanishes / LEO stuck" bug. Match by slug first, then by id; if
          // neither (or no channel given), restore the last-viewed, else default.
          let target: string | undefined
          if (channelSlug) {
            target = mapped.find((c) => c.slug === channelSlug)?.slug
              || mapped.find((c) => c.id === channelSlug)?.slug
          }
          if (!target) {
            try {
              const stored = window.localStorage.getItem(`angelos.activeChannel.${channelSpaceId}`)
              if (stored && mapped.some((c) => c.slug === stored)) target = stored
            } catch {
              /* unavailable — fall through to default */
            }
            if (!target) target = (mapped.find((c) => c.isDefault) || mapped[0]).slug
          }
          if (target) setActiveChannel(target)
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
    // Extract metadata fields from the message's metadata JSON
    const msgMeta = msg.metadata && typeof msg.metadata === 'object'
      ? (msg.metadata as Record<string, unknown>)
      : undefined
    const author = msg.author as Record<string, unknown> | null
    const isAgentMsg = msg.messageType === 'ai_agent'
    // Byline: a resolved author wins; otherwise an AI-agent message is its agent
    // (LEO), not "Unknown" — agent messages may have no author row on a freshly
    // provisioned tenant (no per-tenant LEO system user), and the name lives in
    // metadata.agentName regardless.
    const authorName = author
      ? String(author.name || author.email || 'Unknown')
      : isAgentMsg
        ? String(msgMeta?.agentName || 'LEO')
        : 'Unknown'
    const isSystem =
      author &&
      (author.isSystemUser === true ||
        (author.roles && Array.isArray(author.roles) && author.roles.includes('system')))

    // Extract images and file attachments from the attachments array
    const attachmentImages: ChatMessage['images'] = []
    const fileAttachments: NonNullable<ChatMessage['attachments']> = []
    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments as Array<Record<string, unknown>>) {
        const media = att.media as Record<string, unknown> | number | null
        if (media && typeof media === 'object') {
          const url = (media.url as string) || `/api/media/file/${media.filename as string}`
          const mimeType = (media.mimeType as string) || ''
          if (url && mimeType.startsWith('image/')) {
            attachmentImages.push({
              url,
              alt: (att.caption as string) || (media.alt as string) || undefined,
              mediaId: media.id as number | undefined,
            })
          } else if (url) {
            fileAttachments.push({
              url,
              filename: (media.filename as string) || 'file',
              mimeType,
              filesize: media.filesize as number | undefined,
              mediaId: media.id as number | undefined,
            })
          }
        } else if (typeof media === 'number') {
          attachmentImages.push({
            url: `/api/media/file/${media}`,
            alt: (att.caption as string) || undefined,
            mediaId: media,
          })
        }
      }
    }

    // Extract UMS widgets (inline forms, cards, etc.) from structured content
    const rawContent = msg.content as Record<string, unknown> | string
    const widgets: ChatMessage['widgets'] | undefined =
      typeof rawContent === 'object' && rawContent !== null && Array.isArray((rawContent as Record<string, unknown>)?.widgets)
        ? ((rawContent as Record<string, unknown>).widgets as ChatMessage['widgets'])
        : undefined

    // Also extract images from message text content
    const content = extractText(msg.content)
    const textImages = extractImagesFromText(content)

    // Merge attachment images + text images (deduplicated)
    const seenUrls = new Set(attachmentImages.map((img) => img.url))
    const allImages = [
      ...attachmentImages,
      ...textImages.filter((img) => !seenUrls.has(img.url)),
    ]

    // Surface the edit/revision lineage (metadata.revisions, written by the
    // versionOnEdit hook) so the UI can show "edited" + prior versions.
    const rawRevisions = Array.isArray(msgMeta?.revisions) ? (msgMeta!.revisions as Array<Record<string, unknown>>) : []
    const revisions = rawRevisions.map((r) => ({
      content: extractText(r.content),
      editedAt: r.editedAt as string | undefined,
      editedBy: (r.editedBy as string | number | null) ?? null,
      moderation: Boolean(r.moderation),
    }))

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
      ...(msg.channel ? { channel: String(msg.channel) } : {}),
      ...(author?.id != null ? { authorId: String(author.id) } : {}),
      ...(msgMeta?.edited ? { edited: true } : {}),
      ...(msgMeta?.moderated ? { moderated: true } : {}),
      ...(revisions.length > 0 ? { revisions } : {}),
      ...(allImages.length > 0 ? { images: allImages } : {}),
      ...(fileAttachments.length > 0 ? { attachments: fileAttachments } : {}),
      ...(widgets?.length ? { widgets } : {}),
      ...(msgMeta?.error ? { isError: true } : {}),
      ...(msgMeta?.errorDetail ? { errorDetail: String(msgMeta.errorDetail) } : {}),
      metadata: {
        messageType: String(msg.messageType || 'user'),
        agentName: msgMeta?.agentName as string | undefined,
        agentType: msgMeta?.agentType as string | undefined,
        conversationId: msgMeta?.conversationId as string | undefined,
      },
    }
  }, [])

  // The space-level Catch-All view: when this pseudo-channel is active, load ALL
  // messages in the space and keep only the "orphans" — those whose channel isn't
  // one of the space's curated channels (page:* comment channels, connector slugs,
  // anything routed to no recognized filter). Lets an admin triage + sort them.
  const catchAllFilter = useCallback(
    (docs: Array<{ channel?: unknown }>) => {
      const known = new Set(
        channels.map((c) => c.slug).filter((s) => s && s !== CATCH_ALL_SLUG),
      )
      return docs.filter((d) => !known.has(String(d.channel ?? '')))
    },
    [channels],
  )

  // Fetch messages for active channel (latest page)
  const loadMessages = useCallback(async () => {
    if (!spaceId || !activeChannel || authFailedRef.current) return
    const isCatchAll = activeChannel === CATCH_ALL_SLUG
    // Gate on a RESOLVED channel. activeChannel may still be the raw deep-link id
    // (/dashboard/spaces/{spaceId}/{channelId}) until loadChannels maps it to its
    // slug: querying channel=<id> returns nothing (channel is stored as a slug), and
    // querying before the space's channels load lands on the wrong/default channel —
    // both produce the "loads default then switches" double/triple load. Wait until
    // the slug exists in the loaded channels. Catch-All is a pseudo-channel (not in
    // the list) so it bypasses the gate.
    if (!isCatchAll && !channels.some((c) => c.slug === activeChannel)) return
    try {
      const res = await fetch(
        isCatchAll
          ? `${SERVER_URL}/api/messages?where[space][equals]=${spaceId}&sort=-createdAt&limit=100&depth=1`
          : `${SERVER_URL}/api/messages?where[space][equals]=${spaceId}&where[channel][equals]=${encodeURIComponent(activeChannel)}&sort=-createdAt&limit=${INITIAL_MESSAGE_LIMIT}&depth=1`,
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
        const rawDocs = isCatchAll ? catchAllFilter(data.docs || []) : data.docs || []
        const mapped: ChatMessage[] = rawDocs.reverse().map(mapMessage)
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
        // Catch-All is a client-side-filtered triage view — keep it to one page.
        setHasMore(isCatchAll ? false : data.totalDocs > (data.docs || []).length)
      }
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }, [spaceId, activeChannel, channels, mapMessage, catchAllFilter])

  // Load more (older) messages for infinite scroll — cursor-based.
  // Uses oldestTimestampRef instead of messages array to keep this callback
  // stable across message updates (prevents context memo churn in ChatProvider).
  const loadMoreMessages = useCallback(async () => {
    if (!spaceId || !activeChannel || isLoadingMore || !hasMore || authFailedRef.current) return

    setIsLoadingMore(true)
    try {
      // Use the oldest message's timestamp as cursor (via ref, not state)
      const cursor = oldestTimestampRef.current
      if (!cursor) {
        setIsLoadingMore(false)
        return
      }

      const res = await fetch(
        `${SERVER_URL}/api/messages?where[space][equals]=${spaceId}&where[channel][equals]=${encodeURIComponent(activeChannel)}&where[createdAt][less_than]=${encodeURIComponent(cursor)}&sort=-createdAt&limit=30&depth=1`,
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
  }, [spaceId, activeChannel, isLoadingMore, hasMore, mapMessage])

  // ─── Decaying poll: reset callback (declared early for dependency refs) ──
  const resetPollInterval = useCallback(() => {
    pollIntervalRef.current = POLL_MIN_MS
  }, [])

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

                  case 'tier':
                    // Model escalation tier info — show "Deep thinking..." when escalated
                    if (data.isDeepThink) {
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === leoMsgId
                            ? {
                                ...m,
                                lastDeltaAt: Date.now(),
                                activeToolCall: '🧠 Deep thinking...',
                                isDeepThink: true,
                              }
                            : m,
                        ),
                      )
                    }
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

                  case 'images': {
                    // Mid-stream image delivery — append to message immediately
                    const imgArr = Array.isArray(data.images)
                      ? (data.images as Array<{ url: string; alt?: string; mediaId?: number }>)
                      : []
                    if (imgArr.length > 0) {
                      setMessages((prev) =>
                        prev.map((m) => {
                          if (m.id !== leoMsgId) return m
                          const existing = m.images || []
                          const seenUrls = new Set(existing.map((i) => i.url))
                          const newImgs = imgArr.filter((i) => !seenUrls.has(i.url))
                          return newImgs.length > 0
                            ? { ...m, images: [...existing, ...newImgs], lastDeltaAt: Date.now() }
                            : m
                        }),
                      )
                    }
                    break
                  }

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
                    // Reset poll to fast interval — chat is active
                    resetPollInterval()

                    // LEO Navigation Bridge — navigate on tool-driven data mutations
                    if (data.navigateTo && typeof data.navigateTo === 'object') {
                      const nav = data.navigateTo as { path: string; label?: string }
                      if (nav.path && typeof window !== 'undefined') {
                        window.dispatchEvent(
                          new CustomEvent('leo:navigate', { detail: nav }),
                        )
                      }
                    }

                    break
                  }

                  case 'error':
                    // Mark as error — use server message if available, keep partial text if any
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === leoMsgId
                          ? {
                              ...m,
                              content:
                                m.content ||
                                String(data.message || "I'm having trouble right now. Please try again."),
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
    [activeChannel, spaceId, resetPollInterval],
  )

  /**
   * Fallback: send via batch /api/leo endpoint
   */
  const sendViaBatch = useCallback(
    async (
      content: string,
      leoMsgId: string,
      images?: Array<{ url: string; mediaId?: number; alt?: string }>,
    ) => {
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
            ...(images && images.length > 0 ? { images } : {}),
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

      // Reset poll to fast interval on user activity
      resetPollInterval()

      // Optimistic UI update — show image/file previews immediately
      const tempId = `temp_${Date.now()}`
      const imageFiles = files?.filter((f) => f.type.startsWith('image/'))
      const nonImageFiles = files?.filter((f) => !f.type.startsWith('image/'))
      const previewImages = imageFiles?.map((f) => ({
        url: URL.createObjectURL(f),
        alt: f.name,
      }))
      const previewAttachments = nonImageFiles?.map((f) => ({
        url: '#',
        filename: f.name,
        mimeType: f.type,
        filesize: f.size,
      }))
      const optimistic: ChatMessage = {
        id: tempId,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
        authorName: 'You',
        ...(previewImages && previewImages.length > 0 ? { images: previewImages } : {}),
        ...(previewAttachments && previewAttachments.length > 0 ? { attachments: previewAttachments } : {}),
      }
      setMessages((prev) => [...prev, optimistic])
      setIsLoading(true)

      try {
        // Upload files to /api/media if provided
        let attachments: Array<{ media: number; caption?: string }> | undefined
        const uploadedImageUrls: Array<{ url: string; mediaId: number; alt?: string }> = []

        if (files && files.length > 0) {
          attachments = []
          const failedUploads: string[] = []

          // Resolve tenant ID for the multi-tenant media collection.
          // Falls back to payload-tenant cookie (set by multi-tenant plugin).
          let uploadTenantId = opts?.tenantId || ''
          if (!uploadTenantId && typeof document !== 'undefined') {
            const match = document.cookie.match(/payload-tenant=([^;]+)/)
            if (match) uploadTenantId = match[1]
          }

          // Upload files SEQUENTIALLY (one /api/media request at a time).
          // Fanning out N parallel uploads spins up N concurrent Payload
          // requests, each doing image-size generation + a tenant/space lookup.
          // Under the shared DB connection cap (flaky kendev node) that
          // saturates the pool and individual creates fail mid-flight — which
          // surfaces as "invalid tenant id" (the validator throws when the
          // beforeValidate space lookup couldn't complete). A single upload
          // works; five at once don't. Serializing keeps us within the cap.
          const uploadOne = async (file: File) => {
            const formData = new FormData()
            formData.append('file', file)
            // Payload 3.x requires non-file fields as a single JSON `_payload` field
            const payloadFields: Record<string, unknown> = { alt: file.name }
            // Server-authoritative tenant resolution: send the active space id
            // so the Media beforeValidate hook resolves the tenant from the
            // space (works on the platform/Core domain where there's no
            // x-tenant-id header and no payload-tenant cookie). The hook strips
            // this transient field — it is not part of the Media schema.
            if (spaceId) payloadFields._tenantSpace = Number(spaceId) || spaceId
            if (uploadTenantId) payloadFields.tenant = Number(uploadTenantId) || uploadTenantId
            formData.append('_payload', JSON.stringify(payloadFields))
            const uploadRes = await fetch(`${SERVER_URL}/api/media`, {
              method: 'POST',
              credentials: 'include',
              body: formData,
            })
            if (!uploadRes.ok) {
              const errText = await uploadRes.text().catch(() => uploadRes.statusText)
              throw new Error(`Upload "${file.name}" failed (${uploadRes.status}): ${errText}`)
            }
            return { file, data: await uploadRes.json() }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const uploadResults: Array<PromiseSettledResult<{ file: File; data: any }>> = []
          for (const file of files) {
            try {
              uploadResults.push({ status: 'fulfilled', value: await uploadOne(file) })
            } catch (reason) {
              uploadResults.push({ status: 'rejected', reason })
            }
          }
          for (const result of uploadResults) {
            if (result.status === 'fulfilled') {
              const mediaDoc = result.value.data
              const mediaId = mediaDoc.doc?.id || mediaDoc.id
              if (mediaId) {
                attachments.push({ media: mediaId, caption: mediaDoc.doc?.filename || mediaDoc.filename })
                const mediaUrl = mediaDoc.doc?.url || mediaDoc.url || `/api/media/file/${mediaDoc.doc?.filename || mediaDoc.filename}`
                uploadedImageUrls.push({ url: mediaUrl, mediaId, alt: mediaDoc.doc?.filename || mediaDoc.filename })
              } else {
                failedUploads.push(result.value.file.name)
                console.error(`[useChat] Upload returned no mediaId for "${result.value.file.name}":`, mediaDoc)
              }
            } else {
              // Extract filename from the error message or use generic name
              const errMsg = result.reason?.message || String(result.reason)
              const nameMatch = errMsg.match(/Upload "(.+?)" failed/)
              failedUploads.push(nameMatch?.[1] || 'file')
              console.error(`[useChat] File upload failed:`, errMsg)
            }
          }

          // Warn user about failed uploads
          if (failedUploads.length > 0) {
            const names = failedUploads.join(', ')
            const warnMsg =
              failedUploads.length === files.length
                ? `All ${files.length} file(s) failed to upload: ${names}. Message sent without attachments.`
                : `${failedUploads.length} of ${files.length} file(s) failed to upload: ${names}.`
            console.warn(`[useChat] ${warnMsg}`)
            // Show warning as a system message
            setMessages((prev) => [
              ...prev,
              {
                id: `warn_${Date.now()}`,
                role: 'system',
                content: `⚠️ ${warnMsg}`,
                timestamp: new Date(),
              },
            ])
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
          logClientError({
            source: 'ChatControl/sendMessage',
            message: `Send failed (${res.status}) in #${activeChannel}`,
            details: detail,
            spaceId,
          })
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
          await sendViaBatch(content.trim(), leoMsgId, uploadedImageUrls)
        }
      } catch (err) {
        console.error('Failed to send message:', err)
        // Escalate to the canonical pipeline — unless it's the send-status error
        // we already logged above (avoid a duplicate AI Bus entry).
        const msg = err instanceof Error ? err.message : String(err)
        if (!/^Failed to send: \d+$/.test(msg)) {
          logClientError({
            source: 'ChatControl/sendMessage',
            message: `Send pipeline failed in #${activeChannel}: ${msg}`,
            details: err instanceof Error ? err.stack : String(err),
            spaceId,
          })
        }
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
    [spaceId, activeChannel, sendViaStream, sendViaBatch, resetPollInterval],
  )

  // Create a new channel in the CURRENT COMMUNITY space. Must use channelSpaceId,
  // NOT spaceId: spaceId flips to the DM space when a direct message is open, and a
  // channel created against it would land in "Direct Messages" instead of the space
  // whose channel list the user is looking at (the bug that put a 'general' channel
  // in the DM space).
  const createChannel = useCallback(
    async (name: string, type: string = 'general', description?: string) => {
      if (!channelSpaceId) return null
      try {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const spaceIdNum = Number(channelSpaceId)
        const tenantIdNum = opts?.tenantId ? Number(opts.tenantId) : undefined
        const res = await fetch(`${SERVER_URL}/api/channels`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            slug,
            type,
            description: description || undefined,
            space: Number.isNaN(spaceIdNum) ? channelSpaceId : spaceIdNum,
            ...(tenantIdNum && !Number.isNaN(tenantIdNum) ? { tenant: tenantIdNum } : {}),
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
            spaceId: String(channelSpaceId),
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
    [channelSpaceId, opts?.tenantId],
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
    // Reset auth failure flag so users aren't permanently locked out after a 401/403
    authFailedRef.current = false
    resetPollInterval()
    setActiveChannel(slug)
    setMessages([])
    setHasMore(true)
    // Remember this channel for this space (restored on return — see loadChannels).
    try {
      window.localStorage.setItem(`angelos.activeChannel.${channelSpaceId}`, slug)
    } catch {
      /* non-fatal */
    }
  }, [resetPollInterval, channelSpaceId])

  // Load channels on mount
  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  // Load messages when channel changes
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // ─── Decaying poll: fast when active, backs off when idle ──────────
  // Uses recursive setTimeout so each tick can adjust the next delay.
  // Activity (sendMessage, stream delta, channel switch) resets to fast.
  // (resetPollInterval is declared earlier, before sendViaStream)

  useEffect(() => {
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      loadMessages()
      // Decay: increase interval by factor, cap at max
      pollIntervalRef.current = Math.min(
        pollIntervalRef.current * POLL_DECAY_FACTOR,
        POLL_MAX_MS,
      )
      pollingRef.current = setTimeout(tick, pollIntervalRef.current)
    }

    // Start the first tick
    pollingRef.current = setTimeout(tick, pollIntervalRef.current)

    return () => {
      cancelled = true
      if (pollingRef.current) clearTimeout(pollingRef.current)
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
