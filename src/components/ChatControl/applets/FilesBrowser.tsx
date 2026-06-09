'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, FileText, Download, MessageSquare, Loader2, Hash } from 'lucide-react'
import { logClientError } from '@/utilities/logClientError'
import type { ChatChannel } from '../types'

// Relative URLs — NEXT_PUBLIC_SERVER_URL points at the apex, so on a tenant
// subdomain (clearwater-cruisin.spacesangels.com) an absolute URL is cross-origin
// and the session cookie doesn't ride along → 401/403 → "Couldn't load files".
// Same gotcha + fix as useSpaces.ts / useChat.ts: always fetch same-origin.
const SERVER_URL = ''

interface FilesBrowserProps {
  /** Channel slug — messages are keyed by channel slug (matches useChat). */
  channelSlug?: string
  spaceId?: string | null
  /** All channels in the space — powers the "All channels" scope + slug→name labels. */
  channels?: ChatChannel[]
  /**
   * Switch to the chat view and scroll to the source message. When the file came
   * from another channel (space scope), `channelSlug` tells the host to switch
   * channels first.
   */
  onJumpToMessage?: (messageId: string, channelSlug?: string) => void
}

interface FileItem {
  key: string
  url: string
  filename: string
  mimeType: string
  filesize?: number
  caption?: string
  messageId: string
  messageSnippet: string
  authorName: string
  createdAt: string
  isImage: boolean
  channelSlug: string
}

type Scope = 'channel' | 'space'

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>
    if (typeof c.text === 'string') return c.text
    if (typeof c.body === 'string') return c.body
  }
  return ''
}

/**
 * Files applet — the shared library for a channel, or the whole space.
 *
 * Reads every message attachment (Media on Messages.attachments) and renders each
 * file/image with a link back to its source message in context. The scope toggle
 * widens from the active channel to all channels in the space; in space scope each
 * file is labelled with the channel it lives in and the jump-back switches channels.
 */
export function FilesBrowser({ channelSlug, spaceId, channels, onJumpToMessage }: FilesBrowserProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>('channel')
  const abortRef = useRef<AbortController | null>(null)

  // slug → display name, for the per-file channel chips in space scope.
  const channelNames = useMemo(() => {
    const map = new Map<string, string>()
    ;(channels || []).forEach((c) => map.set(c.slug, c.name))
    return map
  }, [channels])

  const load = useCallback(async () => {
    if (!spaceId || (scope === 'channel' && !channelSlug)) {
      setFiles([])
      setLoading(false)
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const channelFilter =
        scope === 'channel'
          ? `&where[channel][equals]=${encodeURIComponent(channelSlug as string)}`
          : ''
      const res = await fetch(
        `${SERVER_URL}/api/messages?where[space][equals]=${spaceId}` +
          channelFilter +
          `&sort=-createdAt&limit=300&depth=1`,
        { signal: ctrl.signal, credentials: 'include' },
      )
      if (!res.ok) throw new Error(`Failed to load files (${res.status})`)
      const data = await res.json()
      const docs: Array<Record<string, unknown>> = Array.isArray(data?.docs) ? data.docs : []

      const collected: FileItem[] = []
      for (const msg of docs) {
        const atts = msg.attachments
        if (!Array.isArray(atts)) continue
        const author = msg.author as Record<string, unknown> | null
        const authorName =
          (author && typeof author === 'object'
            ? (author.name as string) || (author.email as string)
            : '') || 'Unknown'
        const snippet = extractText(msg.content).slice(0, 80)
        const msgChannel = typeof msg.channel === 'string' ? msg.channel : channelSlug || ''
        atts.forEach((att: Record<string, unknown>, idx: number) => {
          const media = att.media as Record<string, unknown> | number | null
          if (!media || typeof media !== 'object') return
          const url = (media.url as string) || `/api/media/file/${media.filename as string}`
          const mimeType = (media.mimeType as string) || ''
          collected.push({
            key: `${msg.id}-${idx}`,
            url,
            filename: (media.filename as string) || 'file',
            mimeType,
            filesize: media.filesize as number | undefined,
            caption: (att.caption as string) || undefined,
            messageId: String(msg.id),
            messageSnippet: snippet,
            authorName,
            createdAt: String(msg.createdAt || ''),
            isImage: mimeType.startsWith('image/'),
            channelSlug: msgChannel,
          })
        })
      }
      setFiles(collected)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        const msg = (e as Error).message || 'Failed to load files'
        setError(msg)
        // User action (opened the file viewer) → route to logError, not console.
        logClientError({
          source: 'FilesBrowser/load',
          message: msg,
          details: `scope=${scope} channel=${channelSlug ?? ''} space=${spaceId ?? ''}`,
          spaceId,
        })
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [channelSlug, spaceId, scope])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  const ScopeToggle = (channels && channels.length > 1) ? (
    <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 text-[11px]">
      <button
        onClick={() => setScope('channel')}
        className={`rounded-md px-2 py-1 font-medium transition-colors ${
          scope === 'channel' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        This channel
      </button>
      <button
        onClick={() => setScope('space')}
        className={`rounded-md px-2 py-1 font-medium transition-colors ${
          scope === 'space' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        All channels
      </button>
    </div>
  ) : null

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
        <Loader2 size={20} className="animate-spin" />
        <span className="ml-2 text-xs">Loading files…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-xs text-destructive">Couldn&rsquo;t load files. Please try again.</p>
        <button
          onClick={load}
          className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          Retry
        </button>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        {ScopeToggle && <div className="mb-4">{ScopeToggle}</div>}
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
          <FolderOpen size={32} className="text-muted-foreground/40" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No files yet</h3>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          {scope === 'space'
            ? 'Shared files and media across this space will appear here.'
            : 'Shared files and media for this channel will appear here. Drop files into the chat to start building your library.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Files <span className="text-muted-foreground">({files.length})</span>
        </h3>
        {ScopeToggle}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {files.map((f) => (
          <div
            key={f.key}
            className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
          >
            {/* Preview */}
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative flex aspect-video items-center justify-center overflow-hidden bg-muted/40"
              title={`Open ${f.filename}`}
            >
              {f.isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.url}
                  alt={f.caption || f.filename}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <FileText size={28} />
                  <span className="text-[10px] uppercase">
                    {f.filename.split('.').pop()?.slice(0, 5) || 'file'}
                  </span>
                </div>
              )}
            </a>

            {/* Meta */}
            <div className="flex flex-1 flex-col gap-1 p-2.5">
              <p className="truncate text-xs font-medium" title={f.filename}>
                {f.caption || f.filename}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {[formatSize(f.filesize), f.authorName].filter(Boolean).join(' · ')}
              </p>

              {scope === 'space' && f.channelSlug && (
                <span className="inline-flex w-fit items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  <Hash size={9} />
                  {channelNames.get(f.channelSlug) || f.channelSlug}
                </span>
              )}

              <div className="mt-auto flex items-center justify-between pt-1">
                {onJumpToMessage ? (
                  <button
                    onClick={() => onJumpToMessage(f.messageId, f.channelSlug)}
                    className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                    title={f.messageSnippet ? `In context: "${f.messageSnippet}…"` : 'View in chat'}
                  >
                    <MessageSquare size={11} />
                    In context
                  </button>
                ) : (
                  <span />
                )}
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                  title={`Open ${f.filename}`}
                >
                  <Download size={11} />
                  Open
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
