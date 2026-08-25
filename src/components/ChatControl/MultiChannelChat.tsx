'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Hash, MessageSquare, Plus, X, PanelLeftClose, PanelLeftOpen, Settings, Bot, User } from 'lucide-react'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { useChat, CATCH_ALL_SLUG } from './useChat'
import { useChatContext } from './ChatProvider'
import { UnreadBadge } from './UnreadBadge'
import { parseSpacesDeepLink } from './deepLink'
import { dmLabel, dmPartner } from './dmLabel'
import { usePresence } from '@/hooks/usePresence'
import { getSurface, setSurface, subscribeSurface } from './surfaceStore'
import { useSpaces } from './useSpaces'
import { SpacesMenuHeader } from './SpacesMenuHeader'
import { LiveKitButton } from './LiveKitButton'
import { MemberPanelTrigger, MemberPanel } from './MemberPanel'
import { ChannelSettingsPanel } from './ChannelSettingsPanel'
import { AppletBar } from './AppletBar'
import { FilesBrowser } from './applets/FilesBrowser'
import { TaskBoard } from './applets/TaskBoard'
import { NotesTree } from './applets/NotesTree'
import { BookViewer } from './applets/BookViewer'
import { useIsMobile } from '@/utilities/useMediaQuery'
import type { ChatControlProps, ChatChannel } from './types'
import { DEFAULT_APPLETS } from './types'

/** Hoisted style to avoid per-render allocation in scrollable touch container */
const TOUCH_MANIPULATION: React.CSSProperties = { touchAction: 'manipulation' }

/** Shared className for mobile channel tab pills (44px min touch target) */
const channelPillClass = (isActive: boolean) =>
  `flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground active:bg-muted/80'
  }`

/** Source icons for external DM channels */
const SOURCE_ICONS: Record<string, string> = {
  whatsapp: '\uD83D\uDCF1',
  email: '\uD83D\uDCE7',
  google_chat: '\uD83D\uDCAC',
  sms: '\uD83D\uDCF2',
}

/** Channel type options matching the Payload schema */
const CHANNEL_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'announcements', label: 'Announcements' },
  { value: 'support', label: 'Support' },
  { value: 'sales', label: 'Sales' },
  { value: 'team', label: 'Team' },
  { value: 'social', label: 'Social' },
]

/**
 * Multi-channel mode — full dashboard with collapsible channel sidebar.
 *
 * Desktop: Space selector + collapsible channel list on left, messages on right.
 * Mobile: Space selector pill, horizontal channel tabs, messages below.
 *
 * Sprint 12: Consumes ChatProvider when available, adds DM section.
 */
