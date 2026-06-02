'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ScrollText,
  Columns,
  Loader2,
} from 'lucide-react'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || ''

interface BookViewerProps {
  /** Channel slug — the "book"; its messages are the pages. */
  channelSlug?: string
  spaceId?: string | null
  /** Optional display title (falls back to channel name). */
  title?: string
}

interface BookPage {
  id: string
  order: number
  title?: string
  markdown: string
  images: { url: string; alt?: string }[]
  videos: { url: string; mime: string }[]
}

type ReadMode = 'paged' | 'scroll'

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>
    if (typeof c.text === 'string') return c.text
    if (typeof c.body === 'string') return c.body
    if (typeof c.markdown === 'string') return c.markdown
  }
  return ''
}

/**
 * Book viewer — reads a channel's messages as ordered pages.
 *
 * This is the Works Engine reader on the Messages primitive: a "book" is a
 * channel, its "pages" are messages (ordered by metadata.order, else by time),
 * and hybrid media (image/video attachments + illustration) renders inline.
 * Reusable for the public endeavor/subdomain reader (e.g. WDEG).
 */
export function BookViewer({ channelSlug, spaceId, title }: BookViewerProps) {
  const [pages, setPages] = useState<BookPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ReadMode>('paged')
  const [index, setIndex] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    if (!channelSlug || !spaceId) {
      setPages([])
      setLoading(false)
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `${SERVER_URL}/api/messages?where[space][equals]=${spaceId}` +
          `&where[channel][equals]=${encodeURIComponent(channelSlug)}` +
          `&sort=createdAt&limit=500&depth=1`,
        { signal: ctrl.signal, credentials: 'include' },
      )
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      const data = await res.json()
      const docs: Array<Record<string, unknown>> = Array.isArray(data?.docs) ? data.docs : []

      const built: BookPage[] = docs.map((msg, i) => {
        const meta = (msg.metadata && typeof msg.metadata === 'object'
          ? (msg.metadata as Record<string, unknown>)
          : {}) as Record<string, unknown>
        const images: BookPage['images'] = []
        const videos: BookPage['videos'] = []
        if (Array.isArray(msg.attachments)) {
          for (const att of msg.attachments as Array<Record<string, unknown>>) {
            const media = att.media as Record<string, unknown> | null
            if (!media || typeof media !== 'object') continue
            const url = (media.url as string) || `/api/media/file/${media.filename as string}`
            const mime = (media.mimeType as string) || ''
            if (mime.startsWith('image/')) {
              images.push({ url, alt: (att.caption as string) || (media.alt as string) || undefined })
            } else if (mime.startsWith('video/')) {
              videos.push({ url, mime })
            }
          }
        }
        return {
          id: String(msg.id),
          order: typeof meta.order === 'number' ? (meta.order as number) : i,
          title: (meta.pageTitle as string) || (meta.title as string) || undefined,
          markdown: extractText(msg.content),
          images,
          videos,
        }
      })

      built.sort((a, b) => a.order - b.order)
      setPages(built)
      setIndex(0)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [channelSlug, spaceId])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(pages.length - 1, Math.max(0, i + delta))),
    [pages.length],
  )

  // Keyboard nav in paged mode
  useEffect(() => {
    if (mode !== 'paged') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, go])

  const renderPage = (p: BookPage) => (
    <article className="prose prose-sm dark:prose-invert mx-auto max-w-2xl">
      {p.title && <h2 className="!mb-4">{p.title}</h2>}
      {p.images.map((img, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={img.url} alt={img.alt || ''} loading="lazy" className="mx-auto my-4 rounded-lg" />
      ))}
      {p.videos.map((v, i) => (
        <video key={i} src={v.url} controls className="mx-auto my-4 w-full rounded-lg" />
      ))}
      {p.markdown && <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.markdown}</ReactMarkdown>}
    </article>
  )

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 size={20} className="animate-spin" />
        <span className="ml-2 text-xs">Loading…</span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-xs text-destructive">{error}</p>
        <button onClick={load} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">
          Retry
        </button>
      </div>
    )
  }
  if (pages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <BookOpen size={32} className="mb-3 text-muted-foreground/40" />
        <h3 className="text-sm font-semibold">Nothing to read yet</h3>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Pages are the channel&apos;s messages. Post content to this channel to fill the book.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="truncate text-sm font-semibold">{title || 'Book'}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode('paged')}
            title="Paged"
            className={`flex h-7 w-7 items-center justify-center rounded ${mode === 'paged' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
          >
            <Columns size={15} />
          </button>
          <button
            onClick={() => setMode('scroll')}
            title="Continuous"
            className={`flex h-7 w-7 items-center justify-center rounded ${mode === 'scroll' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
          >
            <ScrollText size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      {mode === 'scroll' ? (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="space-y-10">
            {pages.map((p) => (
              <div key={p.id} className="border-b border-border/40 pb-10 last:border-0">
                {renderPage(p)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-6">{renderPage(pages[index])}</div>
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <button
              onClick={() => go(-1)}
              disabled={index === 0}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs disabled:opacity-30 hover:bg-muted"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-xs text-muted-foreground">
              {index + 1} / {pages.length}
            </span>
            <button
              onClick={() => go(1)}
              disabled={index === pages.length - 1}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs disabled:opacity-30 hover:bg-muted"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
