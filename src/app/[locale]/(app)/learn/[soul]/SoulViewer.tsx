'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SoulManifest } from '@/souls'

/* ─── LCARS palette (matches /learn) ─────────────────────────────────── */
const LCARS = {
  amber: '#f5a623',
  orange: '#ff9c00',
  peach: '#ffaa6b',
  lavender: '#cc99cc',
  blue: '#99ccff',
  blueDeep: '#4488cc',
  purple: '#9977aa',
  green: '#22cc88',
  red: '#cc4444',
  darkBg: '#0a0a14',
  panelBg: '#0f0f1e',
  cardBg: '#111122',
  textMuted: '#7788aa',
} as const

// tier -> LCARS accent
const TIER_COLOR: Record<string, string> = {
  index: LCARS.blue,
  status: LCARS.green,
  legal: LCARS.amber,
  evidence: LCARS.blue,
  forensics: LCARS.lavender,
  action: LCARS.peach,
  contacts: LCARS.purple,
  historical: LCARS.textMuted,
}

// badge color name -> LCARS accent
const BADGE_COLOR: Record<string, string> = {
  red: LCARS.red,
  green: LCARS.green,
  blue: LCARS.blue,
  amber: LCARS.amber,
  orange: LCARS.orange,
  purple: LCARS.purple,
  lavender: LCARS.lavender,
}

interface Props {
  soul: SoulManifest
  activeDocId: string
  allContents: Record<string, string>
}

