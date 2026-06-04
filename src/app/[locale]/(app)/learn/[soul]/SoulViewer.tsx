'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SoulManifest } from '@/souls'

/* ─── Answer53 LCARS palette (muted) ─────────────────────────────────── */
const LCARS = {
  amber: '#C4956A',
  lavender: '#9B8EC4',
  peach: '#C48A7A',
  teal: '#7AB5B0',
  blue: '#7A9EC4',
  mauve: '#A8879E',
  bg: '#0A0810',
  text: '#F5F2F0',
  textMuted: 'rgba(245,242,240,0.45)',
} as const

// Answer53 deep-space layered background
const DEEP_SPACE: React.CSSProperties = {
  background: `
    radial-gradient(ellipse 80% 50% at 20% 40%, rgba(155,142,196,0.05), transparent),
    radial-gradient(ellipse 60% 40% at 80% 60%, rgba(122,181,176,0.05), transparent),
    radial-gradient(ellipse 50% 30% at 50% 20%, rgba(196,149,106,0.04), transparent),
    ${LCARS.bg}`,
  color: LCARS.text,
}

const TIER_COLOR: Record<string, string> = {
  index: LCARS.blue,
  status: LCARS.teal,
  legal: LCARS.amber,
  evidence: LCARS.blue,
  forensics: LCARS.lavender,
  action: LCARS.peach,
  contacts: LCARS.mauve,
  historical: LCARS.textMuted,
  chapter: LCARS.lavender,
}

const BADGE_COLOR: Record<string, string> = {
  red: '#cc6666',
  green: LCARS.teal,
  blue: LCARS.blue,
  amber: LCARS.amber,
  orange: LCARS.peach,
  purple: LCARS.mauve,
  lavender: LCARS.lavender,
}

interface Props {
  soul: SoulManifest
  activeDocId: string
  allContents: Record<string, string>
}

// Props passed to ReactMarkdown custom element renderers.
type MdProps = {
  children?: React.ReactNode
  href?: string
  className?: string
}

