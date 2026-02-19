'use client'

import React, { useState } from 'react'
import { Hash, MessageSquare, Plus, X } from 'lucide-react'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { useChat } from './useChat'
import { useIsMobile } from '@/utilities/useMediaQuery'
import type { ChatControlProps } from './types'

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
 * Multi-channel mode - full dashboard with sidebar.
 *
 * Desktop: channel list sidebar on left, messages on right.
 * Mobile: horizontal scrollable channel tabs at top, messages below.
 *
 * Channel management: "+" button to create channels, delete non-default channels.
 */
export function MultiChannelChat({
  spaceId,
  channelSlug,
  className = '',
}: ChatControlProps) {
  const {
    messages,
    channels,
    activeChannel,
    isLoading,
    isLoadingChannels,
    sendMessage,
    switchChannel,
    createChannel,
    deleteChannel,
  } = useChat(spaceId, channelSlug)
  const isMobile = useIsMobile()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelType, setNewChannelType] = useState('general')
  const [isCreating, setIsCreating] = useState(false)

  const activeChannelData = channels.find((c) => c.slug === activeChannel)

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || isCreating) return
    setIsCreating(true)
    const created = await createChannel(newChannelName.trim(), newChannelType)
    if (created) {
      switchChannel(created.slug)
      setNewChannelName('')
      setNewChannelType('general')
      setShowCreateForm(false)
    }
    setIsCreating(false)
  }

  return (
    <div className={`flex h-full min-h-[500px] flex-col md:flex-row overflow-hidden rounded-lg border border-border bg-background ${className}`}>
      {/* Channel list — sidebar on desktop, horizontal tabs on mobile */}
      {isMobile ? (
        <div className="shrink-0 border-b border-border bg-muted/30">
          <div className="flex items-center gap-1 overflow-x-auto px-2 py-2 scrollbar-none">
            {isLoadingChannels ? (
              <div className="flex gap-2 px-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-muted" />
                ))}
              </div>
            ) : channels.length === 0 ? (
              <div className="px-3 py-1 text-xs text-muted-foreground">No channels</div>
            ) : (
              channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => switchChannel(ch.slug)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    ch.slug === activeChannel
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground active:bg-muted/80'
                  }`}
                >
                  <Hash size={12} className="shrink-0" />
                  <span>{ch.name}</span>
                </button>
              ))
            )}
            {/* Add channel button (mobile) */}
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
        <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/30">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Channels</h3>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Add channel"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Inline create form (desktop) */}
          {showCreateForm && (
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

          <nav className="flex-1 overflow-y-auto p-2">
            {isLoadingChannels ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : channels.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No channels yet</div>
            ) : (
              channels.map((ch) => (
                <div
                  key={ch.id}
                  className={`group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                    ch.slug === activeChannel
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <button
                    onClick={() => switchChannel(ch.slug)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <Hash size={14} className="shrink-0 opacity-50" />
                    <span className="truncate">{ch.name}</span>
                  </button>
                  {/* Delete button — only for non-default channels */}
                  {!ch.isDefault && (
                    <button
                      onClick={() => deleteChannel(ch.id)}
                      className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive group-hover:flex"
                      title={`Delete #${ch.name}`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))
            )}
          </nav>
        </aside>
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-h-0">
        {/* Channel header — hidden on mobile (tabs already show active channel) */}
        {!isMobile && (
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Hash size={16} className="text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {activeChannelData?.name || activeChannel}
              </h2>
              {activeChannelData?.description && (
                <p className="text-xs text-muted-foreground">
                  {activeChannelData.description}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <MessageList messages={messages} isLoading={isLoading} />

        {/* Input */}
        <MessageInput
          onSend={sendMessage}
          disabled={isLoading}
          placeholder={`Message #${activeChannelData?.name || activeChannel}...`}
        />
      </div>
    </div>
  )
}

/**
 * Single-channel mode - just the chat area, no sidebar.
 * Literally MultiChannelChat minus the sidebar.
 */
export function SingleChannelChat({
  spaceId,
  channelSlug = 'general',
  className = '',
}: ChatControlProps) {
  const { messages, activeChannel, isLoading, sendMessage } = useChat(
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

      <MessageList messages={messages} isLoading={isLoading} />
      <MessageInput
        onSend={sendMessage}
        disabled={isLoading}
        placeholder={`Message #${activeChannel}...`}
      />
    </div>
  )
}
