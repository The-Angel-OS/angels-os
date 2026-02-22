'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { useChat } from './useChat'
import type { ChatMessage, ChatChannel, ChatSpace } from './types'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || ''

// ─── Context Shape ───────────────────────────────────────────────

export interface ChatContextValue {
  // Current navigation
  activeSpaceId: string | null
  activeChannelSlug: string
  setActiveSpace: (spaceId: string) => void
  setActiveChannel: (slug: string) => void

  // Spaces + Channels
  spaces: ChatSpace[]
  channels: ChatChannel[]
  dmChannels: ChatChannel[]
  isLoadingChannels: boolean

  // Messages
  messages: ChatMessage[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  sendMessage: (content: string, files?: File[]) => Promise<void>
  loadMoreMessages: () => Promise<void>

  // DM shortcuts
  leoDMChannel: ChatChannel | null
  openDM: (userId: string) => void

  // View mode
  activeView: 'full' | 'sidebar' | 'bubble' | null
  setActiveView: (view: 'full' | 'sidebar' | 'bubble' | null) => void

  // Channel management
  createChannel: (name: string, type?: string, description?: string) => Promise<ChatChannel | null>
  deleteChannel: (channelId: string) => Promise<boolean>
  switchChannel: (slug: string) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

/**
 * Hook to consume ChatProvider context.
 * Returns null if no provider is available (e.g., on public pages).
 */
export function useChatContext(): ChatContextValue | null {
  return useContext(ChatContext)
}

/**
 * Hook that requires ChatProvider context.
 * Throws if no provider found (use only inside dashboard layout).
 */
export function useRequiredChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error('useRequiredChatContext must be used within a ChatProvider')
  }
  return ctx
}

// ─── Provider Component ──────────────────────────────────────────

interface ChatProviderProps {
  children: ReactNode
  tenantId: string
  dmSpaceId?: string
  defaultSpaceId?: string
  spaces: ChatSpace[]
  userId: string
}

export function ChatProvider({
  children,
  tenantId,
  dmSpaceId,
  defaultSpaceId,
  spaces,
  userId,
}: ChatProviderProps) {
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(defaultSpaceId || null)
  const [activeView, setActiveView] = useState<'full' | 'sidebar' | 'bubble' | null>(null)
  const [dmChannels, setDmChannels] = useState<ChatChannel[]>([])
  const [leoDMChannel, setLeoDMChannel] = useState<ChatChannel | null>(null)
  const leoResolvedRef = useRef(false)

  // The core useChat hook drives messages/channels for the active space+channel
  const chat = useChat(
    activeSpaceId || undefined,
    undefined,
    { tenantId },
  )

  // ─── LEO DM Resolution ─────────────────────────────────────
  useEffect(() => {
    if (!dmSpaceId || !tenantId || !userId || leoResolvedRef.current) return
    leoResolvedRef.current = true

    fetch(`${SERVER_URL}/api/dm/find-or-create`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: 'leo', tenantId }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.channel) {
          const ch: ChatChannel = {
            id: data.channel.id,
            name: data.channel.name || 'LEO',
            slug: data.channel.slug,
            type: 'dm',
            spaceId: dmSpaceId,
            source: data.channel.source || 'native',
            members: data.channel.members,
          }
          setLeoDMChannel(ch)
          setDmChannels((prev) => {
            if (prev.find((c) => c.id === ch.id)) return prev
            return [ch, ...prev]
          })
        }
      })
      .catch((err) => {
        console.warn('[ChatProvider] Failed to resolve LEO DM:', err)
      })
  }, [dmSpaceId, tenantId, userId])

  // ─── Load DM channels for tenant ───────────────────────────
  useEffect(() => {
    if (!tenantId || !dmSpaceId) return

    fetch(
      `${SERVER_URL}/api/channels?where[type][equals]=dm&where[space][equals]=${dmSpaceId}&sort=-updatedAt&limit=50`,
      { credentials: 'include' },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.docs) {
          const mapped: ChatChannel[] = data.docs.map((ch: any) => ({
            id: String(ch.id),
            name: ch.name || 'DM',
            slug: ch.slug,
            type: 'dm',
            spaceId: String(typeof ch.space === 'object' ? ch.space?.id : ch.space),
            source: ch.source || 'native',
            members: Array.isArray(ch.members)
              ? ch.members.map((m: any) =>
                  typeof m === 'object'
                    ? { id: String(m.id), name: m.name, email: m.email }
                    : { id: String(m) },
                )
              : [],
          }))
          setDmChannels(mapped)
        }
      })
      .catch((err) => {
        console.warn('[ChatProvider] Failed to load DM channels:', err)
      })
  }, [tenantId, dmSpaceId])

  // ─── Navigation helpers ─────────────────────────────────────

  const setActiveSpace = useCallback(
    (spaceId: string) => {
      setActiveSpaceId(spaceId)
    },
    [],
  )

  const setActiveChannel = useCallback(
    (slug: string) => {
      chat.switchChannel(slug)
    },
    [chat],
  )

  const openDM = useCallback(
    (targetUserId: string) => {
      if (!dmSpaceId || !tenantId) return

      fetch(`${SERVER_URL}/api/dm/find-or-create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, tenantId }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.channel) {
            const ch: ChatChannel = {
              id: data.channel.id,
              name: data.channel.name,
              slug: data.channel.slug,
              type: 'dm',
              spaceId: dmSpaceId,
              source: data.channel.source || 'native',
              members: data.channel.members,
            }
            setDmChannels((prev) => {
              if (prev.find((c) => c.id === ch.id)) return prev
              return [ch, ...prev]
            })
            // Navigate to DMs space and this channel
            setActiveSpaceId(dmSpaceId)
            chat.switchChannel(ch.slug)
          }
        })
        .catch((err) => {
          console.warn('[ChatProvider] openDM failed:', err)
        })
    },
    [dmSpaceId, tenantId, chat],
  )

  // ─── Context Value ──────────────────────────────────────────

  const value: ChatContextValue = {
    activeSpaceId,
    activeChannelSlug: chat.activeChannel,
    setActiveSpace,
    setActiveChannel,

    spaces,
    channels: chat.channels,
    dmChannels,
    isLoadingChannels: chat.isLoadingChannels,

    messages: chat.messages,
    isLoading: chat.isLoading,
    isLoadingMore: chat.isLoadingMore,
    hasMore: chat.hasMore,
    sendMessage: chat.sendMessage,
    loadMoreMessages: chat.loadMoreMessages,

    leoDMChannel,
    openDM,

    activeView,
    setActiveView,

    createChannel: chat.createChannel,
    deleteChannel: chat.deleteChannel,
    switchChannel: chat.switchChannel,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
