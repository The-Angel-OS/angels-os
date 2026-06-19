'use client'

import React, { useRef, useEffect, useCallback, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from './types'
import { TOOL_LABELS } from '@/constants/toolLabels'
import { ImageLightbox } from './ImageLightbox'
import { InlineChatForm } from './InlineChatForm'

// ---------------------------------------------------------------------------
// Message action buttons (copy, speak, vote, share, dispute)
// ---------------------------------------------------------------------------

/** TTS speak/pause toggle using Web Speech API */
function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const toggle = useCallback((text: string) => {
    const synth = window.speechSynthesis
    if (!synth) return

    if (speaking) {
      synth.cancel()
      setSpeaking(false)
      return
    }

    // Cancel anything else playing
    synth.cancel()

    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 1.0
    utt.pitch = 1.0
    // Prefer a natural voice if available
    const voices = synth.getVoices()
    const preferred = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google')),
    )
    if (preferred) utt.voice = preferred

    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)
    utteranceRef.current = utt
    synth.speak(utt)
    setSpeaking(true)
  }, [speaking])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  return { speaking, toggle }
}

function MessageActions({
  message,
  onDispute,
}: {
  message: ChatMessage
  onDispute?: (message: ChatMessage) => void
}) {
  const [copied, setCopied] = useState(false)
  const [voted, setVoted] = useState<'up' | 'down' | null>(null)
  const { speaking, toggle: toggleSpeak } = useSpeech()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = message.content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleVote = (direction: 'up' | 'down') => {
    setVoted((prev) => (prev === direction ? null : direction))
    // TODO: POST to /api/feedback with { messageId, vote: direction }
  }

  const handleDispute = () => {
    if (onDispute) {
      onDispute(message)
    }
  }

  return (
    <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
      {/* Copy */}
      <button
        onClick={handleCopy}
        className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
        title={copied ? 'Copied!' : 'Copy response'}
      >
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-green-500">
            <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M5.5 3.5A1.5 1.5 0 0 1 7 2h2.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061V9.5A1.5 1.5 0 0 1 12 11V8.621a3 3 0 0 0-.879-2.121L9 4.379A3 3 0 0 0 6.879 3.5H5.5Z" />
            <path d="M4 5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 4 14h5a1.5 1.5 0 0 0 1.5-1.5V8.621a1.5 1.5 0 0 0-.44-1.06L7.94 5.439A1.5 1.5 0 0 0 6.878 5H4Z" />
          </svg>
        )}
      </button>

      {/* Speak / TTS toggle */}
      <button
        onClick={() => toggleSpeak(message.content)}
        className={`rounded-md p-1 transition-colors hover:bg-muted hover:text-foreground ${
          speaking ? 'text-primary' : 'text-muted-foreground/50'
        }`}
        title={speaking ? 'Stop speaking' : 'Read aloud'}
      >
        {speaking ? (
          /* Pause icon */
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M4.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-2Zm5 0a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-2Z" />
          </svg>
        ) : (
          /* Speaker icon */
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M7.557 2.066A.75.75 0 0 1 8 2.75v10.5a.75.75 0 0 1-1.248.56L3.59 11H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.59l3.162-2.81a.75.75 0 0 1 .805-.124ZM12.95 3.05a.75.75 0 1 0-1.06 1.06 5.5 5.5 0 0 1 0 7.78.75.75 0 1 0 1.06 1.06 7 7 0 0 0 0-9.9Z" />
            <path d="M10.828 5.172a.75.75 0 1 0-1.06 1.06 2.5 2.5 0 0 1 0 3.536.75.75 0 1 0 1.06 1.06 4 4 0 0 0 0-5.656Z" />
          </svg>
        )}
      </button>

      {/* Thumbs up */}
      <button
        onClick={() => handleVote('up')}
        className={`rounded-md p-1 transition-colors hover:bg-muted hover:text-foreground ${
          voted === 'up' ? 'text-green-500' : 'text-muted-foreground/50'
        }`}
        title="Helpful"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M2.09 15a1 1 0 0 0 1-1V8a1 1 0 1 0-2 0v6a1 1 0 0 0 1 1ZM5.765 13H4.09V8.665l2.585-4.525a.5.5 0 0 1 .69-.182l.004.002a1.252 1.252 0 0 1 .476 1.637l-.967 1.903h4.212a1.5 1.5 0 0 1 1.46 1.842l-1.084 4.55A1.5 1.5 0 0 1 10.006 15H5.765v-2Z" />
        </svg>
      </button>

      {/* Thumbs down */}
      <button
        onClick={() => handleVote('down')}
        className={`rounded-md p-1 transition-colors hover:bg-muted hover:text-foreground ${
          voted === 'down' ? 'text-red-500' : 'text-muted-foreground/50'
        }`}
        title="Not helpful"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M13.91 1a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V2a1 1 0 0 0-1-1ZM10.235 3H11.91v4.335L9.325 11.86a.5.5 0 0 1-.69.182l-.004-.002a1.252 1.252 0 0 1-.476-1.637l.967-1.903H4.91a1.5 1.5 0 0 1-1.46-1.842l1.084-4.55A1.5 1.5 0 0 1 5.994 1h4.24v2Z" />
        </svg>
      </button>

      {/* Share */}
      <button
        onClick={() => {
          // Deep-link to this exact message in its channel. The path already reflects
          // /dashboard/spaces/{spaceId}/{channelId} (synced on navigation), so appending
          // ?msg=<id> lands a viewer on the highlighted message. ponytail: in-app link
          // (members only); a public /shared/response/<id> view is the per-space-opt-in follow-up.
          const base = window.location.pathname.startsWith('/dashboard/spaces')
            ? window.location.pathname
            : '/dashboard/spaces'
          navigator.clipboard.writeText(`${window.location.origin}${base}?msg=${message.id}`)
        }}
        className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
        title="Copy link to this message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M12.5 2.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-6 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm6 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM5.968 6.257l4.564-2.47M5.968 8.743l4.564 2.47" />
        </svg>
      </button>

      {/* Dispute / Community Vote */}
      <button
        onClick={handleDispute}
        className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
        title="Dispute — request community vote"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M2.75 2a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5A.75.75 0 0 1 2.75 2Zm3.5 1.842a2.25 2.25 0 0 1 1.218-.362h.932c1.149 0 2.221.521 2.934 1.414l.357.447a.75.75 0 0 1-.074 1.024L9.833 7.9l1.882 2.695a.75.75 0 0 1-.106 1.003l-.543.476A2.25 2.25 0 0 1 9.583 12.7H6.25V3.842Z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error Detail — surfaces the raw provider/tool error on a failed message.
