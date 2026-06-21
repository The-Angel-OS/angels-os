'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useChat } from './useChat'
import { getSurface, setSurface, subscribeSurface } from './surfaceStore'
import { parseSpacesDeepLink } from './deepLink'
import type { ChatMessage, ChatChannel, ChatSpace } from './types'

// Use relative URLs so fetch always targets the current domain/subdomain.
// See useChat.ts for full explanation — NEXT_PUBLIC_SERVER_URL breaks on
// tenant subdomains because it's baked at build time to the main domain.
const SERVER_URL = ''

// ─── Context Shape ───────────────────────────────────────────────

export interface ChatContextValue {
  // Current navigation
  activeSpaceId: string | null
  activeChannelSlug: string
  setActiveSpace: (spaceId: string) => void

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
  // A `/dashboard/spaces/<spaceId>/<channelId>` URL is the AUTHORITATIVE initial
  // surface — captured once at mount, before any URL-sync can rewrite it. It must
  // beat the persisted surface (a prior visit) and defaultSpaceId, or a shared
  // deep link silently bounces to whatever space you last had open.
  const [initialDeepLink] = useState(() =>
    parseSpacesDeepLink(typeof window !== 'undefined' ? window.location.pathname : null),
  )

  // Initial Surface: deep-link URL wins, then the shared store (survives navigation
  // across the separate ChatProvider mounts), then defaultSpaceId on first ever use.
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(
    () => initialDeepLink?.spaceId || getSurface().spaceId || defaultSpaceId || null,
  )
  const [activeView, setActiveView] = useState<'full' | 'sidebar' | 'bubble' | null>(null)
  const [dmChannels, setDmChannels] = useState<ChatChannel[]>([])
  const [leoDMChannel, setLeoDMChannel] = useState<ChatChannel | null>(null)
  const leoResolvedRef = useRef(false)
  // Local channel slug — NOT redundant with chat.activeChannel.
  // Breaks the circular dependency: effectiveSpaceId → useChat → effectiveSpaceId.
  // Updated synchronously in switchChannel before chat.switchChannel propagates.
  const [activeChannelSlugLocal, setActiveChannelSlugLocal] = useState<string>(
    () => getSurface().channelSlug || '',
  )

