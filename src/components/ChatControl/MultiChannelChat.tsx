'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Hash, MessageSquare, Plus, X, PanelLeftClose, PanelLeftOpen, Settings, Bot, User } from 'lucide-react'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { useChat } from './useChat'
import { useChatContext } from './ChatProvider'
import { useSpaces } from './useSpaces'
import { SpaceSelector } from './SpaceSelector'
import { LiveKitButton } from './LiveKitButton'
import { MemberPanelTrigger, MemberPanel } from './MemberPanel'
import { ChannelSettingsPanel } from './ChannelSettingsPanel'
import { AppletBar } from './AppletBar'
import { FilesBrowser } from './applets/FilesBrowser'
import { TaskBoard } from './applets/TaskBoard'
import { useIsMobile } from '@/utilities/useMediaQuery'
import type { ChatControlProps, ChatChannel } from './types'
import { DEFAULT_APPLETS } from './types'

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
  channelSlug,
  onSpaceChange,
  liveKitEnabled,
  className = '',
}: ChatControlProps) {
  // Try ChatProvider context
  const chatCtx = useChatContext()
  const hasProvider = chatCtx !== null

  // Space management — provider or local
  const [localSpaceId, setLocalSpaceId] = useState(initialSpaceId || '1')
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

  // Find active channel data from both regular and DM channels
  const activeChannelData =
    channels.find((c) => c.slug === activeChannel) ||
    dmChannels.find((c) => c.slug === activeChannel)
  const activeSpace = spaces.find((s) => s.id === activeSpaceId)

  // Compute which applets are enabled for the active space + channel
  const enabledApplets = useMemo(() => {
    // DM channels: only chat (DMs are conversations, not workspaces)
    if (activeChannelData?.type === 'dm') {
      return DEFAULT_APPLETS.filter((a) => a.id === 'chat')
    }
    const spaceAppletIds = activeSpace?.enabledApplets || ['chat', 'files', 'tasks']
    return DEFAULT_APPLETS.filter((a) => spaceAppletIds.includes(a.id))
  }, [activeChannelData, activeSpace])

  // Reset applet to chat when switching channels
  const handleSwitchChannel = useCallback(
    (slug: string) => {
      setActiveApplet('chat')
      switchChannel(slug)
    },
    [switchChannel],
  )

  const handleSpaceChange = (newSpaceId: string) => {
    if (hasProvider) {
      chatCtx!.setActiveSpace(newSpaceId)
    } else {
      setLocalSpaceId(newSpaceId)
    }
    onSpaceChange?.(newSpaceId)
  }

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

  const showLiveKit = !!(liveKitEnabled && process.env.NEXT_PUBLIC_LIVEKIT_URL)

  /** Render a DM channel item in the sidebar */
  function renderDMItem(ch: ChatChannel) {
    const isLeo = ch.slug.endsWith('-leo')
    const sourceIcon = ch.source && ch.source !== 'native' ? SOURCE_ICONS[ch.source] : null
    const icon = isLeo ? <Bot size={14} className="shrink-0 opacity-70" /> : <User size={14} className="shrink-0 opacity-50" />

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
          {sourceIcon ? <span className="shrink-0 text-xs">{sourceIcon}</span> : icon}
          {channelsPanelOpen && (
            <span className="truncate">
              {isLeo ? 'LEO' : ch.name}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className={`flex h-full min-h-[500px] flex-col md:flex-row overflow-hidden rounded-lg border border-border bg-background ${className}`}>

      {/* ─── LEFT PANEL: Space selector + Collapsible channels ─── */}
      {isMobile ? (
        /* Mobile: compact top bar with space selector + channel tabs */
        <div className="shrink-0 border-b border-border bg-muted/30">
          {spaces.length > 1 && (
            <div className="border-b border-border">
              <SpaceSelector
                spaces={spaces}
                activeSpaceId={activeSpaceId}
                onSelect={handleSpaceChange}
                isLoading={isLoadingSpaces}
              />
            </div>
          )}

          {/* Channel tabs (horizontal scroll) — includes DMs */}
          <div className="flex items-center gap-1 overflow-x-auto px-2 py-2 scrollbar-none">
            {isLoadingChannels ? (
              <div className="flex gap-2 px-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-muted" />
                ))}
              </div>
            ) : (
              <>
                {/* Regular channels */}
                {channels.filter((c) => c.type !== 'dm').map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleSwitchChannel(ch.slug)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      ch.slug === activeChannel
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground active:bg-muted/80'
                    }`}
                  >
                    <Hash size={12} className="shrink-0" />
                    <span>{ch.name}</span>
                  </button>
                ))}
                {/* DM channels on mobile */}
                {dmChannels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleSwitchChannel(ch.slug)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      ch.slug === activeChannel
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground active:bg-muted/80'
                    }`}
                  >
                    {ch.slug.endsWith('-leo') ? <Bot size={12} /> : <User size={12} />}
                    <span>{ch.slug.endsWith('-leo') ? 'LEO' : ch.name}</span>
                  </button>
                ))}
              </>
            )}
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex shrink-0 items-center justify-center rounded-full bg-muted p-1.5 text-muted-foreground active:bg-muted/80"
              aria-label="Add channel"
            >
              <Plus size={14} />
            </button>
          </div>

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
          {/* Space selector */}
          <div className="border-b border-border">
            <SpaceSelector
              spaces={spaces}
              activeSpaceId={activeSpaceId}
              onSelect={handleSpaceChange}
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
                <div className="p-3 text-xs text-muted-foreground">No channels yet</div>
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
                      <Hash size={14} className="shrink-0 opacity-50" />
                      {channelsPanelOpen && <span className="truncate">{ch.name}</span>}
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
      <div className="flex flex-1 flex-col min-h-0">
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
                {activeChannelData?.type === 'dm' && activeChannelData.slug.endsWith('-leo')
                  ? 'LEO'
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

            {/* Right side: LiveKit + Settings + Members */}
            <div className="flex items-center gap-1">
              {showLiveKit && (
                <LiveKitButton
                  spaceId={activeSpaceId}
                  channelSlug={activeChannel}
                />
              )}
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
            <MessageList messages={messages} isLoading={isLoading} isLoadingMore={isLoadingMore} hasMore={hasMore} onLoadMore={loadMoreMessages} />
            <MessageInput
              onSend={sendMessage}
              disabled={isLoading}
              placeholder={
                activeChannelData?.type === 'dm'
                  ? activeChannelData.slug.endsWith('-leo')
                    ? 'Ask LEO anything...'
                    : `Message ${activeChannelData.name}...`
                  : `Message #${activeChannelData?.name || activeChannel}...`
              }
            />
          </>
        ) : activeApplet === 'files' ? (
          <FilesBrowser channelId={activeChannelData?.id} spaceId={activeSpaceId} />
        ) : activeApplet === 'tasks' ? (
          <TaskBoard channelId={activeChannelData?.id} spaceId={activeSpaceId} />
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

      <MessageList messages={messages} isLoading={isLoading} isLoadingMore={isLoadingMore} hasMore={hasMore} onLoadMore={loadMoreMessages} />
      <MessageInput
        onSend={sendMessage}
        disabled={isLoading}
        placeholder={`Message #${activeChannel}...`}
      />
    </div>
  )
}
