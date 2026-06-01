'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SoulManifest, SoulDoc } from '@/souls'

const TIER_COLORS: Record<string, string> = {
  index:     'text-primary',
  status:    'text-green-400',
  legal:     'text-amber-400',
  evidence:  'text-blue-400',
  forensics: 'text-cyan-400',
  action:    'text-rose-400',
  contacts:  'text-purple-400',
  historical:'text-muted-foreground',
}

const BADGE_COLORS: Record<string, string> = {
  red:    'bg-red-500/15 text-red-400 border-red-500/30',
  green:  'bg-green-500/15 text-green-400 border-green-500/30',
  blue:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  amber:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
}

const STATUS_BORDER: Record<string, string> = {
  red:   'border-red-500/40 bg-red-500/5',
  green: 'border-green-500/40 bg-green-500/5',
  blue:  'border-blue-500/40 bg-blue-500/5',
  amber: 'border-amber-500/40 bg-amber-500/5',
}

interface Props {
  soul: SoulManifest
  activeDocId: string
  allContents: Record<string, string>
}

export function SoulViewer({ soul, activeDocId, allContents }: Props) {
  const [currentDocId, setCurrentDocId] = useState(activeDocId)
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [reading, setReading] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const mainRef = useRef<HTMLElement>(null)

  // filename -> doc id, so relative markdown links (e.g. "OWNERSHIP_PROVEN.md")
  // switch the active doc in-place instead of navigating to a 404.
  const docIdByFilename = useMemo(() => {
    const map: Record<string, string> = {}
    for (const d of soul.docs) map[d.filename.toLowerCase()] = d.id
    return map
  }, [soul.docs])

  const goToDoc = useCallback((id: string) => {
    setCurrentDocId(id)
    mainRef.current?.scrollTo({ top: 0 })
    // On mobile, close the drawer so the reader lands on the content.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [])

  // Collapse the sidebar by default on mobile (it's an overlay drawer there).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [])

  const currentDoc = soul.docs.find((d) => d.id === currentDocId) ?? soul.docs[0]
  const rawContent = allContents[currentDocId] ?? ''

  // Search highlight
  const content = search.trim()
    ? rawContent
    : rawContent

  // Read aloud
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

  // Print
  const handlePrint = () => window.print()

  const filteredDocs = search.trim()
    ? soul.docs.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.description.toLowerCase().includes(search.toLowerCase())
      )
    : soul.docs

  const statusBorder = STATUS_BORDER[soul.statusColor] ?? 'border-border bg-muted/10'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm print:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 hover:bg-muted transition-colors"
            aria-label={sidebarOpen ? 'Close document list' : 'Open document list'}
            aria-expanded={sidebarOpen}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-xs font-medium lg:hidden">Docs</span>
          </button>

          <Link href="/learn" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Soul Viewer
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-semibold truncate">{soul.title}</span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleReadAloud}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors ${
                reading
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072" />
              </svg>
              {reading ? 'Stop' : 'Read Aloud'}
            </button>
            <button
              onClick={handlePrint}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs hover:bg-muted transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 top-14 z-30 bg-black/50 lg:hidden"
            aria-hidden
          />
        )}

        {/* Sidebar — overlay drawer on mobile, inline column on desktop */}
        {sidebarOpen && (
          <aside className="fixed top-14 bottom-0 left-0 z-40 w-[85vw] max-w-xs shrink-0 border-r border-border bg-card flex flex-col print:hidden lg:static lg:top-0 lg:bottom-auto lg:z-auto lg:w-72 lg:max-w-none lg:bg-card/50">
            {/* Soul header */}
            <div className={`border-b border-border p-4 ${statusBorder}`}>
              <h2 className="text-sm font-bold leading-tight">{soul.title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{soul.subtitle}</p>
              <span className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${BADGE_COLORS[soul.statusColor] ?? 'border-border text-muted-foreground'}`}>
                {soul.status}
              </span>
            </div>

            {/* Search */}
            <div className="border-b border-border p-3">
              <input
                type="search"
                placeholder="Search documents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Doc list */}
            <nav className="flex-1 overflow-y-auto p-2">
              {filteredDocs.map((doc) => {
                const isActive = doc.id === currentDocId
                const tierColor = TIER_COLORS[doc.tier] ?? 'text-muted-foreground'
                return (
                  <button
                    key={doc.id}
                    onClick={() => goToDoc(doc.id)}
                    className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors mb-0.5 ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/60 text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium leading-snug">{doc.title}</span>
                      {doc.badge && (
                        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${BADGE_COLORS[doc.badgeColor ?? 'blue'] ?? ''}`}>
                          {doc.badge}
                        </span>
                      )}
                    </div>
                    <p className={`mt-0.5 text-[10px] leading-snug ${isActive ? 'text-primary/70' : 'text-muted-foreground'}`}>
                      {doc.description}
                    </p>
                    <p className={`mt-1 text-[9px] font-mono ${tierColor}`}>
                      {doc.date} · {doc.tier}
                    </p>
                  </button>
                )
              })}
            </nav>

            {/* External links */}
            {soul.links && soul.links.length > 0 && (
              <div className="border-t border-border p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  External Evidence
                </p>
                {soul.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded py-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
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
        )}

        {/* Main content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 print:py-4">
            {/* Document header */}
            <div className="mb-8 print:mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-mono uppercase ${TIER_COLORS[currentDoc.tier]}`}>
                  {currentDoc.tier}
                </span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-xs font-mono text-muted-foreground">{currentDoc.date}</span>
                {currentDoc.badge && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${BADGE_COLORS[currentDoc.badgeColor ?? 'blue'] ?? ''}`}>
                    {currentDoc.badge}
                  </span>
                )}
              </div>
            </div>

            {/* Markdown content */}
            <article className="prose prose-sm dark:prose-invert max-w-none
              prose-headings:font-bold prose-headings:tracking-tight
              prose-h1:text-2xl prose-h1:mb-6 prose-h1:border-b prose-h1:border-border prose-h1:pb-4
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-base prose-h3:mt-6 prose-h3:mb-3
              prose-p:leading-relaxed prose-p:text-sm
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:rounded prose-code:text-xs
              prose-pre:bg-muted prose-pre:border prose-pre:border-border
              prose-blockquote:border-primary/40 prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-0.5
              prose-table:text-xs prose-th:bg-muted/50 prose-th:font-semibold
              prose-td:text-muted-foreground
              prose-hr:border-border prose-hr:my-6
              prose-strong:text-foreground
              prose-li:text-sm prose-li:leading-relaxed
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children, ...props }) => (
                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                      <table {...props}>{children}</table>
                    </div>
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
                      // Strip anchor + leading ./ or / to isolate a filename.
                      const clean = decodeURIComponent(href.split('#')[0].replace(/^\.?\//, ''))
                      const targetId = docIdByFilename[clean.toLowerCase()]
                      if (targetId) {
                        // Internal cross-reference to another doc in this soul.
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
                      // A .md link with no matching doc would 404 — render inert.
                      if (clean.toLowerCase().endsWith('.md')) {
                        return <span className="text-muted-foreground">{children}</span>
                      }
                    }
                    // In-page anchors (#section) and anything else: default behavior.
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
            <div className="mt-16 border-t border-border pt-8 text-center print:hidden">
              <p className="text-xs text-muted-foreground/50 font-mono">
                {soul.title} · {currentDoc.title} · {currentDoc.date}
              </p>
              <p className="mt-2 text-xs font-bold tracking-widest text-muted-foreground/30">
                STATION ⚓
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