// Native tooltip on hover (quick glance) + click to expand a selectable,
// copyable block with a copy button.
// ---------------------------------------------------------------------------

function ErrorDetail({ detail }: { detail: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(detail)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = detail
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        title={detail}
        className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
          <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
        </svg>
        {open ? 'Hide error' : 'Show error'}
      </button>
      {open && (
        <div className="mt-1 flex items-start justify-between gap-2 rounded-md border border-red-500/20 bg-red-500/5 p-2">
          <pre className="flex-1 select-text whitespace-pre-wrap break-words font-mono text-[11px] text-red-700 dark:text-red-300">
            {detail}
          </pre>
          <button
            onClick={copy}
            title={copied ? 'Copied!' : 'Copy error'}
            className="shrink-0 rounded p-1 text-red-500/70 transition-colors hover:bg-red-500/10 hover:text-red-600"
          >
            {copied ? (
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-green-500">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M5.5 3.5A1.5 1.5 0 0 1 7 2h2.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061V9.5A1.5 1.5 0 0 1 12 11V8.621a3 3 0 0 0-.879-2.121L9 4.379A3 3 0 0 0 6.879 3.5H5.5Z" />
                <path d="M4 5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 4 14h5a1.5 1.5 0 0 0 1.5-1.5V8.621a1.5 1.5 0 0 0-.44-1.06L7.94 5.439A1.5 1.5 0 0 0 6.878 5H4Z" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dispute Dialog — inline community vote request (replaces mailto)
// ---------------------------------------------------------------------------

function DisputeDialog({
  message,
  onClose,
  onSubmit,
}: {
  message: ChatMessage
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-sm font-semibold text-foreground">Dispute This Response</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Request a community vote on whether this response is accurate, helpful, or appropriate.
        </p>

        {/* Quoted content */}
        <div className="mb-3 max-h-24 overflow-y-auto rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          &ldquo;{message.content.slice(0, 300)}{message.content.length > 300 ? '...' : ''}&rdquo;
        </div>

        {/* Reason */}
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why should this be disputed? (inaccurate, harmful, off-topic...)"
          className="mb-3 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          rows={3}
          autoFocus
        />

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Disputes are reviewed by the community
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSubmit(reason); onClose() }}
              disabled={!reason.trim()}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Submit Dispute
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface MessageListProps {
  messages: ChatMessage[]
  isLoading?: boolean
  /** Full-page immersive mode (centered layout, avatars, streaming cursor) */
  fullPage?: boolean
  /** Infinite scroll support */
  isLoadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  /** Catch-All triage view: show each message's source channel as a badge. */
  showChannelTags?: boolean
}

// ---------------------------------------------------------------------------
// Date separator helpers
// ---------------------------------------------------------------------------

function formatDateSeparator(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' })
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// ---------------------------------------------------------------------------
// Tool call status pill
// ---------------------------------------------------------------------------

function ToolCallIndicator({ toolCall }: { toolCall: string }) {
  const label = TOOL_LABELS[toolCall] || toolCall
  return (
    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
      <span>{label}&hellip;</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline Image Display
// ---------------------------------------------------------------------------

function MessageImages({ images }: { images: NonNullable<ChatMessage['images']> }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  if (images.length === 0) return null

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  // Layout: single image gets more space, 2 images side-by-side, 3+ grid
  const gridClass =
    images.length === 1
      ? 'grid-cols-1 max-w-sm'
      : images.length === 2
        ? 'grid-cols-2 max-w-lg'
        : 'grid-cols-3 max-w-xl'

  return (
    <>
      <div className={`mt-2 grid gap-1.5 ${gridClass}`}>
        {images.map((img, i) => (
          <button
            key={`${img.url}-${i}`}
            onClick={() => openLightbox(i)}
            className="group relative overflow-hidden rounded-lg border border-border/50 transition-all hover:shadow-lg hover:border-primary/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.alt || 'Attached image'}
              className={`w-full object-cover rounded-lg transition-transform group-hover:scale-[1.02] ${
                images.length === 1 ? 'max-h-80' : 'h-32 sm:h-40'
              }`}
              loading="lazy"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
            {/* Multiple images indicator */}
            {images.length > 1 && i === 0 && (
              <span className="absolute top-1.5 right-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                {images.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <ImageLightbox
        images={images}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  )
}

/** File type category detection from mime type */
function getMimeCategory(mimeType?: string): 'document' | 'video' | 'archive' | 'spreadsheet' | 'other' {
  if (!mimeType) return 'other'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('gz')) return 'archive'
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel')) return 'spreadsheet'
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text') || mimeType.includes('word')) return 'document'
  return 'other'
}

/** Category → accent color for rendered file chips */
const RENDERED_CHIP_COLORS: Record<string, string> = {
  document: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
  video: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
  archive: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  spreadsheet: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  other: 'bg-gray-500/10 border-gray-500/20 text-gray-600 dark:text-gray-400',
}

function MessageAttachments({ attachments }: { attachments: NonNullable<ChatMessage['attachments']> }) {
  if (attachments.length === 0) return null

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((att, i) => {
        const category = getMimeCategory(att.mimeType)
        const ext = att.filename?.split('.').pop()?.toUpperCase() || '?'
        const colors = RENDERED_CHIP_COLORS[category] || RENDERED_CHIP_COLORS.other
        const displayName = att.filename && att.filename.length > 22
          ? `${att.filename.slice(0, 19)}…`
          : att.filename || 'File'

        return (
          <a
            key={`${att.url}-${i}`}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-all hover:shadow-sm hover:border-primary/30 ${colors}`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-current/10">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                {displayName}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {ext}{att.filesize ? ` · ${formatSize(att.filesize)}` : ''}
              </p>
            </div>
          </a>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Streaming cursor (blinking bar)
// ---------------------------------------------------------------------------

function StreamingCursor() {
  return (
    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground/60" />
  )
}

// ---------------------------------------------------------------------------
// SSE Liveness Indicator — decaying heartbeat between stream events
// ---------------------------------------------------------------------------

/**
 * Shows a small animated bar that pulses bright when an SSE event arrives and
 * smoothly decays to near-transparent over ~600ms.  Each new `lastDeltaAt`
 * timestamp restarts the CSS animation so the decay is visually continuous.
 *
 * Uses a key-based remount to restart the CSS animation on every event rather
 * than manipulating styles imperatively — simple and React-idiomatic.
 */
function LivenessIndicator({ lastDeltaAt }: { lastDeltaAt: number }) {
  return (
    <span
      key={lastDeltaAt}
      className="liveness-decay ml-1.5 inline-flex items-center gap-1"
      aria-hidden="true"
    >
      <span className="liveness-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
      <span className="liveness-bar h-1 w-6 rounded-full bg-emerald-400" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

/** Generate a deterministic HSL hue from a string (for consistent user avatar colors) */
function stringToHue(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

function Avatar({ name, isLeo, isStreaming }: { name: string; isLeo: boolean; isStreaming?: boolean }) {
  if (isLeo) {
    return (
      <div className="relative">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-[10px] font-bold text-white shadow-sm ${isStreaming ? 'ring-2 ring-blue-400/50 animate-pulse' : ''}`}>
          &#10022;
        </div>
        {/* Online status dot */}
        <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
      </div>
    )
  }
  const initials = name
    .split(/[\s@]/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const hue = stringToHue(name)
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
    >
      {initials || '?'}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Truncated Message — CSS line-clamp with expand/collapse toggle
// ---------------------------------------------------------------------------

const TRUNCATE_THRESHOLD = 200

function TruncatedMessage({
  content,
  isStreaming,
  useMarkdown = false,
  isNewest = false,
}: {
  content: string
  isStreaming?: boolean
  useMarkdown?: boolean
  /** When true the message is always fully expanded (no "More" button) */
  isNewest?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const shouldTruncate = !isStreaming && !isNewest && content.length > TRUNCATE_THRESHOLD

  const body = useMarkdown ? (
    <div className={`prose prose-sm prose-invert max-w-none break-words ${shouldTruncate && !expanded ? 'line-clamp-4' : ''}`}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Open links in new tab safely
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {children}
          </a>
        ),
        // Inline code style
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-')
          return isBlock ? (
            <code className={`block rounded bg-black/30 p-2 text-xs font-mono overflow-x-auto ${className ?? ''}`}>
              {children}
            </code>
          ) : (
            <code className="rounded bg-black/30 px-1 py-0.5 text-xs font-mono">{children}</code>
          )
        },
        pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded bg-black/20 p-2">{children}</pre>,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  ) : (
    <div className={`whitespace-pre-wrap ${shouldTruncate && !expanded ? 'line-clamp-4' : ''}`}>
      {content}
    </div>
  )

  return (
    <>
      {body}
      {isStreaming && !useMarkdown && <StreamingCursor />}
      {shouldTruncate && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          className="mt-1 text-xs font-medium text-primary/80 hover:text-primary transition-colors"
        >
          {expanded ? 'Show less' : 'More'}
        </button>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Current viewer (for "edit your own message" + moderator controls)
// ---------------------------------------------------------------------------

const MOD_ROLES = ['super_admin', 'admin', 'archangel']

function useCurrentViewer() {
  const [viewer, setViewer] = useState<{ id?: string; roles?: string[] } | null>(null)
  useEffect(() => {
    let cancelled = false
    // Relative URL — same-origin so the session cookie rides along on subdomains.
    fetch('/api/users/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.user) setViewer({ id: String(d.user.id), roles: d.user.roles })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  return viewer
}

// ---------------------------------------------------------------------------
// A single message row — owns its edit / history / moderation state
// ---------------------------------------------------------------------------

function CompactMessageRow({
  msg,
  isNewest,
  viewer,
  override,
  onSaved,
  onDispute,
  showChannelTag,
}: {
  msg: ChatMessage
  isNewest: boolean
  viewer: { id?: string; roles?: string[] } | null
  override?: string
  onSaved: (id: string, content: string) => void
  onDispute: (m: ChatMessage) => void
  showChannelTag?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const content = override ?? msg.content
  const isMine = Boolean(viewer?.id && msg.authorId && viewer.id === msg.authorId)
  const isMod = Boolean(viewer?.roles?.some((r) => MOD_ROLES.includes(r)))
  const canEdit = msg.role !== 'system' && !msg.isStreaming && (isMine || isMod)
  const canModerate = msg.role !== 'system' && !msg.isStreaming && isMod && !isMine

  // PATCH content — the server's versionOnEdit hook captures the prior version.
  const patch = async (newContent: string) => {
    if (!newContent.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/messages/${msg.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      })
      if (res.ok) {
        onSaved(msg.id, newContent)
        setEditing(false)
      }
    } catch {
      /* next poll reconciles; keep the editor open on failure */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      id={`msg-${msg.id}`}
      className={`group/msg flex scroll-mt-24 rounded-xl transition-colors duration-700 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div className="max-w-[80%]">
        {showChannelTag && msg.channel && (
          <span className="mb-1 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            #{msg.channel}
          </span>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            msg.role === 'user'
              ? 'bg-primary text-primary-foreground'
              : msg.role === 'system'
                ? 'border border-border bg-muted/50 text-muted-foreground italic'
                : msg.isError
                  ? 'border border-red-500/30 bg-red-500/5 text-foreground'
                  : 'bg-muted text-foreground'
          }`}
        >
          {msg.role !== 'system' && msg.authorName && (
            <div className="mb-1 text-xs font-medium opacity-70">
              {msg.authorName}
              {msg.isDeepThink && !msg.isStreaming && (
                <span className="ml-1 text-[10px] opacity-60" title="Deep think response">🧠</span>
              )}
            </div>
          )}
          {msg.activeToolCall && <ToolCallIndicator toolCall={msg.activeToolCall} />}

          {editing ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(8, draft.split('\n').length + 1)}
                className="w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => patch(draft)}
                  disabled={busy || !draft.trim()}
                  className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} className="rounded-md border border-border px-2.5 py-1 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <TruncatedMessage content={content} isStreaming={msg.isStreaming} useMarkdown={msg.role !== 'user'} isNewest={isNewest} />
          )}

          {msg.isError && msg.errorDetail && <ErrorDetail detail={msg.errorDetail} />}
          {msg.isStreaming && msg.lastDeltaAt && <LivenessIndicator lastDeltaAt={msg.lastDeltaAt} />}
          {msg.images && msg.images.length > 0 && <MessageImages images={msg.images} />}
          {msg.attachments && msg.attachments.length > 0 && <MessageAttachments attachments={msg.attachments} />}
          {msg.widgets?.map((w, i) =>
            w.widgetType === 'inline_form' ? <InlineChatForm key={`widget-${i}`} config={w} /> : null,
          )}

          <div className="mt-1 flex items-center gap-1.5 text-[10px] opacity-50">
            <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {(msg.edited || (msg.revisions && msg.revisions.length > 0)) && (
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="underline-offset-2 hover:underline"
                title="View edit history"
              >
                {msg.moderated ? '(edited · moderated)' : '(edited)'}
              </button>
            )}
          </div>

          {showHistory && msg.revisions && msg.revisions.length > 0 && (
            <div className="mt-1.5 space-y-1.5 rounded-md border border-border/40 bg-background/40 p-2 text-[11px] text-foreground">
              <p className="font-medium opacity-70">Edit history ({msg.revisions.length})</p>
              {msg.revisions.map((r, i) => (
                <div key={i} className="border-l-2 border-border pl-2">
                  <p className="opacity-50">
                    {r.moderation ? 'moderated' : 'edited'}
                    {r.editedAt ? ` · ${new Date(r.editedAt).toLocaleString()}` : ''}
                  </p>
                  <p className="whitespace-pre-wrap opacity-80">{r.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action row — LEO feedback buttons + author edit + moderator remove */}
        <div className={`mt-0.5 flex items-center gap-1 ${msg.role === 'user' ? 'justify-end' : ''}`}>
          {msg.role === 'leo' && !msg.isStreaming && msg.content && (
            <MessageActions message={msg} onDispute={onDispute} />
          )}
          {canEdit && !editing && (
            <button
              onClick={() => { setDraft(content); setEditing(true) }}
              className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/msg:opacity-100"
            >
              Edit
            </button>
          )}
          {canModerate && !editing && (
            <button
              onClick={() => patch('[removed by a moderator]')}
              title="Redact — the original is kept in the message's edit history"
              className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/msg:opacity-100"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compact Mode (existing bubble style — for MinimalistChat & MultiChannelChat)
// ---------------------------------------------------------------------------

function CompactMessageList({ messages, isLoading, isLoadingMore, hasMore, onLoadMore, showChannelTags }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const prevScrollHeight = useRef<number>(0)
  const prevCountRef = useRef(messages.length)
  const [showNewBadge, setShowNewBadge] = useState(false)
  const [disputeMsg, setDisputeMsg] = useState<ChatMessage | null>(null)
  const viewer = useCurrentViewer()
  // Optimistic content overrides after an edit — reconciled by the next poll.
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const onSaved = useCallback((id: string, content: string) => {
    setOverrides((prev) => ({ ...prev, [id]: content }))
  }, [])

  // Smart scroll — only auto-scroll if user is near bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const threshold = 100
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setShowNewBadge(false)
    } else if (messages.length > prevCountRef.current) {
      setShowNewBadge(true)
    }
    prevCountRef.current = messages.length
  }, [messages])

  // Dismiss badge when user scrolls back to bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      const threshold = 100
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
      if (isNearBottom) setShowNewBadge(false)
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  // Preserve scroll position when prepending older messages
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isLoadingMore) return
    prevScrollHeight.current = el.scrollHeight
  }, [isLoadingMore])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || isLoadingMore) return
    if (prevScrollHeight.current > 0) {
      const diff = el.scrollHeight - prevScrollHeight.current
      el.scrollTop += diff
      prevScrollHeight.current = 0
    }
  }, [messages, isLoadingMore])

  // Infinite scroll — IntersectionObserver on sentinel at top
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
        onLoadMore()
      }
    },
    [hasMore, isLoadingMore, onLoadMore],
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(observerCallback, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [observerCallback])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        No messages yet. Start a conversation!
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-3 p-4">
      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {isLoadingMore && (
        <div className="flex justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        </div>
      )}

      {/* Spacer pushes messages toward the bottom when few messages exist */}
      <div className="flex-1" />
      {messages.map((msg, index) => (
        <CompactMessageRow
          key={msg.id}
          msg={msg}
          isNewest={index === messages.length - 1}
          viewer={viewer}
          override={overrides[msg.id]}
          onSaved={onSaved}
          onDispute={setDisputeMsg}
          showChannelTag={showChannelTags}
        />
      ))}

      {/* Dispute dialog */}
      {disputeMsg && (
        <DisputeDialog
          message={disputeMsg}
          onClose={() => setDisputeMsg(null)}
          onSubmit={(reason) => {
            // TODO: POST to /api/disputes with { messageId, reason }
            console.log('[dispute]', disputeMsg.id, reason)
          }}
        />
      )}

      {isLoading && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce [animation-delay:0.1s]">.</span>
              <span className="animate-bounce [animation-delay:0.2s]">.</span>
            </div>
          </div>
        </div>
      )}

      {/* New messages badge */}
      {showNewBadge && (
        <button
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            setShowNewBadge(false)
          }}
          className="sticky bottom-2 mx-auto flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          New messages
        </button>
      )}

      <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Full-Page Mode (immersive centered layout)
// ---------------------------------------------------------------------------

type MessageGroup = {
  authorName: string
  role: ChatMessage['role']
  messages: ChatMessage[]
}

function FullPageMessageList({
  messages,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const prevScrollHeight = useRef<number>(0)
  const [disputeMsg, setDisputeMsg] = useState<ChatMessage | null>(null)

  // Auto-scroll to bottom on new messages (unless user scrolled up)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const threshold = 200
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Preserve scroll position when prepending older messages
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isLoadingMore) return
    prevScrollHeight.current = el.scrollHeight
  }, [isLoadingMore])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || isLoadingMore) return
    if (prevScrollHeight.current > 0) {
      const diff = el.scrollHeight - prevScrollHeight.current
      el.scrollTop += diff
      prevScrollHeight.current = 0
    }
  }, [messages, isLoadingMore])

  // Infinite scroll — IntersectionObserver on sentinel at top
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
        onLoadMore()
      }
    },
    [hasMore, isLoadingMore, onLoadMore],
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(observerCallback, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [observerCallback])

  // Build groups with date separators
  const groups: Array<{ type: 'date'; label: string } | { type: 'group'; group: MessageGroup }> =
    []
  let lastDate: Date | null = null
  let currentGroup: MessageGroup | null = null

  for (const msg of messages) {
    if (!lastDate || !isSameDay(lastDate, msg.timestamp)) {
      if (currentGroup) {
        groups.push({ type: 'group', group: currentGroup })
        currentGroup = null
      }
      groups.push({ type: 'date', label: formatDateSeparator(msg.timestamp) })
      lastDate = msg.timestamp
    }

    if (
      currentGroup &&
      currentGroup.role === msg.role &&
      currentGroup.authorName === (msg.authorName || '')
    ) {
      currentGroup.messages.push(msg)
    } else {
      if (currentGroup) {
        groups.push({ type: 'group', group: currentGroup })
      }
      currentGroup = {
        authorName: msg.authorName || '',
        role: msg.role,
        messages: [msg],
      }
    }
  }
  if (currentGroup) {
    groups.push({ type: 'group', group: currentGroup })
  }

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mb-3 text-4xl opacity-40">&#10022;</div>
          <p className="text-sm text-muted-foreground">Start a conversation with LEO.</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Ask about products, bookings, or anything on the platform.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          </div>
        )}

        {groups.map((item, idx, allGroups) => {
          if (item.type === 'date') {
            return (
              <div key={`date-${idx}`} className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                  {item.label}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )
          }

          const { group } = item
          const isUser = group.role === 'user'
          const isSystem = group.role === 'system'
          const isLeo = group.role === 'leo'
          const isLastGroup = idx === allGroups.length - 1

          return (
            <div
              key={`group-${idx}`}
              className={`mb-5 flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar — only on first message of group */}
              {!isSystem && (
                <div className="mt-0.5 shrink-0">
                  <Avatar name={group.authorName || (isLeo ? 'LEO' : '?')} isLeo={isLeo} isStreaming={isLeo && group.messages.some((m) => m.isStreaming)} />
                </div>
              )}

              <div
                className={`flex min-w-0 flex-1 flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* Author name — shown once per group for everyone except system */}
                {!isSystem && group.authorName && (
                  <span className="mb-0.5 text-xs font-medium text-muted-foreground">
                    {group.authorName}
                  </span>
                )}

                {group.messages.map((msg, msgIdx) => {
                  const isFirst = msgIdx === 0
                  const isLast = msgIdx === group.messages.length - 1

                  return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className={`group/msg max-w-[85%] scroll-mt-24 rounded-xl transition-colors duration-700 ${isSystem ? 'mx-auto text-center' : ''}`}
                    >
                      {msg.activeToolCall && <ToolCallIndicator toolCall={msg.activeToolCall} />}

                      <div
                        className={`px-4 py-2.5 text-sm leading-relaxed ${msg.isError ? 'ring-1 ring-red-500/30' : ''} ${
                          isUser
                            ? `bg-primary text-primary-foreground ${
                                isFirst && isLast
                                  ? 'rounded-2xl'
                                  : isFirst
                                    ? 'rounded-2xl rounded-br-lg'
                                    : isLast
                                      ? 'rounded-2xl rounded-tr-lg'
                                      : 'rounded-lg'
                              }`
                            : isSystem
                              ? 'rounded-xl border border-border bg-muted/50 text-xs text-muted-foreground italic'
                              : `${msg.isError ? 'bg-red-500/5' : 'bg-muted/60'} text-foreground ${
                                  isFirst && isLast
                                    ? 'rounded-2xl'
                                    : isFirst
                                      ? 'rounded-2xl rounded-bl-lg'
                                      : isLast
                                        ? 'rounded-2xl rounded-tl-lg'
                                        : 'rounded-lg'
                                }`
                        }`}
                      >
                        {msg.isStreaming && !msg.content && !msg.activeToolCall ? (
                        <div className="whitespace-pre-wrap">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <span className="animate-bounce text-xs">.</span>
                            <span className="animate-bounce text-xs [animation-delay:0.1s]">
                              .
                            </span>
                            <span className="animate-bounce text-xs [animation-delay:0.2s]">
                              .
                            </span>
                          </span>
                        </div>
                      ) : (
                        <TruncatedMessage content={msg.content} isStreaming={msg.isStreaming} useMarkdown={isLeo} isNewest={isLastGroup && isLast} />
                      )}
                        {msg.isError && msg.errorDetail && <ErrorDetail detail={msg.errorDetail} />}
                        {msg.isStreaming && msg.lastDeltaAt && (
                          <div className="mt-1">
                            <LivenessIndicator lastDeltaAt={msg.lastDeltaAt} />
                          </div>
                        )}
                        {msg.images && msg.images.length > 0 && (
                          <MessageImages images={msg.images} />
                        )}
                        {msg.widgets?.map((w, i) =>
                          w.widgetType === 'inline_form' ? (
                            <InlineChatForm key={`widget-${i}`} config={w} />
                          ) : null,
                        )}
                      </div>

                      {/* Action buttons — LEO messages only, visible on hover */}
                      {isLeo && !msg.isStreaming && msg.content && (
                        <MessageActions message={msg} onDispute={setDisputeMsg} />
                      )}

                      {isLast && (
                        <div
                          className={`mt-1 text-[10px] text-muted-foreground/40 ${isUser ? 'text-right' : ''}`}
                        >
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Loading dots for batch (non-streaming) responses */}
        {isLoading && !messages.some((m) => m.isStreaming) && (
          <div className="mb-5 flex gap-3">
            <div className="mt-0.5 shrink-0">
              <Avatar name="LEO" isLeo />
            </div>
            <div>
              <div className="rounded-2xl bg-muted/60 px-4 py-2.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="animate-bounce text-sm">.</span>
                  <span className="animate-bounce text-sm [animation-delay:0.1s]">.</span>
                  <span className="animate-bounce text-sm [animation-delay:0.2s]">.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Dispute dialog */}
      {disputeMsg && (
        <DisputeDialog
          message={disputeMsg}
          onClose={() => setDisputeMsg(null)}
          onSubmit={(reason) => {
            // TODO: POST to /api/disputes with { messageId, reason }
            console.log('[dispute]', disputeMsg.id, reason)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Export — dual mode
// ---------------------------------------------------------------------------

export function MessageList(props: MessageListProps) {
  if (props.fullPage) {
    return <FullPageMessageList {...props} />
  }
  return <CompactMessageList {...props} />
}