  // Publish the deep-link space to the shared surface on mount so the sibling
  // DashboardProvider restores the SAME space — otherwise its restore effect reads
  // the stale persisted spaceId and pushes it back into us (the two providers
  // reconcile through surfaceStore). Children mount before parents, so this lands
  // before DashboardProvider's restore runs.
  useEffect(() => {
    if (initialDeepLink?.spaceId) setSurface({ spaceId: initialDeepLink.spaceId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Effective Space ID ───────────────────────────────────────
  // When the active channel is a DM, route queries to the DM space
  // instead of the visually active space. This fixes the bug where
  // DM messages were invisible because useChat queried the wrong space.
  const effectiveSpaceId = useMemo(() => {
    if (!activeChannelSlugLocal) return activeSpaceId
    const isDM = dmChannels.find((c) => c.slug === activeChannelSlugLocal)
    if (isDM && dmSpaceId) return dmSpaceId
    return activeSpaceId
  }, [activeChannelSlugLocal, activeSpaceId, dmSpaceId, dmChannels])

  // The core useChat hook drives messages/channels for the effective space+channel.
  // channelSpaceId is always the visually-active space so the sidebar channel list
  // stays stable when effectiveSpaceId switches to dmSpaceId for DM routing.
  const chat = useChat(
    effectiveSpaceId || undefined,
    undefined,
    { tenantId, channelSpaceId: activeSpaceId || undefined },
  )

  // ─── Load DM channels + resolve LEO DM (sequential to prevent race) ───
  useEffect(() => {
    if (!tenantId || !userId) return

    // Load all DM channels first, then resolve LEO DM and merge.
    // This eliminates the race condition where two concurrent effects
    // could clobber each other's state updates.
    //
    // If dmSpaceId is not available (new account, ensureDMSpace failed server-side),
    // we skip the DM channel list but still attempt LEO DM resolution — the
    // find-or-create endpoint internally calls ensureDMSpace.
    const loadDMs = async () => {
      try {
        // Step 1: Load only MY DM channels (filtered by membership + tenant)
        let deduped: ChatChannel[] = []
        if (dmSpaceId) {
          const res = await fetch(
            `${SERVER_URL}/api/channels?where[type][equals]=dm&where[space][equals]=${dmSpaceId}&where[tenant][equals]=${tenantId}&where[members][in]=${userId}&sort=-updatedAt&limit=50`,
            { credentials: 'include' },
          )
          const data = res.ok ? await res.json() : null
          const mapped: ChatChannel[] = (data?.docs || []).map((ch: any) => ({
            id: String(ch.id),
            name: ch.name || 'DM',
            slug: ch.slug,
            type: 'dm' as const,
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

          // Deduplicate by slug (keep first occurrence — most recently updated)
          const seen = new Set<string>()
          deduped = mapped.filter((ch) => {
            if (seen.has(ch.slug)) return false
            seen.add(ch.slug)
            return true
          })
        }

        // Step 2: Resolve LEO DM (find-or-create)
        // This works even without dmSpaceId — the endpoint internally provisions the DM space
        if (!leoResolvedRef.current) {
          leoResolvedRef.current = true
          try {
            const leoRes = await fetch(`${SERVER_URL}/api/dm/find-or-create`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetUserId: 'leo', tenantId }),
            })
            const leoData = leoRes.ok ? await leoRes.json() : null
            if (leoData?.channel) {
              const leoSpaceId = dmSpaceId || String(
                typeof leoData.channel.space === 'object'
                  ? leoData.channel.space?.id
                  : leoData.channel.space,
              )
              const leoCh: ChatChannel = {
                id: String(leoData.channel.id),
                name: leoData.channel.name || 'LEO',
                slug: leoData.channel.slug,
                type: 'dm',
                spaceId: leoSpaceId,
                source: leoData.channel.source || 'native',
                members: leoData.channel.members,
              }
              setLeoDMChannel(leoCh)

              // Merge LEO DM into list if not already present
              if (!deduped.find((c) => c.id === leoCh.id)) {
                deduped.unshift(leoCh)
              }
              // Auto-switch to LEO DM if no channel is currently active — UNLESS a
              // channel was deep-linked. Jumping to LEO here would make MultiChannelChat
              // rewrite the URL to the LEO DM and stomp the link before it resolves.
              if (!activeChannelSlugLocal && !initialDeepLink?.channelToken) {
                setActiveChannelSlugLocal(leoCh.slug)
                chat.switchChannel(leoCh.slug)
              }
            }
          } catch (err) {
            console.warn('[ChatProvider] Failed to resolve LEO DM:', err)
          }
        }

        setDmChannels(deduped)
      } catch (err) {
        console.warn('[ChatProvider] Failed to load DM channels:', err)
      }
    }

    loadDMs()
  }, [tenantId, dmSpaceId, userId])

  // ─── Navigation helpers ─────────────────────────────────────

  // Refs mirror the active selection so the surface subscriber can compare without
  // stale closures and skip re-applying a change this mount just made.
  const activeSpaceRef = useRef(activeSpaceId)
  const activeChannelRef = useRef(activeChannelSlugLocal)
  useEffect(() => { activeSpaceRef.current = activeSpaceId }, [activeSpaceId])
  useEffect(() => { activeChannelRef.current = activeChannelSlugLocal }, [activeChannelSlugLocal])

  const setActiveSpace = useCallback(
    (spaceId: string) => {
      activeSpaceRef.current = spaceId
      setActiveSpaceId(spaceId)
      setSurface({ spaceId }) // publish to the shared store (persist + sync other views)
    },
    [],
  )

  // switchChannel is the single API for changing channels.
  // Updates local slug (for effectiveSpaceId) and delegates to chat.switchChannel
  // which aborts in-flight streams and resets messages/poll state.
  const switchChannel = useCallback(
    (slug: string) => {
      activeChannelRef.current = slug
      setActiveChannelSlugLocal(slug)
      chat.switchChannel(slug)
      setSurface({ channelSlug: slug }) // publish to the shared store
    },
    [chat.switchChannel],
  )

  // Subscribe to the shared Surface: when ANOTHER mount (the side viewer, another
  // tab) changes the space/channel, mirror it here so both views stay in lock-step.
  // The ref guards skip changes this mount originated (no feedback loop).
  useEffect(() => {
    return subscribeSurface((s) => {
      if (s.spaceId && s.spaceId !== activeSpaceRef.current) {
        activeSpaceRef.current = s.spaceId
        setActiveSpaceId(s.spaceId)
      }
      if (s.channelSlug && s.channelSlug !== activeChannelRef.current) {
        activeChannelRef.current = s.channelSlug
        setActiveChannelSlugLocal(s.channelSlug)
        chat.switchChannel(s.channelSlug)
      }
    })
  }, [chat.switchChannel])

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
            // Navigate to DM channel — effectiveSpaceId handles space routing
            setActiveChannelSlugLocal(ch.slug)
            chat.switchChannel(ch.slug)
          }
        })
        .catch((err) => {
          console.warn('[ChatProvider] openDM failed:', err)
        })
    },
    [dmSpaceId, tenantId, chat.switchChannel],
  )

  // ─── Context Value ──────────────────────────────────────────
  // Memoized to prevent cascading re-renders across all consumers.
  const value: ChatContextValue = useMemo(
    () => ({
      activeSpaceId,
      activeChannelSlug: chat.activeChannel,
      setActiveSpace,

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
      switchChannel,
    }),
    [
      activeSpaceId,
      chat.activeChannel,
      setActiveSpace,
      spaces,
      chat.channels,
      dmChannels,
      chat.isLoadingChannels,
      chat.messages,
      chat.isLoading,
      chat.isLoadingMore,
      chat.hasMore,
      chat.sendMessage,
      chat.loadMoreMessages,
      leoDMChannel,
      openDM,
      activeView,
      setActiveView,
      chat.createChannel,
      chat.deleteChannel,
      switchChannel,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