export function SoulViewer({ soul, activeDocId, allContents }: Props) {
  const [currentDocId, setCurrentDocId] = useState(activeDocId)
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [reading, setReading] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const mainRef = useRef<HTMLElement>(null)

  // Open the rail by default on desktop, closed (drawer) on mobile.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const apply = () => setSidebarOpen(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const isMobile = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

  // filename -> doc id, so relative markdown links switch docs in-place.
  const docIdByFilename = useMemo(() => {
    const map: Record<string, string> = {}
    for (const d of soul.docs) map[d.filename.toLowerCase()] = d.id
    return map
  }, [soul.docs])

  const goToDoc = useCallback((id: string) => {
    setCurrentDocId(id)
    mainRef.current?.scrollTo({ top: 0 })
  }, [])

  // From the rail: navigate + auto-close the drawer on mobile.
  const selectDoc = useCallback(
    (id: string) => {
      goToDoc(id)
      if (isMobile()) setSidebarOpen(false)
    },
    [goToDoc],
  )

  const currentDoc = soul.docs.find((d) => d.id === currentDocId) ?? soul.docs[0]
  const rawContent = allContents[currentDocId] ?? ''
  const content = rawContent

  const toggleReadAloud = useCallback(() => {
    if (reading) {
      window.speechSynthesis.cancel()
      setReading(false)
      return
    }
    const text = rawContent.replace(/#{1,6}\s/g, '').replace(/[*_`>\[\]]/g, '').trim()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.95
    utt.onend = () => setReading(false)
    utt.onerror = () => setReading(false)
    utteranceRef.current = utt
    window.speechSynthesis.speak(utt)
    setReading(true)
  }, [reading, rawContent])

  const handlePrint = () => window.print()

  const filteredDocs = search.trim()
    ? soul.docs.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.description.toLowerCase().includes(search.toLowerCase()),
      )
    : soul.docs

  const soulAccent = BADGE_COLOR[soul.statusColor] ?? LCARS.amber

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: LCARS.darkBg, color: '#e8ecf8' }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 backdrop-blur-sm print:hidden"
        style={{ background: `${LCARS.panelBg}f0`, borderBottom: `1px solid ${LCARS.amber}33` }}
      >
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          {/* Hamburger — always visible, clearly a button */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
            style={{
              background: sidebarOpen ? `${LCARS.amber}26` : `${LCARS.amber}14`,
              border: `1px solid ${LCARS.amber}55`,
              color: LCARS.amber,
            }}
            aria-label={sidebarOpen ? 'Close document index' : 'Open document index'}
            aria-expanded={sidebarOpen}
          >
            <svg className="h-4.5 w-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <Link
            href="/learn"
            className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest transition-colors hover:opacity-80"
            style={{ color: LCARS.amber }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Soul Viewer
          </Link>
          <span className="hidden sm:inline" style={{ color: `${LCARS.textMuted}88` }}>
            /
          </span>
          <span className="truncate text-sm font-semibold tracking-tight">{soul.title}</span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleReadAloud}
              className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors"
              style={{
                background: reading ? `${LCARS.green}22` : `${LCARS.blue}12`,
                border: `1px solid ${reading ? LCARS.green : LCARS.blue}55`,
                color: reading ? LCARS.green : LCARS.blue,
              }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072" />
              </svg>
              <span className="hidden sm:inline">{reading ? 'Stop' : 'Read Aloud'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="hidden sm:flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors hover:opacity-80"
              style={{ background: `${LCARS.lavender}12`, border: `1px solid ${LCARS.lavender}55`, color: LCARS.lavender }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-14 z-40 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        {/* ── Sidebar / drawer ─────────────────────────────────────── */}
        <aside
          className={`fixed top-14 bottom-0 left-0 z-50 flex w-[85vw] max-w-[20rem] flex-col transition-transform duration-300 ease-out
            md:static md:top-0 md:z-auto md:w-72 md:max-w-none md:transition-none print:hidden
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:hidden'}`}
          style={{ background: LCARS.panelBg, borderRight: `1px solid ${LCARS.amber}22` }}
        >
          {/* Soul header — LCARS elbow */}
          <div className="p-3">
            <div
              className="rounded-2xl rounded-tl-3xl p-4"
              style={{ background: `linear-gradient(135deg, ${soulAccent}1a, transparent)`, border: `1px solid ${soulAccent}40` }}
            >
              <h2 className="text-sm font-bold leading-tight">{soul.title}</h2>
              <p className="mt-0.5 text-xs leading-snug" style={{ color: LCARS.textMuted }}>
                {soul.subtitle}
              </p>
              <span
                className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: `${soulAccent}22`, color: soulAccent, border: `1px solid ${soulAccent}55` }}
              >
                {soul.status}
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 pb-2">
            <input
              type="search"
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full px-4 py-2 text-xs outline-none transition-colors focus:ring-1"
              style={{ background: LCARS.darkBg, border: `1px solid ${LCARS.blueDeep}44`, color: '#e8ecf8' }}
            />
          </div>

          {/* Doc list */}
          <nav className="flex-1 overflow-y-auto px-2 pb-2">
            {filteredDocs.map((doc) => {
              const isActive = doc.id === currentDocId
              const accent = TIER_COLOR[doc.tier] ?? LCARS.textMuted
              return (
                <button
                  key={doc.id}
                  onClick={() => selectDoc(doc.id)}
                  className="mb-1 flex w-full gap-2.5 rounded-xl rounded-l-2xl p-2.5 pl-2 text-left transition-colors"
                  style={{
                    background: isActive ? `${accent}1f` : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = `${accent}12` }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  {/* LCARS color rail */}
                  <span
                    className="mt-0.5 w-1.5 shrink-0 self-stretch rounded-full"
                    style={{ background: accent, opacity: isActive ? 1 : 0.5 }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold" style={{ color: isActive ? accent : '#e8ecf8' }}>
                        {doc.title}
                      </span>
                      {doc.badge && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                          style={{
                            background: `${BADGE_COLOR[doc.badgeColor ?? 'blue'] ?? LCARS.blue}22`,
                            color: BADGE_COLOR[doc.badgeColor ?? 'blue'] ?? LCARS.blue,
                          }}
                        >
                          {doc.badge}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug" style={{ color: LCARS.textMuted }}>
                      {doc.description}
                    </span>
                    <span className="mt-1 block font-mono text-[9px] uppercase tracking-wide" style={{ color: `${accent}cc` }}>
                      {doc.date} · {doc.tier}
                    </span>
                  </span>
                </button>
              )
            })}
          </nav>

          {/* External links */}
          {soul.links && soul.links.length > 0 && (
            <div className="px-3 py-3" style={{ borderTop: `1px solid ${LCARS.amber}1a` }}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: LCARS.textMuted }}>
                External Evidence
              </p>
              {soul.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded py-1 text-[11px] transition-colors hover:opacity-80"
                  style={{ color: LCARS.blue }}
                >
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </aside>

        {/* ── Main content ─────────────────────────────────────────── */}
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-10 print:py-4">
            {/* Document header — LCARS pill */}
            <div className="mb-7 flex flex-wrap items-center gap-2 print:mb-3">
              <span
                className="rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest"
                style={{
                  background: `${TIER_COLOR[currentDoc.tier] ?? LCARS.textMuted}1f`,
                  color: TIER_COLOR[currentDoc.tier] ?? LCARS.textMuted,
                }}
              >
                {currentDoc.tier}
              </span>
              <span className="font-mono text-xs" style={{ color: LCARS.textMuted }}>
                {currentDoc.date}
              </span>
              {currentDoc.badge && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    background: `${BADGE_COLOR[currentDoc.badgeColor ?? 'blue'] ?? LCARS.blue}22`,
                    color: BADGE_COLOR[currentDoc.badgeColor ?? 'blue'] ?? LCARS.blue,
                  }}
                >
                  {currentDoc.badge}
                </span>
              )}
            </div>

            {/* Markdown content */}
            <article
              className="prose prose-invert prose-sm max-w-none
                prose-headings:font-bold prose-headings:tracking-tight
                prose-h1:text-2xl prose-h1:mb-6 prose-h1:pb-4
                prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
                prose-h3:text-base prose-h3:mt-6 prose-h3:mb-3
                prose-p:leading-relaxed prose-p:text-sm
                prose-a:no-underline hover:prose-a:underline
                prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10
                prose-blockquote:rounded-r-lg prose-blockquote:py-0.5
                prose-table:text-xs prose-table:block prose-table:overflow-x-auto
                prose-strong:text-white
                prose-li:text-sm prose-li:leading-relaxed"
              style={
                {
                  // LCARS-tinted prose accents via CSS vars consumed below
                  ['--tw-prose-links' as string]: LCARS.amber,
                  ['--tw-prose-bullets' as string]: LCARS.lavender,
                  ['--tw-prose-quote-borders' as string]: LCARS.amber,
                  ['--tw-prose-hr' as string]: `${LCARS.amber}33`,
                  ['--tw-prose-th-borders' as string]: `${LCARS.blue}33`,
                  ['--tw-prose-td-borders' as string]: '#ffffff14',
                } as React.CSSProperties
              }
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children, ...props }) => (
                    <h1 style={{ borderBottom: `2px solid ${LCARS.amber}44` }} {...props}>
                      {children}
                    </h1>
                  ),
                  a: ({ href, children, ...props }) => {
                    const isExternal = !!href && /^https?:\/\//i.test(href)
                    if (isExternal) {
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                          {children}
                        </a>
                      )
                    }
                    if (href) {
                      const clean = decodeURIComponent(href.split('#')[0].replace(/^\.?\//, ''))
                      const targetId = docIdByFilename[clean.toLowerCase()]
                      if (targetId) {
                        return (
                          <a
                            href={`#${targetId}`}
                            onClick={(e) => {
                              e.preventDefault()
                              goToDoc(targetId)
                            }}
                            className="cursor-pointer"
                            {...props}
                          >
                            {children}
                          </a>
                        )
                      }
                      if (clean.toLowerCase().endsWith('.md')) {
                        return <span style={{ color: LCARS.textMuted }}>{children}</span>
                      }
                    }
                    return (
                      <a href={href} {...props}>
                        {children}
                      </a>
                    )
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </article>

            {/* STATION footer */}
            <div className="mt-16 pt-8 text-center print:hidden" style={{ borderTop: `1px solid ${LCARS.amber}1a` }}>
              <p className="font-mono text-xs" style={{ color: `${LCARS.textMuted}99` }}>
                {soul.title} · {currentDoc.title} · {currentDoc.date}
              </p>
              <p className="mt-2 text-xs font-bold tracking-[0.3em]" style={{ color: `${LCARS.amber}66` }}>
                STATION ⚓
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
