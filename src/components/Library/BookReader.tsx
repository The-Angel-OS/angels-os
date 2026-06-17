'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, BookOpen, ScrollText, Columns, Loader2 } from 'lucide-react'

/**
 * BookReader — the Angel OS Library's generic, source-agnostic page reader.
 *
 * Renders an ordered set of pages (image + optional caption / markdown) as a
 * paged, page-flip "illustrated primer" or a continuous scroll. The manifest can
 * come from anywhere — today a static public/library/<slug>/manifest.json, later
 * the message store — the reader doesn't care. This is the primer foundation:
 * per-page illustration is already first-class (each page IS an image).
 */
export interface BookPage {
  order: number
  image?: string
  caption?: string
  title?: string
  markdown?: string
}

export interface BookLanguage {
  code: string
  name: string
  rtl?: boolean
}

export interface BookManifest {
  slug: string
  title: string
  subtitle?: string | null
  pageCount: number
  pages: BookPage[]
  languages?: BookLanguage[]
  defaultLanguage?: string
  /** Base URL for per-language text JSONs: `${textBase}/${lang}.json` */
  textBase?: string
}

type Mode = 'paged' | 'scroll'

export function BookReader({
  manifest: initialManifest,
  manifestUrl,
  title,
  initialIndex = 0,
  basePath,
  pageSlugs,
  inlineTexts,
}: {
  manifest?: BookManifest
  /** Static URL to a manifest.json (CDN-served, Vercel-safe). */
  manifestUrl?: string
  /** Fallback title shown while the manifest loads. */
  title?: string
  /** Page to open on first render (server-resolved from the URL). */
  initialIndex?: number
  /** Route base for deep-link URL sync, e.g. "/learn/wdeg". */
  basePath?: string
  /** Per-page URL slugs ("<n>-<name>"), index-aligned with pages. */
  pageSlugs?: string[]
  /**
   * DB-backed per-language text: { lang: { "<pageIndex>": text } }. When given,
   * text comes from here (no file fetch) — the portable, filesystem-free path.
   */
  inlineTexts?: Record<string, Record<string, string>>
}) {
  const [manifest, setManifest] = useState<BookManifest | null>(initialManifest ?? null)
  const [loading, setLoading] = useState(!initialManifest && !!manifestUrl)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('paged')
  const [index, setIndex] = useState(initialIndex)
  const [dir, setDir] = useState(1)
  const [lang, setLang] = useState<string>('en')
  const [texts, setTexts] = useState<Record<string, string>>({})
  const mainRef = useRef<HTMLDivElement>(null)

  const languages = manifest?.languages ?? []
  const currentLang = languages.find((l) => l.code === lang)
  const isRtl = !!currentLang?.rtl

  useEffect(() => {
    if (manifest || !manifestUrl) return
    let cancelled = false
    setLoading(true)
    fetch(manifestUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load book (${r.status})`)
        return r.json()
      })
      .then((m: BookManifest) => {
        if (!cancelled) setManifest(m)
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [manifest, manifestUrl])

  const pages = useMemo(() => manifest?.pages ?? [], [manifest])

  // Deep-link URL sync: reflect the current page in the address bar so every
  // page is shareable/bookmarkable, without a navigation/reload. The server
  // render at each URL is what crawlers + unfurlers see; this keeps an in-session
  // flip's URL honest. Skip the first run so the entry URL isn't rewritten.
  const didMountUrl = useRef(false)
  useEffect(() => {
    if (!basePath || !pageSlugs?.length) return
    if (!didMountUrl.current) {
      didMountUrl.current = true
      return
    }
    const slug = pageSlugs[index]
    if (slug && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${basePath}/${slug}`)
    }
  }, [index, basePath, pageSlugs])

  // Pick initial language: manifest default, or the browser's if available.
  useEffect(() => {
    if (!manifest?.languages?.length) return
    const codes = manifest.languages.map((l) => l.code)
    const browser = typeof navigator !== 'undefined' ? navigator.language?.slice(0, 2) : ''
    const initial =
      (browser && codes.includes(browser) && browser) ||
      manifest.defaultLanguage ||
      codes[0]
    setLang(initial)
  }, [manifest])

  // Load the text for the current language. Prefer DB-backed inlineTexts (no
  // filesystem); fall back to fetching the per-language JSON if not provided.
  useEffect(() => {
    if (!lang) return
    if (inlineTexts) {
      setTexts(inlineTexts[lang] ?? {})
      return
    }
    if (!manifest?.textBase) return
    let cancelled = false
    fetch(`${manifest.textBase}/${lang}.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((t: Record<string, string>) => {
        if (!cancelled) setTexts(t)
      })
      .catch(() => {
        if (!cancelled) setTexts({})
      })
    return () => {
      cancelled = true
    }
  }, [manifest, lang, inlineTexts])

  const go = useCallback(
    (delta: number) => {
      setDir(delta)
      setIndex((i) => Math.min(pages.length - 1, Math.max(0, i + delta)))
    },
    [pages.length],
  )

  // Keyboard nav (paged)
  useEffect(() => {
    if (mode !== 'paged') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, go])

  // Preload neighbors for snappy flips
  useEffect(() => {
    if (mode !== 'paged') return
    ;[index + 1, index - 1].forEach((i) => {
      const src = pages[i]?.image
      if (src) {
        const img = new Image()
        img.src = src
      }
    })
  }, [index, mode, pages])

  const page = pages[index]
  const headerTitle = manifest?.title ?? title ?? 'Reading…'

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0810] text-[#C4956A]">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2 text-sm">{title ? `Opening ${title}…` : 'Opening book…'}</span>
      </div>
    )
  }
  if (error || !manifest) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0810] p-8 text-center text-[#f5f2f0]">
        <BookOpen className="h-8 w-8 opacity-40" />
        <p className="text-sm text-[#f5f2f0aa]">{error || 'This book could not be loaded.'}</p>
        <Link href="/learn/works" className="text-xs underline" style={{ color: '#C4956A' }}>
          ← Back to the Library
        </Link>
      </div>
    )
  }

  const renderText = (order: number) => {
    const raw = texts[String(order)]
    if (!raw || !raw.trim()) return null
    const paras = raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
    // Our books open each page with a title line, then the body. Style the title
    // as a heading, drop-cap the first body paragraph, and set a readable measure.
    const [titleLine, ...body] = paras
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className={`mx-auto mt-6 max-w-[34rem] ${isRtl ? 'text-right' : 'text-left'}`}
        style={{ fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif' }}
      >
        {titleLine && (
          <h2 className="mb-5 text-[1.55rem] font-semibold leading-tight tracking-tight text-[#f5f2f0]">
            {titleLine}
          </h2>
        )}
        {body.map((p, i) => (
          <p
            key={i}
            className={`mb-[1.15rem] text-[1.0625rem] leading-[1.75] text-[#f5f2f0d9] ${
              i === 0 && !isRtl
                ? 'first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:font-semibold first-letter:text-[3.1rem] first-letter:leading-[0.8] first-letter:text-[#C4956A]'
                : ''
            }`}
          >
            {p}
          </p>
        ))}
      </div>
    )
  }

  // Centered pager — rendered above and below the page body.
  const pager = (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={() => go(-1)}
        disabled={index === 0}
        className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs transition-opacity disabled:opacity-30"
        style={{ border: '1px solid #C4956A40', color: '#C4956A' }}
      >
        <ChevronLeft className="h-4 w-4" /> Prev
      </button>
      <span className="min-w-[4.5rem] text-center font-mono text-xs tracking-widest text-[#f5f2f088]">
        {index + 1} / {pages.length}
      </span>
      <button
        onClick={() => go(1)}
        disabled={index === pages.length - 1}
        className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs transition-opacity disabled:opacity-30"
        style={{ border: '1px solid #C4956A40', color: '#C4956A' }}
      >
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0810] text-[#f5f2f0]">
      {/* Top bar */}
      <div
        className="sticky top-0 z-30 flex h-14 items-center gap-3 px-4 backdrop-blur-sm"
        style={{ background: '#0a0810e6', borderBottom: '1px solid #C4956A33' }}
      >
        <Link
          href="/learn/works"
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest transition-opacity hover:opacity-80"
          style={{ color: '#C4956A' }}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Library
        </Link>
        <span className="truncate text-sm font-bold tracking-wide">{headerTitle}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {languages.length > 1 && (
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              aria-label="Language"
              className="h-8 rounded-md bg-transparent px-2 text-xs outline-none"
              style={{ border: '1px solid #C4956A40', color: '#C4956A' }}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code} style={{ color: '#111' }}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setMode('paged')}
            title="Page view"
            className="flex h-8 w-8 items-center justify-center rounded"
            style={{ background: mode === 'paged' ? '#C4956A26' : 'transparent', color: mode === 'paged' ? '#C4956A' : '#f5f2f088' }}
          >
            <Columns className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMode('scroll')}
            title="Scroll view"
            className="flex h-8 w-8 items-center justify-center rounded"
            style={{ background: mode === 'scroll' ? '#C4956A26' : 'transparent', color: mode === 'scroll' ? '#C4956A' : '#f5f2f088' }}
          >
            <ScrollText className="h-4 w-4" />
          </button>
        </div>
      </div>

      {pages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <BookOpen className="h-8 w-8 opacity-40" />
          <p className="text-sm text-[#f5f2f0aa]">This book has no pages yet.</p>
        </div>
      ) : mode === 'scroll' ? (
        // ── Continuous scroll ──
        <div className="flex-1 overflow-y-auto px-3 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {pages.map((p) => (
              <figure key={p.order}>
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt={p.caption || `Page ${p.order}`}
                    loading="lazy"
                    className="w-full rounded-lg shadow-lg shadow-black/40"
                  />
                )}
                {p.caption && (
                  <figcaption className="mt-2 text-center text-xs italic text-[#f5f2f066]">
                    {p.caption}
                  </figcaption>
                )}
                {renderText(p.order)}
              </figure>
            ))}
          </div>
        </div>
      ) : (
        // ── Paged page-flip ──
        <div ref={mainRef} className="flex flex-1 flex-col overflow-hidden px-3 py-4">
          {/* Top pager */}
          <div className="mb-3 flex justify-center">{pager}</div>

          <div className="flex-1 overflow-y-auto">
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.div
                key={page.order}
                custom={dir}
                initial={{ opacity: 0, x: dir * 60, rotateY: dir * 8 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                exit={{ opacity: 0, x: dir * -60, rotateY: dir * -8 }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                className="mx-auto flex w-full max-w-3xl flex-col items-center pb-4"
              >
                {page.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page.image}
                    alt={page.caption || `Page ${page.order}`}
                    className="max-h-[62vh] w-auto rounded-lg shadow-2xl shadow-black/50"
                    draggable={false}
                  />
                )}
                {page.caption && (
                  <p className="mt-3 text-center text-xs italic text-[#f5f2f066]">{page.caption}</p>
                )}
                {renderText(page.order)}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom pager (centered) */}
          <div className="mt-3 flex justify-center">{pager}</div>

          {/* Progress rail */}
          <div className="mx-auto mt-3 h-1 w-full max-w-3xl overflow-hidden rounded-full" style={{ background: '#ffffff14' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${((index + 1) / pages.length) * 100}%`, background: 'linear-gradient(to right, #C4956A, #9B8EC4)' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
