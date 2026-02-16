'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage, ChatChannel } from './types'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || ''

/**
 * Core chat hook - handles messages, channels, and LEO communication.
 * Talks directly to Payload CMS REST API.
 */
export function useChat(spaceId?: string, channelSlug?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<string>(channelSlug || 'general')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)
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
      // Stop on auth failure
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
        // Auto-select first/default channel if none selected
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

  // Fetch messages for active channel
  const loadMessages = useCallback(async () => {
    if (!spaceId || !activeChannel || authFailedRef.current) return
    try {
      const res = await fetch(
        `${SERVER_URL}/api/messages?where[space][equals]=${spaceId}&where[channel][equals]=${activeChannel}&sort=-createdAt&limit=50`,
        { credentials: 'include' },
      )

      // Stop polling on auth failure to prevent log spam
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
        const mapped: ChatMessage[] = (data.docs || [])
          .reverse()
          .map((msg: Record<string, unknown>) => {
            const author = msg.author as Record<string, unknown> | null
            const authorName = author
              ? String(author.name || author.email || 'Unknown')
              : 'Unknown'
            const isSystem =
              author &&
              (author.isSystemUser === true ||
                (author.roles &&
                  Array.isArray(author.roles) &&
                  author.roles.includes('system')))
            return {
              id: String(msg.id),
              role: isSystem
                ? 'leo'
                : msg.messageType === 'system' || msg.messageType === 'announcement'
                  ? 'system'
                  : 'user',
              content: String(msg.content || ''),
              timestamp: new Date(String(msg.createdAt)),
              authorName,
              metadata: {
                messageType: String(msg.messageType || 'user'),
              },
            } satisfies ChatMessage
          })
        setMessages(mapped)
        if (mapped.length > 0) {
          lastMessageIdRef.current = mapped[mapped.length - 1].id
        }
      }
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }, [spaceId, activeChannel])

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
        // Send to Payload
        // space is a relationship field — Payload expects a numeric ID
        const spaceIdNum = Number(spaceId)
        const res = await fetch(`${SERVER_URL}/api/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content.trim(),
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
              ? {
                  ...m,
                  id: String(saved.doc?.id || saved.id || tempId),
                }
              : m,
          ),
        )

        // Ask LEO to respond via dedicated chat endpoint
        // (MCP endpoint is for programmatic clients like Merlin; browser uses /api/leo)
        try {
          const leoRes = await fetch(`${SERVER_URL}/api/leo`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: content.trim(),
              conversationId: conversationIdRef.current,
              channelSlug: activeChannel,
              spaceId,
            }),
          })

          if (leoRes.ok) {
            const leoData = await leoRes.json()
            const leoMessage: ChatMessage = {
              id: `leo_${Date.now()}`,
              role: 'leo',
              content:
                leoData.response ||
                leoData.text ||
                "I'm here to help. Could you tell me more?",
              timestamp: new Date(),
              authorName: leoData.agentName || 'LEO',
              metadata: {
                agentName: leoData.agentName || 'LEO',
                agentType: leoData.agentType || 'leo',
                conversationId:
                  leoData.conversationId || conversationIdRef.current,
              },
            }
            setMessages((prev) => [...prev, leoMessage])

            if (leoData.conversationId) {
              conversationIdRef.current = leoData.conversationId
            }
          }
        } catch {
          // LEO response is best-effort, don't fail the message
          console.warn('LEO response unavailable')
        }
      } catch (err) {
        console.error('Failed to send message:', err)
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        // Add error message
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
    [spaceId, activeChannel],
  )

  // Switch channel
  const switchChannel = useCallback((slug: string) => {
    setActiveChannel(slug)
    setMessages([])
  }, [])

  // Load channels on mount
  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  // Load messages when channel changes
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Poll for new messages every 5s
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
    sendMessage,
    switchChannel,
    loadMessages,
  }
}
