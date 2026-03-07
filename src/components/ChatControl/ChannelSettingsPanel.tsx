'use client'

import React, { useState, useEffect } from 'react'
import { X, Settings, Save, Loader2 } from 'lucide-react'
import { Backdrop } from '@/components/Backdrop'
import type { ChatChannel } from './types'
import { DEFAULT_APPLETS } from './types'

// Relative URLs — see useChat.ts for why NEXT_PUBLIC_SERVER_URL breaks on subdomains
const SERVER_URL = ''

/** Channel type options matching the Payload schema */
const CHANNEL_TYPES = [
  { value: 'general', label: 'General', description: 'Standard chat channel' },
  { value: 'announcements', label: 'Announcements', description: 'Read-only announcements' },
  { value: 'support', label: 'Support', description: 'Customer support conversations' },
  { value: 'sales', label: 'Sales', description: 'Sales pipeline and leads' },
  { value: 'inventory', label: 'Inventory', description: 'Inventory management via images' },
  { value: 'pdf', label: 'PDF', description: 'Document processing and analysis' },
  { value: 'video', label: 'Video', description: 'Video content and streaming' },
  { value: 'team', label: 'Team', description: 'Internal team communication' },
  { value: 'social', label: 'Social', description: 'Social and community chat' },
]

interface ChannelSettingsPanelProps {
  channel: ChatChannel | null
  isOpen: boolean
  onClose: () => void
  /** Called after a successful save so the parent can refresh */
  onSaved?: () => void
}

/**
 * ChannelSettingsPanel — Slide-out panel for channel configuration.
 *
 * Opens from the right side of the screen (follows MemberPanel pattern).
 * Allows editing channel name, description, type, and viewing widget config.
 * Channel type determines "applet" behavior — different channel types
 * unlock different features and workflow triggers.
 */
export function ChannelSettingsPanel({ channel, isOpen, onClose, onSaved }: ChannelSettingsPanelProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('general')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Sync state when channel changes
  useEffect(() => {
    if (channel) {
      setName(channel.name)
      setDescription(channel.description || '')
      setType(channel.type || 'general')
      setFeedback(null)
    }
  }, [channel])

  const handleSave = async () => {
    if (!channel?.id || saving) return
    setSaving(true)
    setFeedback(null)

    try {
      const res = await fetch(`${SERVER_URL}/api/channels/${channel.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, type }),
      })

      if (res.ok) {
        setFeedback({ type: 'success', text: 'Channel settings saved.' })
        onSaved?.()
      } else {
        const err = await res.json().catch(() => ({}))
        setFeedback({ type: 'error', text: err.errors?.[0]?.message || 'Failed to save.' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const selectedType = CHANNEL_TYPES.find((t) => t.value === type)

  return (
    <>
      <Backdrop isOpen onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-border bg-background shadow-xl transition-transform duration-200 ease-out">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold">Channel Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close channel settings"
          >
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Channel Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Channel Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              placeholder="Channel name"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
              placeholder="What is this channel about?"
            />
          </div>

          {/* Channel Type (Applet) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Channel Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {CHANNEL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {selectedType && (
              <p className="text-xs text-muted-foreground">{selectedType.description}</p>
            )}
          </div>

          {/* Default channel indicator */}
          {channel?.isDefault && (
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              This is the default channel for the space. New members see this channel first.
            </div>
          )}

          {/* Applets */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Applets</label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Applets add capabilities to every channel in this space. Toggle applets on or off.
            </p>
            <div className="space-y-2">
              {DEFAULT_APPLETS.map((applet) => (
                <label key={applet.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked
                    disabled={applet.id === 'chat'}
                    readOnly
                    className="rounded border-border accent-primary"
                  />
                  <span className={applet.id === 'chat' ? 'text-muted-foreground' : 'text-foreground'}>
                    {applet.label}
                  </span>
                  {applet.id === 'chat' && (
                    <span className="text-[10px] text-muted-foreground">(always on)</span>
                  )}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Space-level applet management coming in a future update.
            </p>
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`rounded-md p-2.5 text-xs ${
                feedback.type === 'success'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>

        {/* Footer — Save button */}
        <div className="border-t border-border p-4">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}