export function SoulViewer({ soul, activeDocId, allContents }: Props) {
  const [currentDocId, setCurrentDocId] = useState(activeDocId)
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [reading, setReading] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const apply = () => setSidebarOpen(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const isMobile = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

  const docIdByFilename = useMemo(() => {
    const map: Record<string, string> = {}
    for (const d of soul.docs) map[d.filename.toLowerCase()] = d.id
    return map
  }, [soul.docs])

  const goToDoc = useCallback((id: string) => {
    setCurrentDocId(id)
    mainRef.current?.scrollTo({ top: 0 })
  }, [])

  const selectDoc = useCallback(
    (id: string) => {
      goToDoc(id)
      if (isMobile()) setSidebarOpen(false)
    },
    [goToDoc],
  )

  const currentDoc = soul.docs.find((d) => d.id === currentDocId) ?? soul.docs[0]
  const rawContent = allContents[currentDocId] ?? ''

  // Sequential prev/next within the doc order — auto-hidden at the ends.
  const docIndex = soul.docs.findIndex((d) => d.id === currentDocId)
  const prevDoc = docIndex > 0 ? soul.docs[docIndex - 1] : null
  const nextDoc =
    docIndex >= 0 && docIndex < soul.docs.length - 1 ? soul.docs[docIndex + 1] : null

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

  /* Answer53 markdown component treatment (mirrors ChapterContent) */
  const mdComponents = useMemo(
    () => ({
      h1: ({ children }: MdProps) => (
        <h1 className="font-orbitron text-3xl font-bold tracking-wide mb-5 pb-3" style={{ color: LCARS.text, borderBottom: `2px solid ${LCARS.amber}44` }}>
          {children}
        </h1>
      ),
      h2: ({ children }: MdProps) => (
        <h2 className="font-orbitron text-xl font-bold mt-10 mb-4 tracking-wide" style={{ color: LCARS.amber }}>
          {children}
        </h2>
      ),
      h3: ({ children }: MdProps) => (
        <h3 className="font-orbitron text-lg font-bold mt-7 mb-3 tracking-wide" style={{ color: LCARS.lavender }}>
          {children}
        </h3>
      ),
      h4: ({ children }: MdProps) => (
        <h4 className="font-orbitron text-base font-bold mt-5 mb-2" style={{ color: LCARS.teal }}>
          {children}
        </h4>
      ),
      p: ({ children }: MdProps) => (
        <p className="font-rajdhani leading-relaxed text-[1.05rem] mb-5" style={{ color: 'rgba(245,242,240,0.9)' }}>
          {children}
        </p>
      ),
      strong: ({ children }: MdProps) => <strong className="font-bold" style={{ color: LCARS.amber }}>{children}</strong>,
      em: ({ children }: MdProps) => <em className="italic" style={{ color: LCARS.lavender }}>{children}</em>,
      ul: ({ children }: MdProps) => <ul className="list-disc list-outside ml-5 space-y-1.5 mb-5 font-rajdhani text-[1.05rem]" style={{ color: 'rgba(245,242,240,0.9)' }}>{children}</ul>,
      ol: ({ children }: MdProps) => <ol className="list-decimal list-outside ml-5 space-y-1.5 mb-5 font-rajdhani text-[1.05rem]" style={{ color: 'rgba(245,242,240,0.9)' }}>{children}</ol>,
      li: ({ children }: MdProps) => <li className="leading-relaxed">{children}</li>,
      blockquote: ({ children }: MdProps) => (
        <blockquote className="pl-4 my-5 italic" style={{ borderLeft: `4px solid ${LCARS.amber}80`, color: 'rgba(245,242,240,0.7)' }}>
          {children}
        </blockquote>
      ),
      table: ({ children }: MdProps) => (
        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse font-rajdhani text-sm" style={{ color: 'rgba(245,242,240,0.9)' }}>{children}</table>
        </div>
      ),
      thead: ({ children }: MdProps) => <thead style={{ borderBottom: `2px solid ${LCARS.amber}4d` }}>{children}</thead>,
      th: ({ children }: MdProps) => <th className="text-left px-3 py-2 font-orbitron text-xs tracking-wide" style={{ color: LCARS.amber }}>{children}</th>,
      td: ({ children }: MdProps) => <td className="px-3 py-2 align-top" style={{ borderBottom: `1px solid ${LCARS.amber}1a` }}>{children}</td>,
      hr: () => <hr className="my-7" style={{ borderTop: `1px solid ${LCARS.amber}33` }} />,
      code: ({ children, className }: MdProps) => {
        const isBlock = className?.includes('language-')
        if (isBlock) {
          return (
            <pre className="rounded p-4 overflow-x-auto mb-5" style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${LCARS.amber}33` }}>
              <code className="font-mono text-sm" style={{ color: LCARS.teal }}>{children}</code>
            </pre>
          )
        }
        return <code className="px-1.5 py-0.5 rounded font-mono text-sm" style={{ background: 'rgba(0,0,0,0.3)', color: LCARS.teal }}>{children}</code>
      },
      pre: ({ children }: MdProps) => <>{children}</>,
      a: ({ href, children }: MdProps) => {
        const isExternal = !!href && /^https?:\/\//i.test(href)
        if (isExternal) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 transition-colors" style={{ color: LCARS.teal }}>
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
                onClick={(e) => { e.preventDefault(); goToDoc(targetId) }}
                className="cursor-pointer underline underline-offset-2 transition-colors"
                style={{ color: LCARS.teal }}
              >
                {children}
              </a>
            )
          }
          if (clean.toLowerCase().endsWith('.md')) {
            return <span style={{ color: LCARS.textMuted }}>{children}</span>
          }
        }
        return <a href={href} style={{ color: LCARS.teal }}>{children}</a>
      },
    }),
    [docIdByFilename, goToDoc],
  )

  return (
    <div className="flex min-h-screen flex-col" style={DEEP_SPACE}>
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 backdrop-blur-sm print:hidden"
        style={{ background: `${LCARS.bg}e6`, borderBottom: `1px solid ${LCARS.amber}33` }}
      >
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
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
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <Link
            href="/learn/works"
            className="hidden sm:flex items-center gap-1.5 font-orbitron text-[10px] uppercase tracking-[0.25em] transition-opacity hover:opacity-80"
            style={{ color: LCARS.amber }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            The Library
          </Link>
          <span className="hidden sm:inline" style={{ color: LCARS.textMuted }}>/</span>
          <span className="truncate font-orbitron text-sm font-bold tracking-wide">{soul.title}</span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleReadAloud}
              className="flex h-9 items-center gap-1.5 rounded px-3 font-orbitron text-[11px] tracking-wide transition-colors"
              style={{
                background: reading ? `${LCARS.teal}26` : 'transparent',
                border: `1px solid ${reading ? LCARS.teal : LCARS.amber}40`,
                color: reading ? LCARS.teal : 'rgba(245,242,240,0.55)',
              }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              <span className="hidden sm:inline">{reading ? 'STOP' : 'READ'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="hidden sm:flex h-9 items-center gap-1.5 rounded px-3 font-orbitron text-[11px] tracking-wide transition-opacity hover:opacity-80"
              style={{ border: `1px solid ${LCARS.lavender}40`, color: LCARS.lavender }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              PRINT
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div className="fixed inset-0 top-14 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
        )}

        {/* ── Sidebar / drawer ─────────────────────────────────────── */}
        <aside
          className={`fixed top-14 bottom-0 left-0 z-50 flex w-[85vw] max-w-[20rem] flex-col transition-transform duration-300 ease-out
            md:static md:top-0 md:z-auto md:w-72 md:max-w-none md:transition-none print:hidden
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:hidden'}`}
          style={{ background: `${LCARS.bg}f2`, borderRight: `1px solid ${LCARS.amber}26` }}
        >
          {/* Soul header — LCARS panel */}
          <div className="p-3">
            <div
              className="rounded p-4"
              style={{
                background: `linear-gradient(135deg, rgba(10,8,16,0.9), ${soulAccent}14)`,
                border: `2px solid ${soulAccent}`,
                boxShadow: `inset 0 1px 0 ${soulAccent}33, 0 0 20px ${soulAccent}1a`,
              }}
            >
              <h2 className="font-orbitron text-sm font-bold leading-tight tracking-wide">{soul.title}</h2>
              <p className="mt-1 font-rajdhani text-xs leading-snug" style={{ color: 'rgba(245,242,240,0.55)' }}>
                {soul.subtitle}
              </p>
              <span
                className="mt-2 inline-block rounded-full px-2 py-0.5 font-orbitron text-[9px] font-bold uppercase tracking-wider"
                style={{ background: `${soulAccent}26`, color: soulAccent, border: `1px solid ${soulAccent}66` }}
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
              className="w-full rounded-full px-4 py-2 font-rajdhani text-sm outline-none"
              style={{ background: LCARS.bg, border: `1px solid ${LCARS.blue}44`, color: LCARS.text }}
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
                  className="mb-1 flex w-full gap-2.5 rounded-r-xl rounded-l p-2.5 pl-2 text-left transition-colors"
                  style={{ background: isActive ? `${accent}1f` : 'transparent' }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = `${accent}12` }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <span className="mt-0.5 w-1.5 shrink-0 self-stretch rounded-full" style={{ background: accent, opacity: isActive ? 1 : 0.5 }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-orbitron text-[11px] font-bold tracking-wide" style={{ color: isActive ? accent : LCARS.text }}>
                        {doc.title}
                      </span>
                      {doc.badge && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 font-orbitron text-[8px] font-bold"
                          style={{ background: `${BADGE_COLOR[doc.badgeColor ?? 'blue'] ?? LCARS.blue}26`, color: BADGE_COLOR[doc.badgeColor ?? 'blue'] ?? LCARS.blue }}
                        >
                          {doc.badge}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block font-rajdhani text-[11px] leading-snug" style={{ color: 'rgba(245,242,240,0.45)' }}>
                      {doc.description}
                    </span>
                    <span className="mt-1 block font-orbitron text-[8px] uppercase tracking-[0.2em]" style={{ color: `${accent}cc` }}>
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
              <p className="mb-2 font-orbitron text-[9px] font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(245,242,240,0.4)' }}>
                External Evidence
              </p>
              {soul.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded py-1 font-rajdhani text-xs transition-opacity hover:opacity-80"
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
            {/* Document header — Answer53 elbow */}
            <div className="mb-8 print:mb-3">
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="rounded-full px-3 py-1 font-orbitron text-[11px] font-bold uppercase tracking-[0.2em]"
                  style={{ background: `${TIER_COLOR[currentDoc.tier] ?? LCARS.textMuted}26`, color: TIER_COLOR[currentDoc.tier] ?? LCARS.textMuted }}
                >
                  {currentDoc.tier}
                </span>
                <span className="h-1 flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${LCARS.amber}, ${LCARS.lavender}, transparent)` }} />
                {currentDoc.badge && (
                  <span
                    className="rounded-full px-2 py-0.5 font-orbitron text-[9px] font-bold"
                    style={{ background: `${BADGE_COLOR[currentDoc.badgeColor ?? 'blue'] ?? LCARS.blue}26`, color: BADGE_COLOR[currentDoc.badgeColor ?? 'blue'] ?? LCARS.blue }}
                  >
                    {currentDoc.badge}
                  </span>
                )}
              </div>
              <p className="font-orbitron text-[10px] uppercase tracking-[0.25em]" style={{ color: LCARS.textMuted }}>
                {currentDoc.date} · {currentDoc.title}
              </p>
            </div>

            {/* Markdown */}
            <article>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {rawContent}
              </ReactMarkdown>
            </article>

            {/* Prev / Next — sequential navigation, auto-hidden at the ends */}
            {(prevDoc || nextDoc) && (
              <nav className="mt-14 flex items-stretch justify-between gap-3 print:hidden">
                {prevDoc ? (
                  <button
                    onClick={() => goToDoc(prevDoc.id)}
                    className="group flex max-w-[48%] flex-col items-start gap-1 rounded-lg px-4 py-3 text-left transition-colors"
                    style={{ border: `1px solid ${LCARS.amber}33`, background: `${LCARS.amber}0a` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = `${LCARS.amber}1a` }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = `${LCARS.amber}0a` }}
                  >
                    <span className="font-orbitron text-[9px] uppercase tracking-[0.25em]" style={{ color: LCARS.textMuted }}>
                      ← Previous
                    </span>
                    <span className="font-orbitron text-sm font-bold leading-tight" style={{ color: LCARS.amber }}>
                      {prevDoc.title}
                    </span>
                  </button>
                ) : (
                  <span />
                )}
                {nextDoc ? (
                  <button
                    onClick={() => goToDoc(nextDoc.id)}
                    className="group flex max-w-[48%] flex-col items-end gap-1 rounded-lg px-4 py-3 text-right transition-colors"
                    style={{ border: `1px solid ${LCARS.lavender}33`, background: `${LCARS.lavender}0a` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = `${LCARS.lavender}1a` }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = `${LCARS.lavender}0a` }}
                  >
                    <span className="font-orbitron text-[9px] uppercase tracking-[0.25em]" style={{ color: LCARS.textMuted }}>
                      Next →
                    </span>
                    <span className="font-orbitron text-sm font-bold leading-tight" style={{ color: LCARS.lavender }}>
                      {nextDoc.title}
                    </span>
                  </button>
                ) : (
                  <span />
                )}
              </nav>
            )}

            {/* Bottom decoration + STATION */}
            <div className="mt-16 pt-8 print:hidden" style={{ borderTop: `1px solid ${LCARS.amber}33` }}>
              <div className="flex gap-2">
                <div className="h-8 w-1 rounded-sm" style={{ background: LCARS.teal }} />
                <div className="h-8 w-1 rounded-sm" style={{ background: LCARS.lavender }} />
                <div className="h-8 w-1 rounded-sm" style={{ background: LCARS.amber }} />
              </div>
              <p className="mt-6 text-center font-orbitron text-[10px] uppercase tracking-[0.3em]" style={{ color: `${LCARS.amber}99` }}>
                {soul.title} · STATION ⚓
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