export function MultiChannelChat({
  spaceId: initialSpaceId,
  spaces: initialSpaces,
  tenantId,
  channelSlug,
  onSpaceChange,
  className = '',
}: ChatControlProps) {
  // Try ChatProvider context
  const chatCtx = useChatContext()
  const hasProvider = chatCtx !== null

  // Unread badges come from the provider. Without one there is no read state to
  // show, and `unreadCount` is simply absent — the badge renders nothing.
  const unreadCap = chatCtx?.unreadCap ?? 99

  // Space management — provider or local.
  //
  // The local branch used to be plain component state, so a sidebar rendered
  // WITHOUT a ChatProvider changed space correctly and then forgot the moment it
  // unmounted — the prop (a server-side default) won again on the next mount.
  // The provider branch and the dashboard have always published to surfaceStore;
  // this branch just never joined them. Same store, same precedence the provider
  // uses: a stored choice beats the default prop, because it is what the person
  // actually picked.
  const [localSpaceId, setLocalSpaceId] = useState(initialSpaceId || '1')

  // Restore AFTER mount rather than in the initializer: surfaceStore reads
  // localStorage, which is empty during SSR, and seeding from it directly would
  // hydrate a different value than the server rendered.
  useEffect(() => {
    if (hasProvider) return
    const stored = getSurface().spaceId
    if (stored) setLocalSpaceId((cur) => (stored === cur ? cur : stored))
  }, [hasProvider])

  // Follow the other surfaces: the dashboard chooser, the side viewer, another
  // tab. This is the "both choosers track each other" half of the same fact.
  useEffect(() => {
    if (hasProvider) return
    return subscribeSurface((s) => {
      if (s.spaceId) setLocalSpaceId((cur) => (s.spaceId === cur ? cur : s.spaceId!))
    })
  }, [hasProvider])
  const activeSpaceId = hasProvider ? (chatCtx!.activeSpaceId || localSpaceId) : localSpaceId
  const { spaces: fetchedSpaces, isLoading: isLoadingSpaces } = useSpaces(
    hasProvider ? chatCtx!.spaces : initialSpaces,
  )
  const spaces = hasProvider ? chatCtx!.spaces : fetchedSpaces

  // Chat — provider or direct hook
  const directChat = useChat(activeSpaceId, channelSlug)

  const messages = hasProvider ? chatCtx!.messages : directChat.messages
  const channels = hasProvider ? chatCtx!.channels : directChat.channels
  const activeChannel = hasProvider ? chatCtx!.activeChannelSlug : directChat.activeChannel
  const isLoading = hasProvider ? chatCtx!.isLoading : directChat.isLoading
  const isLoadingChannels = hasProvider ? chatCtx!.isLoadingChannels : directChat.isLoadingChannels
  const isLoadingMore = hasProvider ? chatCtx!.isLoadingMore : directChat.isLoadingMore
  const hasMore = hasProvider ? chatCtx!.hasMore : directChat.hasMore
  const sendMessage = hasProvider ? chatCtx!.sendMessage : directChat.sendMessage
  const switchChannel = hasProvider ? chatCtx!.switchChannel : directChat.switchChannel
  const createChannel = hasProvider ? chatCtx!.createChannel : directChat.createChannel
  const deleteChannel = hasProvider ? chatCtx!.deleteChannel : directChat.deleteChannel
  const loadMoreMessages = hasProvider ? chatCtx!.loadMoreMessages : directChat.loadMoreMessages

  // DM channels from provider
  const dmChannels = hasProvider ? chatCtx!.dmChannels : []
  const selfUserId = hasProvider ? chatCtx!.userId : ''
  // Presence for the DM list. `ping: false` — the sidebar reads presence, it does
  // not announce it; something else already owns the heartbeat.
  const { online } = usePresence({ enabled: true, ping: false })
  const onlineIds = useMemo(() => new Set(online.map((u) => String(u.userId))), [online])
  const leoDMChannel = hasProvider ? chatCtx!.leoDMChannel : null

  const isMobile = useIsMobile()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelType, setNewChannelType] = useState('general')
  const [isCreating, setIsCreating] = useState(false)
  const [channelsPanelOpen, setChannelsPanelOpen] = useState(!isMobile)
  const [memberPanelOpen, setMemberPanelOpen] = useState(false)
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false)
  const [activeApplet, setActiveApplet] = useState<string>('chat')

  // ── Deep-link channel entry ──────────────────────────────────────────────
  // The channel id from a /dashboard/spaces/{spaceId}/{channelId} URL, captured
  // ONCE at mount before the URL-sync effect below can overwrite it. We resolve it
  // to a real channel after the channel list loads, then switch. URL-sync is held
  // off (gated on `deepLinkResolved`) until then so the link can't be stomped.
  const [deepLinkChannelId] = useState<string | null>(
    () => parseSpacesDeepLink(typeof window !== 'undefined' ? window.location.pathname : null)?.channelToken ?? null,
  )
  const deepLinkResolvedRef = useRef(false)
  const [deepLinkResolved, setDeepLinkResolved] = useState(false)

  // Switch to the chat applet and scroll/highlight a specific message (used by
  // the Files applet's "in context" link). When the message lives in another
  // channel (space-wide file scope), switch channels first.
  //
  // Also seeds the deep-link convention: a jump rewrites the URL to
  // ?channel=<slug>&msg=<id> so the exact message is shareable / restorable.
  // (The Spaces app is still state-driven; this is the first surface to address
  // a Surface={space,channel,position} in the URL — see project_deep_link_navigation.)
  const scrollToMessage = useCallback((messageId: string) => {
    let tries = 0
    const attempt = () => {
      const el = document.getElementById(`msg-${messageId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-primary', 'bg-primary/5')
        window.setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary', 'bg-primary/5')
        }, 2200)
      } else if (tries++ < 30) {
        window.setTimeout(attempt, 100)
      }
    }
    window.setTimeout(attempt, 80)
  }, [])

  const jumpToMessage = useCallback(
    (messageId: string, targetChannelSlug?: string) => {
      setActiveApplet('chat')
      const needsSwitch = targetChannelSlug && targetChannelSlug !== activeChannel
      if (needsSwitch) switchChannel(targetChannelSlug!)
      // Reflect the destination in the URL (shareable deep link).
      try {
        const slug = targetChannelSlug || activeChannel || ''
        const params = new URLSearchParams(window.location.search)
        if (slug) params.set('channel', slug)
        params.set('msg', messageId)
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
      } catch {
        /* history not available — non-fatal */
      }
      // Give a channel switch time to load its messages before scrolling.
      window.setTimeout(() => scrollToMessage(messageId), needsSwitch ? 350 : 0)
    },
    [activeChannel, switchChannel, scrollToMessage],
  )

  // Deep-link restore: on first load, honor ?channel=&msg= by switching to that
  // channel and scrolling to the message once channels are available.
  const deepLinkApplied = useRef(false)
  useEffect(() => {
    if (deepLinkApplied.current) return
    if (isLoadingChannels || channels.length === 0) return
    let params: URLSearchParams
    try {
      params = new URLSearchParams(window.location.search)
    } catch {
      return
    }
    const ch = params.get('channel')
    const msg = params.get('msg')
    if (!ch && !msg) {
      deepLinkApplied.current = true
      return
    }
    deepLinkApplied.current = true
    if (ch && ch !== activeChannel) switchChannel(ch)
    if (msg) window.setTimeout(() => scrollToMessage(msg), ch && ch !== activeChannel ? 400 : 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingChannels, channels])

  // Find active channel data from both regular and DM channels
  const activeChannelData =
    channels.find((c) => c.slug === activeChannel) ||
    dmChannels.find((c) => c.slug === activeChannel)
  const activeSpace = spaces.find((s) => s.id === activeSpaceId)

  // Compute which applets are enabled for the active space + channel
  // DMs get the same applets as regular channels — guard rails, not walls.
  // A Guardian Angel DM needs LiveKit voice. A vendor DM needs file sharing.
  // Chat is always on; everything else is opt-in but available.
  const enabledApplets = useMemo(() => {
    const spaceAppletIds = activeSpace?.enabledApplets || ['chat', 'voice', 'files', 'tasks', 'notes', 'book']
    return DEFAULT_APPLETS.filter((a) => spaceAppletIds.includes(a.id))
  }, [activeSpace])

  // Reset applet to chat when switching channels
  const handleSwitchChannel = useCallback(
    (slug: string) => {
      setActiveApplet('chat')
      switchChannel(slug)
    },
    [switchChannel],
  )

  const router = useRouter()

  const handleSpaceChange = (newSpaceId: string) => {
    if (hasProvider) {
      chatCtx!.setActiveSpace(newSpaceId)
    } else {
      setLocalSpaceId(newSpaceId)
      // Publish, so the choice survives unmount and the other surfaces follow.
      setSurface({ spaceId: newSpaceId })
    }
    onSpaceChange?.(newSpaceId)
  }

  const handleSpaceCreated = useCallback(
    (newSpaceId: string) => {
      handleSpaceChange(newSpaceId)
      router.refresh()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router],
  )

  // ── Tab title — reflect the chosen space (+ channel) in the browser tab. ──
  useEffect(() => {
    if (!activeSpace?.name) return
    const ch = activeChannelData?.name
    document.title = ch ? `#${ch} · ${activeSpace.name}` : activeSpace.name
  }, [activeSpace?.name, activeChannelData?.name])

  // ── URL ⇄ surface: keep the address bar at /dashboard/spaces/{spaceId}/{channelId}. ──
  // Ids (not slugs) because channel slugs aren't path-safe (e.g. "page:/about") and
  // aren't globally unique. replaceState on the first sync (no junk history entry),
  // pushState on later switches so browser Back/Forward steps through channels.
  const urlSynced = useRef(false)
  useEffect(() => {
    if (!activeSpaceId || !activeChannelData?.id) return
    // Hold off while a deep-linked channel id is still being resolved — otherwise
    // this writes the default channel's path and stomps the incoming link.
    if (deepLinkChannelId && !deepLinkResolved) return
    const path = `/dashboard/spaces/${activeSpaceId}/${activeChannelData.id}`
    if (window.location.pathname === path) {
      urlSynced.current = true
      return
    }
    try {
      if (urlSynced.current) window.history.pushState(null, '', path)
      else window.history.replaceState(null, '', path)
    } catch {
      /* history unavailable — non-fatal */
    }
    urlSynced.current = true
  }, [activeSpaceId, activeChannelData?.id, deepLinkChannelId, deepLinkResolved])

  // Back/Forward: re-read the URL and apply it to state (the sync effect above then
  // sees pathname === path and won't re-push, so no loop).
  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(/\/dashboard\/spaces\/(\d+)\/(\d+)/)
      if (!m) return
      const [, sId, cId] = m
      if (sId !== String(activeSpaceId)) handleSpaceChange(sId)
      const ch = [...channels, ...dmChannels].find((c) => String(c.id) === cId)
      if (ch && ch.slug !== activeChannel) switchChannel(ch.slug)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpaceId, activeChannel, channels, dmChannels])

  // Deep-link entry by channel id: when landing on /…/{spaceId}/{channelId}, resolve
  // the captured channel id (id first, slug for legacy links) to a real channel once
  // the list loads and switch to it. Runs once; releases the URL-sync gate even on a
  // miss so a stale/foreign link falls back to normal behavior instead of hanging.
  useEffect(() => {
    if (deepLinkResolvedRef.current) return
    if (!deepLinkChannelId) {
      deepLinkResolvedRef.current = true
      setDeepLinkResolved(true)
      return
    }
    if (isLoadingChannels) return
    const all = [...channels, ...dmChannels]
    if (all.length === 0) return
    const ch = all.find((c) => String(c.id) === deepLinkChannelId || c.slug === deepLinkChannelId)
    deepLinkResolvedRef.current = true
    setDeepLinkResolved(true)
    if (ch) {
      console.debug(`[deeplink] channel ${deepLinkChannelId} → #${ch.slug}`)
      if (ch.slug !== activeChannel) switchChannel(ch.slug)
    } else {
      console.warn(`[deeplink] channel "${deepLinkChannelId}" not found in space ${activeSpaceId} — staying on ${activeChannel}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingChannels, channels, dmChannels, deepLinkChannelId])

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || isCreating) return
    setIsCreating(true)
    const created = await createChannel(newChannelName.trim(), newChannelType)
    if (created) {
      handleSwitchChannel(created.slug)
      setNewChannelName('')
      setNewChannelType('general')
      setShowCreateForm(false)
    }
    setIsCreating(false)
  }

  /** Render a DM channel item in the sidebar */
  function renderDMItem(ch: ChatChannel) {
    const isLeo = ch.slug.endsWith('-leo')
    const sourceIcon = ch.source && ch.source !== 'native' ? SOURCE_ICONS[ch.source] : null
    const icon = isLeo ? <Bot size={14} className="shrink-0 opacity-70" /> : <User size={14} className="shrink-0 opacity-50" />
    // A DM is named after the OTHER person — the stored name is symmetric
    // ("A ↔ B") because one row serves both sides, so rendering it showed
    // everyone their own name back.
    const label = dmLabel(ch, selfUserId)
    const partner = isLeo ? undefined : dmPartner(ch, selfUserId)
    const isOnline = partner ? onlineIds.has(String(partner.id)) : false

    return (
      <div
        key={ch.id}
        className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
          ch.slug === activeChannel
            ? 'bg-muted font-medium text-foreground'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
        }`}
      >
        <button
          onClick={() => handleSwitchChannel(ch.slug)}
          className="flex flex-1 items-center gap-2 text-left min-w-0"
        >
          <span className="relative shrink-0">
            {sourceIcon ? <span className="text-xs">{sourceIcon}</span> : icon}
            {/* Presence rides on the icon so it is legible with the panel
                collapsed, when the icon is all there is. */}
            {partner && (
              <span
                aria-hidden
                className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-background ${
                  isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                }`}
              />
            )}
          </span>
          {channelsPanelOpen && (
            <span className="truncate">
              {label}
              {partner && <span className="sr-only">{isOnline ? ' (online)' : ' (offline)'}</span>}
            </span>
          )}
          {!channelsPanelOpen && <UnreadBadge count={ch.unreadCount} cap={unreadCap} compact />}
        </button>
        {channelsPanelOpen && <UnreadBadge count={ch.unreadCount} cap={unreadCap} />}
      </div>
    )
  }

  return (
    <div className={`flex h-full min-h-[500px] flex-col md:flex-row overflow-hidden rounded-lg border border-border bg-background ${className}`}>

      {/* ─── LEFT PANEL: Space selector + Collapsible channels ─── */}
      {isMobile ? (
        /* Mobile: compact top bar with space selector + channel tabs */
        <div className="shrink-0 border-b border-border bg-muted/30">
          <div className="border-b border-border">
            <SpacesMenuHeader
              spaces={spaces}
              activeSpaceId={activeSpaceId}
              onSpaceSelect={handleSpaceChange}
              onSpaceCreated={handleSpaceCreated}
              isLoading={isLoadingSpaces}
            />
          </div>

          {/* Channel tabs (horizontal scroll) — includes DMs.
              touch-action:manipulation prevents 300ms delay on mobile browsers
              and ensures taps inside the scrollable container fire reliably. */}
          <div className="flex items-center gap-1 overflow-x-auto px-2 py-2 scrollbar-none" style={TOUCH_MANIPULATION}>
            {isLoadingChannels ? (
              <div className="flex gap-2 px-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-muted" />
                ))}
              </div>
            ) : (
              <>
                {/* Regular channels — py-2 for 44px min touch target */}
                {channels.filter((c) => c.type !== 'dm').map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleSwitchChannel(ch.slug)}
                    className={channelPillClass(ch.slug === activeChannel)}
                  >
                    <Hash size={12} className="shrink-0" />
                    <span>{ch.name}</span>
                    <UnreadBadge count={ch.unreadCount} cap={unreadCap} className="ml-1" />
                  </button>
                ))}
                {/* DM channels on mobile */}
                {dmChannels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleSwitchChannel(ch.slug)}
                    className={channelPillClass(ch.slug === activeChannel)}
                  >
                    {ch.slug.endsWith('-leo') ? <Bot size={12} /> : <User size={12} />}
                    <span>{ch.slug.endsWith('-leo') ? 'LEO' : ch.name}</span>
                    <UnreadBadge count={ch.unreadCount} cap={unreadCap} className="ml-1" />
                  </button>
                ))}
              </>
            )}
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex shrink-0 items-center justify-center rounded-full bg-muted p-2 text-muted-foreground active:bg-muted/80"
              aria-label="Add channel"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Mobile action bar — applet icons + settings */}
          {enabledApplets.length > 1 && (
            <div className="flex items-center gap-1 border-t border-border/50 px-2 py-1.5">
              <AppletBar
                applets={enabledApplets}
                activeApplet={activeApplet}
                onAppletChange={setActiveApplet}
              />
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => setChannelSettingsOpen(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground active:bg-muted transition-colors"
                  title="Channel settings"
                >
                  <Settings size={14} />
                </button>
                <MemberPanelTrigger onClick={() => setMemberPanelOpen(true)} />
              </div>
            </div>
          )}

          {/* Inline create form (mobile) */}
          {showCreateForm && (
            <div className="flex items-center gap-2 border-t border-border px-3 py-2">
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
                placeholder="Channel name"
                className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                style={{ fontSize: '16px' }}
                autoFocus
              />
              <select
                value={newChannelType}
                onChange={(e) => setNewChannelType(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                {CHANNEL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim() || isCreating}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
              >
                {isCreating ? '...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setNewChannelName('') }}
                className="p-1 text-muted-foreground"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Desktop: collapsible sidebar */
        <aside
          className={`flex shrink-0 flex-col border-r border-border bg-muted/30 transition-[width] duration-200 ${
            channelsPanelOpen ? 'w-56' : 'w-12'
          }`}
        >
          {/* Space selector + management actions */}
          <div className="border-b border-border">
            <SpacesMenuHeader
              spaces={spaces}
              activeSpaceId={activeSpaceId}
              onSpaceSelect={handleSpaceChange}
              onSpaceCreated={handleSpaceCreated}
              isLoading={isLoadingSpaces}
              compact={!channelsPanelOpen}
            />
          </div>

          {/* Channels header with toggle + add button */}
          <div className="flex items-center justify-between border-b border-border px-2 py-2">
            <button
              onClick={() => setChannelsPanelOpen(!channelsPanelOpen)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={channelsPanelOpen ? 'Collapse channels' : 'Expand channels'}
            >
              {channelsPanelOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
            </button>
            {channelsPanelOpen && (
              <>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channels</span>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Add channel"
                >
                  <Plus size={14} />
                </button>
              </>
            )}
          </div>

          {/* Inline create form (desktop) */}
          {showCreateForm && channelsPanelOpen && (
            <div className="border-b border-border p-2 space-y-2">
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
                placeholder="Channel name"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                autoFocus
              />
              <select
                value={newChannelType}
                onChange={(e) => setNewChannelType(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                {CHANNEL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateChannel}
                  disabled={!newChannelName.trim() || isCreating}
                  className="flex-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => { setShowCreateForm(false); setNewChannelName('') }}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Channel list — regular channels */}
          <nav className="flex-1 overflow-y-auto p-1">
            {isLoadingChannels ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : channels.length === 0 && dmChannels.length === 0 ? (
              channelsPanelOpen ? (
                <div className="p-3 text-xs text-muted-foreground">
                  No channels yet — use the <span className="font-medium text-foreground">+</span> button above to create one.
                </div>
              ) : null
            ) : (
              <>
                {/* Regular channels */}
                {channels.filter((c) => c.type !== 'dm').map((ch) => (
                  <div
                    key={ch.id}
                    className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      ch.slug === activeChannel
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                    title={!channelsPanelOpen ? `#${ch.name}` : undefined}
                  >
                    <button
                      onClick={() => handleSwitchChannel(ch.slug)}
                      className="flex flex-1 items-center gap-2 text-left min-w-0"
                    >
                      <span className="relative shrink-0">
                        <Hash size={14} className="opacity-50" />
                        {!channelsPanelOpen && <UnreadBadge count={ch.unreadCount} cap={unreadCap} compact />}
                      </span>
                      {channelsPanelOpen && <span className="truncate">{ch.name}</span>}
                      {channelsPanelOpen && <UnreadBadge count={ch.unreadCount} cap={unreadCap} />}
                    </button>
                    {!ch.isDefault && channelsPanelOpen && (
                      <button
                        onClick={() => deleteChannel(ch.id)}
                        className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive group-hover:flex"
                        title={`Delete #${ch.name}`}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}

                {/* ─── Direct Messages Section ─── */}
                {dmChannels.length > 0 && (
                  <>
                    {channelsPanelOpen && (
                      <div className="mt-3 mb-1 px-2">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Direct Messages
                        </span>
                      </div>
                    )}
                    {/* LEO always first */}
                    {leoDMChannel && renderDMItem(leoDMChannel)}
                    {/* Other DMs */}
                    {dmChannels
                      .filter((c) => c.id !== leoDMChannel?.id)
                      .map((ch) => renderDMItem(ch))}
                  </>
                )}
              </>
            )}
          </nav>
        </aside>
      )}

      {/* ─── MAIN CHAT AREA ─── */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-x-hidden">
        {/* Channel header */}
        {!isMobile && (
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            {activeChannelData?.type === 'dm' ? (
              activeChannelData.slug.endsWith('-leo') ? (
                <Bot size={16} className="text-primary" />
              ) : (
                <User size={16} className="text-muted-foreground" />
              )
            ) : (
              <Hash size={16} className="text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-foreground">
                {activeChannelData?.type === 'dm'
                  ? dmLabel(activeChannelData as never, selfUserId)
                  : activeChannelData?.name || activeChannel}
              </h2>
              {activeChannelData?.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {activeChannelData.description}
                </p>
              )}
              {activeChannelData?.source && activeChannelData.source !== 'native' && (
                <p className="text-[10px] text-muted-foreground">
                  {SOURCE_ICONS[activeChannelData.source] || ''} via {activeChannelData.source.replace('_', ' ')}
                </p>
              )}
            </div>

            {/* Applet toggle bar — hidden for DM channels (only chat) */}
            <AppletBar
              applets={enabledApplets}
              activeApplet={activeApplet}
              onAppletChange={setActiveApplet}
            />

            {/* Right side: Settings + Members */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChannelSettingsOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Channel settings"
              >
                <Settings size={14} />
              </button>
              <MemberPanelTrigger onClick={() => setMemberPanelOpen(true)} />
            </div>
          </div>
        )}

        {/* Content area — switches based on active applet */}
        {activeApplet === 'chat' ? (
          <>
            <MessageList messages={messages} isLoading={isLoading} isLoadingMore={isLoadingMore} hasMore={hasMore} onLoadMore={loadMoreMessages} showChannelTags={activeChannel === CATCH_ALL_SLUG} />
            <MessageInput
              onSend={sendMessage}
              disabled={isLoading}
              spaceId={activeSpaceId}
              channelSlug={activeChannel}
              tenantId={tenantId}
              placeholder={
                activeChannelData?.type === 'dm'
                  ? activeChannelData.slug.endsWith('-leo')
                    ? 'Ask LEO anything...'
                    : `Message ${activeChannelData.name}...`
                  : `Message #${activeChannelData?.name || activeChannel}...`
              }
            />
          </>
        ) : activeApplet === 'voice' ? (
          <div className="flex flex-1 flex-col">
            <LiveKitButton
              spaceId={activeSpaceId}
              channelSlug={activeChannel}
              embedded
            />
          </div>
        ) : activeApplet === 'files' ? (
          <FilesBrowser
            channelSlug={activeChannel}
            spaceId={activeSpaceId}
            channels={channels}
            onJumpToMessage={jumpToMessage}
          />
        ) : activeApplet === 'tasks' ? (
          <TaskBoard channelId={activeChannelData?.id} spaceId={activeSpaceId} />
        ) : activeApplet === 'notes' ? (
          <NotesTree channelId={activeChannelData?.id} />
        ) : activeApplet === 'book' ? (
          <BookViewer
            channelSlug={activeChannel}
            spaceId={activeSpaceId}
            title={activeChannelData?.name || activeChannel}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Applet &ldquo;{activeApplet}&rdquo; is not yet available.
          </div>
        )}
      </div>

      {/* Member panel overlay */}
      <MemberPanel
        spaceId={Number(activeSpaceId)}
        isOpen={memberPanelOpen}
        onClose={() => setMemberPanelOpen(false)}
      />

      {/* Channel settings panel */}
      <ChannelSettingsPanel
        channel={activeChannelData || null}
        isOpen={channelSettingsOpen}
        onClose={() => setChannelSettingsOpen(false)}
      />
    </div>
  )
}

/**
 * Single-channel mode - just the chat area, no sidebar.
 */
export function SingleChannelChat({
  spaceId,
  channelSlug = 'general',
  className = '',
}: ChatControlProps) {
  const { messages, activeChannel, isLoading, isLoadingMore, hasMore, sendMessage, loadMoreMessages } = useChat(
    spaceId,
    channelSlug,
  )

  return (
    <div className={`flex h-full min-h-[400px] flex-col overflow-hidden rounded-lg border border-border bg-background ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquare size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          #{activeChannel}
        </h2>
      </div>

      <MessageList messages={messages} isLoading={isLoading} isLoadingMore={isLoadingMore} hasMore={hasMore} onLoadMore={loadMoreMessages} showChannelTags={activeChannel === CATCH_ALL_SLUG} />
      <MessageInput
        onSend={sendMessage}
        disabled={isLoading}
        placeholder={`Message #${activeChannel}...`}
      />
    </div>
  )
}
