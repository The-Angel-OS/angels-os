'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Highlight, themes } from 'prism-react-renderer'
import { Input } from '@/components/ui/input'
import {
  Search,
  FileText,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Zap,
  Terminal,
  Hash,
  ArrowUp,
  Command,
  X,
  Folder,
  FolderOpen,
  Brain,
  Shield,
  Rocket,
  Globe,
  Scroll,
  Sparkles,
  Users,
  MessageSquare,
  Settings,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  List,
  Star,
  Clock,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────────────────── */

interface DocFile {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  size?: number
  lastModified?: Date
  content?: string
  metadata?: {
    title?: string
    description?: string
    lastUpdated?: string
  }
}

interface DocContent {
  name: string
  path: string
  relativePath: string
  content: string
  size: number
  lastModified: Date
  metadata?: {
    title?: string
    description?: string
    lastUpdated?: string
  }
}

interface CategoryNode {
  name: string
  slug: string
  icon: React.ReactNode
  color: string
  files: DocFile[]
  children: CategoryNode[]
  expanded?: boolean
}

interface TocEntry {
  id: string
  text: string
  level: number
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const LCARS_COLORS = {
  amber: 'var(--lcars-amber)',
  orange: 'var(--lcars-orange)',
  peach: 'var(--lcars-peach)',
  lavender: 'var(--lcars-lavender)',
  blue: 'var(--lcars-blue)',
  blueDeep: 'var(--lcars-blue-deep)',
  purple: 'var(--lcars-purple)',
  green: 'var(--lcars-green)',
  red: 'var(--lcars-red)',
} as const

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; label: string; priority: number }
> = {
  v2: {
    icon: <Star className="w-3.5 h-3.5" />,
    color: LCARS_COLORS.amber,
    label: 'Core Docs',
    priority: 0,
  },
  architecture: {
    icon: <Settings className="w-3.5 h-3.5" />,
    color: LCARS_COLORS.blue,
    label: 'Architecture',
    priority: 1,
  },
  vision: {
    icon: <Sparkles className="w-3.5 h-3.5" />,
    color: LCARS_COLORS.lavender,
    label: 'Vision',
    priority: 2,
  },
  agents: {
    icon: <Brain className="w-3.5 h-3.5" />,
    color: LCARS_COLORS.green,
    label: 'AI Agents',
    priority: 3,
  },
  planning: {
    icon: <Rocket className="w-3.5 h-3.5" />,
    color: LCARS_COLORS.orange,
    label: 'Planning',
    priority: 4,
  },
  assessments: {
    icon: <Shield className="w-3.5 h-3.5" />,
    color: LCARS_COLORS.blueDeep,
    label: 'Assessments',
    priority: 5,
  },
  testing: {
    icon: <Terminal className="w-3.5 h-3.5" />,
    color: LCARS_COLORS.peach,
    label: 'Testing',
    priority: 6,
  },
  transcripts: {
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    color: LCARS_COLORS.purple,
    label: 'Transcripts',
    priority: 7,
  },
  cursor: {
    icon: <Terminal className="w-3.5 h-3.5" />,
    color: LCARS_COLORS.peach,
    label: 'Cursor',
    priority: 8,
  },
  prompts: {
    icon: <Zap className="w-3.5 h-3.5" />,
    color: LCARS_COLORS.red,
    label: 'Prompts',
    priority: 9,
  },
  'angel-os-architecture': {
    icon: <Globe className="w-3.5 h-3.5" />,
    color: LCARS_COLORS.blue,
    label: 'Angel OS Arch',
    priority: 10,
  },
  _root: {
    icon: <FileText className="w-3.5 h-3.5" />,
    color: LCARS_COLORS.amber,
    label: 'General',
    priority: 99,
  },
}

/* ─── Utilities ──────────────────────────────────────────────────────── */

function buildCategoryTree(docs: DocFile[]): CategoryNode[] {
  const categories: Record<string, DocFile[]> = {}

  docs
    .filter((d) => !d.isDirectory)
    .forEach((doc) => {
      const parts = doc.relativePath.split('/')
      const category = parts.length > 1 ? parts[0] : '_root'
      if (!categories[category]) categories[category] = []
      categories[category].push(doc)
    })

  return Object.entries(categories)
    .map(([slug, files]) => {
      const config = CATEGORY_CONFIG[slug] || CATEGORY_CONFIG._root
      return {
        name: config.label || slug,
        slug,
        icon: config.icon,
        color: config.color,
        files: files.sort((a, b) => a.name.localeCompare(b.name)),
        children: [],
        expanded: slug === 'v2', // Core docs expanded by default
      } satisfies CategoryNode
    })
    .sort((a, b) => {
      const pa = CATEGORY_CONFIG[a.slug]?.priority ?? 50
      const pb = CATEGORY_CONFIG[b.slug]?.priority ?? 50
      return pa - pb
    })
}

function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = []
  const lines = markdown.split('\n')
  const seen = new Set<string>()

  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2]
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        .trim()

      let id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')

      // Deduplicate IDs
      if (seen.has(id)) {
        let i = 2
        while (seen.has(`${id}-${i}`)) i++
        id = `${id}-${i}`
      }
      seen.add(id)
      entries.push({ id, text, level })
    }
  }
  return entries
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  const kb = bytes / 1024
  return kb > 1 ? `${kb.toFixed(1)} KB` : `${bytes} B`
}

function formatDate(date?: Date | string): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getDocTitle(doc: DocFile): string {
  return (
    doc.metadata?.title ||
    doc.name
      .replace(/\.(md|txt)$/, '')
      .replace(/_/g, ' ')
      .replace(/^\d{6}\s*/, '')
  )
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

/** LCARS decorative elbow/bracket */
function LcarsElbow({
  position,
  color,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  color: string
}) {
  const corners: Record<string, string> = {
    'top-left': 'rounded-tl-2xl border-t-2 border-l-2',
    'top-right': 'rounded-tr-2xl border-t-2 border-r-2',
    'bottom-left': 'rounded-bl-2xl border-b-2 border-l-2',
    'bottom-right': 'rounded-br-2xl border-b-2 border-r-2',
  }
  return (
    <div
      className={`w-4 h-4 ${corners[position]} opacity-60`}
      style={{ borderColor: color }}
    />
  )
}

/** LCARS horizontal accent bar */
function LcarsBar({
  color,
  className = '',
  animated = false,
}: {
  color: string
  className?: string
  animated?: boolean
}) {
  return (
    <div
      className={`h-1 rounded-full ${animated ? 'lcars-bar-glow' : ''} ${className}`}
      style={{ backgroundColor: color, opacity: animated ? undefined : 0.6 }}
    />
  )
}

/** Reading progress bar */
function ReadingProgress({ progress }: { progress: number }) {
  return (
    <div className="h-0.5 w-full bg-border/30 overflow-hidden">
      <div
        className="h-full transition-all duration-150 ease-out rounded-r-full"
        style={{
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${LCARS_COLORS.blue}, ${LCARS_COLORS.amber}, ${LCARS_COLORS.orange})`,
        }}
      />
    </div>
  )
}

/** Table of contents sidebar */
function TableOfContents({
  entries,
  activeId,
  onNavigate,
}: {
  entries: TocEntry[]
  activeId: string
  onNavigate: (id: string) => void
}) {
  if (entries.length === 0) return null

  return (
    <nav className="space-y-0.5">
      <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
        <List className="w-3.5 h-3.5" style={{ color: LCARS_COLORS.lavender }} />
        <span
          className="text-[10px] font-bold tracking-[0.2em] uppercase"
          style={{ color: LCARS_COLORS.lavender }}
        >
          On this page
        </span>
      </div>
      {entries.map((entry) => {
        const isActive = activeId === entry.id
        return (
          <button
            key={entry.id}
            onClick={() => onNavigate(entry.id)}
            className={`
              w-full text-left text-xs py-1 px-2 rounded-sm transition-all duration-200
              hover:bg-accent/50 truncate block
              ${isActive ? 'font-medium' : 'text-muted-foreground hover:text-foreground'}
            `}
            style={{
              paddingLeft: `${(entry.level - 1) * 12 + 8}px`,
              ...(isActive
                ? {
                    color: LCARS_COLORS.amber,
                    borderLeft: `2px solid ${LCARS_COLORS.amber}`,
                  }
                : {}),
            }}
            title={entry.text}
          >
            {entry.text}
          </button>
        )
      })}
    </nav>
  )
}

/** Syntax highlighted code block */
function CodeBlock({ code, language }: { code: string; language: string }) {
  const normalizedLang = language
    ?.replace('language-', '')
    .replace('tsx', 'typescript')
    .replace('jsx', 'javascript')
    .replace('sh', 'bash')
    .replace('shell', 'bash')
    .replace('yml', 'yaml')

  return (
    <div className="relative group my-4 lcars-code-block">
      {/* Language label */}
      {normalizedLang && (
        <div
          className="absolute top-0 right-0 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-bl-lg rounded-tr-lg z-10"
          style={{
            background: LCARS_COLORS.blueDeep,
            color: '#fff',
            opacity: 0.8,
          }}
        >
          {normalizedLang}
        </div>
      )}
      {/* Copy button */}
      <button
        className="absolute top-0 left-0 px-2 py-1 text-[10px] font-mono rounded-br-lg rounded-tl-lg z-10 opacity-0 group-hover:opacity-80 transition-opacity"
        style={{ background: LCARS_COLORS.amber, color: '#000' }}
        onClick={() => navigator.clipboard?.writeText(code)}
      >
        COPY
      </button>
      <Highlight
        theme={themes.nightOwl}
        code={code.trim()}
        language={normalizedLang || 'text'}
      >
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className="rounded-lg overflow-x-auto text-sm font-mono leading-relaxed p-4 pt-7"
            style={{
              ...style,
              background: 'var(--lcars-dark-bg)',
              border: `1px solid color-mix(in oklch, ${LCARS_COLORS.blueDeep}, transparent 70%)`,
            }}
          >
            {tokens.map((line, i) => {
              const lineProps = getLineProps({ line })
              return (
                <div key={i} {...lineProps} className="table-row">
                  <span
                    className="table-cell select-none pr-4 text-right opacity-30 text-xs"
                    style={{ color: LCARS_COLORS.blue }}
                  >
                    {i + 1}
                  </span>
                  <span className="table-cell">
                    {line.map((token, key) => {
                      const tokenProps = getTokenProps({ token })
                      return <span key={key} {...tokenProps} />
                    })}
                  </span>
                </div>
              )
            })}
          </pre>
        )}
      </Highlight>
    </div>
  )
}

/** Search overlay (Cmd+K style) */
function SearchOverlay({
  docs,
  isOpen,
  onClose,
  onSelect,
}: {
  docs: DocFile[]
  isOpen: boolean
  onClose: () => void
  onSelect: (doc: DocFile) => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return docs
      .filter((d) => !d.isDirectory)
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.metadata?.title?.toLowerCase().includes(q) ||
          d.metadata?.description?.toLowerCase().includes(q) ||
          d.relativePath.toLowerCase().includes(q),
      )
      .slice(0, 12)
  }, [docs, query])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        onSelect(results[selectedIndex])
        onClose()
      } else if (e.key === 'Escape') {
        onClose()
      }
    },
    [results, selectedIndex, onSelect, onClose],
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm lcars-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="relative w-full max-w-xl mx-4 rounded-xl overflow-hidden shadow-2xl lcars-slide-down"
        style={{
          background: 'var(--lcars-panel-bg)',
          border: `1px solid color-mix(in oklch, ${LCARS_COLORS.amber}, transparent 60%)`,
        }}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
          <Search className="w-4 h-4 shrink-0" style={{ color: LCARS_COLORS.amber }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search documentation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/20 text-muted-foreground">
            ESC
          </kbd>
        </div>
        {/* Results */}
        <div className="max-h-[40vh] overflow-y-auto">
          {query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No documents match &quot;{query}&quot;
            </div>
          )}
          {results.map((doc, i) => {
            const cat = doc.relativePath.split('/')[0]
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG._root
            return (
              <button
                key={doc.relativePath}
                onClick={() => {
                  onSelect(doc)
                  onClose()
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                  ${i === selectedIndex ? 'bg-accent/30' : 'hover:bg-accent/10'}
                `}
              >
                <div
                  className="w-1 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{getDocTitle(doc)}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {doc.relativePath}
                  </div>
                </div>
                {i === selectedIndex && (
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/20 text-muted-foreground shrink-0">
                    ENTER
                  </kbd>
                )}
              </button>
            )
          })}
          {!query && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Type to search across all documentation
            </div>
          )}
        </div>
        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border/20 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1 py-0.5 rounded bg-accent/20">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1 py-0.5 rounded bg-accent/20">↵</kbd> Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1 py-0.5 rounded bg-accent/20">esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export default function DocsPage() {
  // ── State ──
  const [docs, setDocs] = useState<DocFile[]>([])
  const [selectedDoc, setSelectedDoc] = useState<DocContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingContent, setLoadingContent] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tocOpen, setTocOpen] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['v2']))
  const [readingProgress, setReadingProgress] = useState(0)
  const [activeTocId, setActiveTocId] = useState('')
  const [navHistory, setNavHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const contentRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)

  // ── Derived data ──
  const categories = useMemo(() => buildCategoryTree(docs), [docs])
  const tocEntries = useMemo(
    () => (selectedDoc ? extractToc(selectedDoc.content) : []),
    [selectedDoc],
  )
  const breadcrumbs = useMemo(() => {
    if (!selectedDoc) return []
    const parts = selectedDoc.relativePath.split('/')
    if (parts.length > 1) {
      const cat = CATEGORY_CONFIG[parts[0]]?.label || parts[0]
      return [cat, getDocTitle(selectedDoc as unknown as DocFile)]
    }
    return [getDocTitle(selectedDoc as unknown as DocFile)]
  }, [selectedDoc])

  const totalFiles = useMemo(() => docs.filter((d) => !d.isDirectory).length, [docs])

  // ── Load docs list ──
  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/docs?action=list')
        const data = await res.json()
        if (data.success) setDocs(data.docs)
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // ── Load document ──
  const loadDoc = useCallback(
    async (relativePath: string, addToHistory = true) => {
      try {
        setLoadingContent(true)
        const res = await fetch(`/api/docs?action=read&file=${encodeURIComponent(relativePath)}`)
        const data = await res.json()
        if (data.success) {
          setSelectedDoc(data.file)
          setReadingProgress(0)
          setActiveTocId('')

          // Expand the parent category
          const cat = relativePath.split('/')[0]
          if (cat && cat !== relativePath) {
            setExpandedCategories((prev) => new Set([...prev, cat]))
          }

          // History management
          if (addToHistory) {
            setNavHistory((prev) => {
              const newHistory = prev.slice(0, historyIndex + 1)
              newHistory.push(relativePath)
              return newHistory
            })
            setHistoryIndex((i) => i + 1)
          }

          // Scroll to top
          contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        }
      } catch {
        // Silent fail
      } finally {
        setLoadingContent(false)
      }
    },
    [historyIndex],
  )

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K or / to open search
      if ((e.metaKey && e.key === 'k') || (e.key === '/' && !searchOpen)) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        setSearchOpen(true)
      }
      // Escape to close doc
      if (e.key === 'Escape' && !searchOpen && selectedDoc) {
        setSelectedDoc(null)
      }
      // [ and ] for sidebar toggle
      if (e.key === '[' && !searchOpen) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        setSidebarOpen((v) => !v)
      }
      if (e.key === ']' && !searchOpen) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        setTocOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen, selectedDoc])

  // ── Scroll tracking for reading progress + TOC highlight ──
  useEffect(() => {
    const el = contentRef.current
    if (!el || !selectedDoc) return

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      const progress = scrollHeight > clientHeight ? (scrollTop / (scrollHeight - clientHeight)) * 100 : 0
      setReadingProgress(Math.min(100, Math.max(0, progress)))

      // Find active TOC heading
      if (tocEntries.length > 0) {
        const headings = el.querySelectorAll('h1[id], h2[id], h3[id], h4[id]')
        let active = ''
        headings.forEach((h) => {
          const rect = h.getBoundingClientRect()
          const containerRect = el.getBoundingClientRect()
          if (rect.top - containerRect.top < 120) {
            active = h.id
          }
        })
        if (active) setActiveTocId(active)
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [selectedDoc, tocEntries])

  // ── TOC navigation ──
  const navigateToHeading = useCallback((id: string) => {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveTocId(id)
    }
  }, [])

  // ── Category toggle ──
  const toggleCategory = useCallback((slug: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }, [])

  // ── Back to list ──
  const goToList = useCallback(() => {
    setSelectedDoc(null)
    setReadingProgress(0)
  }, [])

  // ── Scroll to top ──
  const scrollToTop = useCallback(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <div ref={mainRef} className="flex flex-col h-[calc(100vh-64px)] overflow-hidden lcars-docs">
      {/* ── LCARS Top Bar ──────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border/40">
        <div className="flex items-center gap-2 px-3 py-2">
          {/* LCARS pill */}
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.15em] uppercase shrink-0"
            style={{ background: LCARS_COLORS.amber, color: '#000' }}
          >
            <BookOpen className="w-3 h-3" />
            <span>DOCS</span>
          </div>

          {/* Sidebar toggle (mobile) */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="lg:hidden p-1.5 rounded-md hover:bg-accent/50 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-1 min-w-0">
            <button
              onClick={goToList}
              className="hover:text-foreground transition-colors shrink-0"
              title="All Documents"
            >
              Angel OS
            </button>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                <ChevronRight className="w-3 h-3 shrink-0 opacity-40" />
                <span
                  className={`truncate ${i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : ''}`}
                >
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-accent/30 hover:bg-accent/50 transition-colors shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline text-[10px] font-mono px-1 py-0.5 rounded bg-background/50">
              /
            </kbd>
          </button>

          {/* Panel toggles */}
          <div className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1.5 rounded-md hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              title="Toggle sidebar [["
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-3.5 h-3.5" />
              ) : (
                <PanelLeftOpen className="w-3.5 h-3.5" />
              )}
            </button>
            {selectedDoc && (
              <button
                onClick={() => setTocOpen((v) => !v)}
                className="p-1.5 rounded-md hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                title="Toggle table of contents ]"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {/* Reading progress */}
        {selectedDoc && <ReadingProgress progress={readingProgress} />}
      </div>

      {/* ── Main Layout ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar Navigation ─────────────────────────────────── */}
        <aside
          className={`
            shrink-0 border-r border-border/40 overflow-y-auto overflow-x-hidden
            transition-all duration-300 ease-in-out
            ${sidebarOpen ? 'w-60 opacity-100' : 'w-0 opacity-0'}
          `}
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="p-3 space-y-1 min-w-[240px]">
            {/* Status pill */}
            <div className="flex items-center justify-between px-2 py-1 mb-2">
              <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground">
                Navigation
              </span>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                style={{
                  background: `color-mix(in oklch, ${LCARS_COLORS.green}, transparent 80%)`,
                  color: LCARS_COLORS.green,
                }}
              >
                {totalFiles}
              </span>
            </div>

            <LcarsBar color={LCARS_COLORS.amber} className="mb-3" />

            {loading ? (
              <div className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground">
                <div
                  className="w-3 h-3 rounded-full animate-pulse"
                  style={{ background: LCARS_COLORS.amber }}
                />
                Scanning files...
              </div>
            ) : (
              categories.map((cat) => {
                const isExpanded = expandedCategories.has(cat.slug)
                return (
                  <div key={cat.slug} className="mb-0.5">
                    {/* Category header */}
                    <button
                      onClick={() => toggleCategory(cat.slug)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium hover:bg-accent/40 transition-all duration-200 group"
                    >
                      <div
                        className="w-1 h-4 rounded-full shrink-0 transition-all group-hover:h-5"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span style={{ color: cat.color }} className="shrink-0">
                        {cat.icon}
                      </span>
                      <span className="flex-1 text-left truncate">{cat.name}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {cat.files.length}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      )}
                    </button>

                    {/* File list */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="pl-5 py-0.5 space-y-px">
                        {cat.files.map((file) => {
                          const isActive =
                            selectedDoc?.relativePath === file.relativePath
                          return (
                            <button
                              key={file.relativePath}
                              onClick={() => loadDoc(file.relativePath)}
                              className={`
                                w-full flex items-center gap-2 px-2 py-1 rounded-sm text-[11px] text-left
                                transition-all duration-150 truncate
                                ${
                                  isActive
                                    ? 'font-medium'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                                }
                              `}
                              style={
                                isActive
                                  ? {
                                      color: cat.color,
                                      background: `color-mix(in oklch, ${cat.color}, transparent 90%)`,
                                    }
                                  : undefined
                              }
                              title={getDocTitle(file)}
                            >
                              <FileText className="w-3 h-3 shrink-0 opacity-50" />
                              <span className="truncate">{getDocTitle(file)}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {/* Bottom decoration */}
            <div className="pt-4 mt-4 border-t border-border/20">
              <LcarsBar color={LCARS_COLORS.lavender} className="mb-2" />
              <div className="flex items-center gap-2 px-2 text-[10px] text-muted-foreground">
                <Command className="w-3 h-3" />
                <span>
                  <kbd className="font-mono">/</kbd> search &middot;{' '}
                  <kbd className="font-mono">[</kbd> sidebar
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Content Area ───────────────────────────────────────── */}
        <main
          ref={contentRef}
          className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
          style={{ scrollbarWidth: 'thin' }}
        >
          {!selectedDoc ? (
            /* ── Landing / Index View ───────────────────────────── */
            <div className="p-6 max-w-5xl mx-auto lcars-fade-in">
              {/* Hero header */}
              <div className="flex items-start gap-4 mb-8">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${LCARS_COLORS.amber}, ${LCARS_COLORS.orange})`,
                  }}
                >
                  <BookOpen className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold mb-1">Angel OS Documentation</h1>
                  <p className="text-sm text-muted-foreground">
                    {totalFiles} documents across {categories.length} categories &middot;
                    Browse, search, and explore the complete platform knowledge base
                  </p>
                </div>
              </div>

              {/* LCARS decorative separator */}
              <div className="flex items-center gap-2 mb-8">
                <div
                  className="h-2 rounded-full flex-1"
                  style={{
                    background: `linear-gradient(90deg, ${LCARS_COLORS.amber}, ${LCARS_COLORS.orange}, transparent)`,
                    opacity: 0.5,
                  }}
                />
                <div
                  className="h-2 w-16 rounded-full"
                  style={{ background: LCARS_COLORS.lavender, opacity: 0.4 }}
                />
                <div
                  className="h-2 w-8 rounded-full"
                  style={{ background: LCARS_COLORS.blue, opacity: 0.4 }}
                />
              </div>

              {/* Quick start cards */}
              <div className="mb-8">
                <h2 className="text-sm font-bold tracking-[0.1em] uppercase text-muted-foreground mb-4 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" style={{ color: LCARS_COLORS.amber }} />
                  Quick Start
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    {
                      path: 'v2/GETTING_STARTED.md',
                      title: 'Getting Started',
                      desc: 'Setup, config, and first run',
                      color: LCARS_COLORS.green,
                      icon: <Rocket className="w-4 h-4" />,
                    },
                    {
                      path: 'v2/CORE_PLATFORM_ARCHITECTURE.md',
                      title: 'Platform Architecture',
                      desc: 'Three-layer system design',
                      color: LCARS_COLORS.blue,
                      icon: <Settings className="w-4 h-4" />,
                    },
                    {
                      path: 'v2/LEO_AI_COMPLETE.md',
                      title: 'LEO AI System',
                      desc: 'AI agents, tools, and conversation engine',
                      color: LCARS_COLORS.lavender,
                      icon: <Brain className="w-4 h-4" />,
                    },
                  ].map((card) => {
                    const doc = docs.find((d) => d.relativePath === card.path)
                    if (!doc) return null
                    return (
                      <button
                        key={card.path}
                        onClick={() => loadDoc(doc.relativePath)}
                        className="group relative flex flex-col gap-2 p-4 rounded-xl text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg lcars-quick-card"
                        style={{
                          background: 'var(--card)',
                          border: `1px solid color-mix(in oklch, ${card.color}, transparent 70%)`,
                        }}
                      >
                        <div
                          className="absolute top-0 left-0 w-full h-0.5 rounded-t-xl opacity-60 group-hover:opacity-100 transition-opacity"
                          style={{ background: card.color }}
                        />
                        <div className="flex items-center gap-2">
                          <span style={{ color: card.color }}>{card.icon}</span>
                          <span className="font-medium text-sm">{card.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{card.desc}</p>
                        <div
                          className="text-[10px] font-mono opacity-50 group-hover:opacity-80 transition-opacity"
                          style={{ color: card.color }}
                        >
                          {card.path}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Category grid */}
              <h2 className="text-sm font-bold tracking-[0.1em] uppercase text-muted-foreground mb-4 flex items-center gap-2">
                <Folder className="w-3.5 h-3.5" style={{ color: LCARS_COLORS.orange }} />
                Categories
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                {categories.map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => {
                      setExpandedCategories((prev) => new Set([...prev, cat.slug]))
                      setSidebarOpen(true)
                      // Load first file in category
                      if (cat.files.length > 0) {
                        loadDoc(cat.files[0].relativePath)
                      }
                    }}
                    className="group flex items-center gap-3 p-3 rounded-lg text-left hover:bg-accent/40 transition-all duration-200"
                    style={{
                      borderLeft: `3px solid ${cat.color}`,
                    }}
                  >
                    <span style={{ color: cat.color }}>{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{cat.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {cat.files.length} document{cat.files.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <ChevronRight
                      className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: cat.color }}
                    />
                  </button>
                ))}
              </div>

              {/* All documents list */}
              <h2 className="text-sm font-bold tracking-[0.1em] uppercase text-muted-foreground mb-4 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" style={{ color: LCARS_COLORS.peach }} />
                All Documents
              </h2>
              <div className="space-y-px">
                {docs
                  .filter((d) => !d.isDirectory)
                  .map((doc) => {
                    const cat = doc.relativePath.split('/')[0]
                    const config =
                      cat !== doc.relativePath
                        ? CATEGORY_CONFIG[cat] || CATEGORY_CONFIG._root
                        : CATEGORY_CONFIG._root
                    return (
                      <button
                        key={doc.relativePath}
                        onClick={() => loadDoc(doc.relativePath)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-accent/30 transition-colors group"
                      >
                        <div
                          className="w-0.5 h-5 rounded-full shrink-0"
                          style={{ backgroundColor: config.color }}
                        />
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm truncate block">{getDocTitle(doc)}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground hidden sm:block">
                          {doc.relativePath}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {formatFileSize(doc.size)}
                        </span>
                      </button>
                    )
                  })}
              </div>

              {/* Bottom decorative bar */}
              <div className="flex items-center gap-2 mt-8 pt-4 border-t border-border/20">
                <div
                  className="h-2 w-8 rounded-full"
                  style={{ background: LCARS_COLORS.purple, opacity: 0.4 }}
                />
                <div
                  className="h-2 w-16 rounded-full"
                  style={{ background: LCARS_COLORS.lavender, opacity: 0.4 }}
                />
                <div
                  className="h-2 flex-1 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${LCARS_COLORS.amber})`,
                    opacity: 0.3,
                  }}
                />
              </div>
            </div>
          ) : loadingContent ? (
            /* ── Loading state ─────────────────────────────────── */
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                  <div
                    className="absolute inset-0 rounded-full animate-spin"
                    style={{
                      border: `2px solid transparent`,
                      borderTopColor: LCARS_COLORS.amber,
                      borderRightColor: LCARS_COLORS.blue,
                    }}
                  />
                  <div className="absolute inset-2 rounded-full flex items-center justify-center">
                    <BookOpen
                      className="w-5 h-5 animate-pulse"
                      style={{ color: LCARS_COLORS.amber }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground tracking-wider uppercase">
                  Loading document...
                </span>
              </div>
            </div>
          ) : (
            /* ── Document Viewer ───────────────────────────────── */
            <div className="flex lcars-fade-in">
              {/* Document content */}
              <article className="flex-1 min-w-0 p-6 max-w-4xl mx-auto">
                {/* Doc header */}
                <header className="mb-8 pb-6 border-b border-border/30">
                  <div className="flex items-start gap-3 mb-3">
                    {(() => {
                      const cat = selectedDoc.relativePath.split('/')[0]
                      const config =
                        cat !== selectedDoc.relativePath
                          ? CATEGORY_CONFIG[cat] || CATEGORY_CONFIG._root
                          : CATEGORY_CONFIG._root
                      return (
                        <div
                          className="w-2 h-8 rounded-full shrink-0 mt-1"
                          style={{ backgroundColor: config.color }}
                        />
                      )
                    })()}
                    <div>
                      <h1 className="text-2xl font-bold leading-tight">
                        {selectedDoc.metadata?.title ||
                          selectedDoc.name.replace(/\.(md|txt)$/, '')}
                      </h1>
                      {selectedDoc.metadata?.description && (
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                          {selectedDoc.metadata.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground pl-5">
                    <span className="flex items-center gap-1 font-mono">
                      <FileText className="w-3 h-3" />
                      {selectedDoc.relativePath}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(selectedDoc.lastModified)}
                    </span>
                    <span>{formatFileSize(selectedDoc.size)}</span>
                    {tocEntries.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {tocEntries.length} sections
                      </span>
                    )}
                  </div>
                </header>

                {/* Markdown content */}
                <div className="prose prose-sm dark:prose-invert max-w-none lcars-prose">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => {
                        const text = extractTextFromChildren(children)
                        const id = text
                          .toLowerCase()
                          .replace(/[^a-z0-9\s-]/g, '')
                          .replace(/\s+/g, '-')
                        return (
                          <h1
                            id={id}
                            className="text-2xl font-bold mb-6 pb-3 border-b border-border/30 scroll-mt-4"
                          >
                            {children}
                          </h1>
                        )
                      },
                      h2: ({ children }) => {
                        const text = extractTextFromChildren(children)
                        const id = text
                          .toLowerCase()
                          .replace(/[^a-z0-9\s-]/g, '')
                          .replace(/\s+/g, '-')
                        return (
                          <h2
                            id={id}
                            className="text-xl font-semibold mb-4 mt-10 scroll-mt-4 flex items-center gap-2 group"
                          >
                            <div
                              className="w-1 h-5 rounded-full shrink-0 opacity-60"
                              style={{ background: LCARS_COLORS.amber }}
                            />
                            {children}
                            <a
                              href={`#${id}`}
                              className="opacity-0 group-hover:opacity-40 transition-opacity text-muted-foreground"
                            >
                              <Hash className="w-4 h-4" />
                            </a>
                          </h2>
                        )
                      },
                      h3: ({ children }) => {
                        const text = extractTextFromChildren(children)
                        const id = text
                          .toLowerCase()
                          .replace(/[^a-z0-9\s-]/g, '')
                          .replace(/\s+/g, '-')
                        return (
                          <h3
                            id={id}
                            className="text-lg font-medium mb-3 mt-8 scroll-mt-4 flex items-center gap-2 group"
                          >
                            <div
                              className="w-0.5 h-4 rounded-full shrink-0 opacity-40"
                              style={{ background: LCARS_COLORS.blue }}
                            />
                            {children}
                            <a
                              href={`#${id}`}
                              className="opacity-0 group-hover:opacity-40 transition-opacity text-muted-foreground"
                            >
                              <Hash className="w-3.5 h-3.5" />
                            </a>
                          </h3>
                        )
                      },
                      h4: ({ children }) => {
                        const text = extractTextFromChildren(children)
                        const id = text
                          .toLowerCase()
                          .replace(/[^a-z0-9\s-]/g, '')
                          .replace(/\s+/g, '-')
                        return (
                          <h4
                            id={id}
                            className="text-base font-medium mb-2 mt-6 scroll-mt-4"
                          >
                            {children}
                          </h4>
                        )
                      },
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4 rounded-lg" style={{
                          border: `1px solid color-mix(in oklch, ${LCARS_COLORS.blueDeep}, transparent 70%)`,
                        }}>
                          <table className="min-w-full divide-y divide-border/30">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead style={{ background: 'var(--lcars-card-bg)' }}>
                          {children}
                        </thead>
                      ),
                      th: ({ children }) => (
                        <th
                          className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider border-b border-border/20"
                          style={{ color: LCARS_COLORS.amber }}
                        >
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="px-3 py-2 text-sm border-b border-border/10">
                          {children}
                        </td>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote
                          className="pl-4 py-2 my-4 rounded-r-lg text-sm italic"
                          style={{
                            borderLeft: `3px solid ${LCARS_COLORS.lavender}`,
                            background: `color-mix(in oklch, ${LCARS_COLORS.lavender}, transparent 92%)`,
                          }}
                        >
                          {children}
                        </blockquote>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          className="underline underline-offset-2 decoration-1 hover:decoration-2 transition-all"
                          style={{ color: LCARS_COLORS.blue }}
                          target={href?.startsWith('http') ? '_blank' : undefined}
                          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                        >
                          {children}
                        </a>
                      ),
                      code: ({ children, className }) => {
                        const isBlock = !!className
                        if (isBlock) {
                          const code = String(children).replace(/\n$/, '')
                          const language = className?.replace('language-', '') || ''
                          return <CodeBlock code={code} language={language} />
                        }
                        return (
                          <code
                            className="px-1.5 py-0.5 rounded text-[13px] font-mono"
                            style={{
                              background: `color-mix(in oklch, ${LCARS_COLORS.blueDeep}, transparent 85%)`,
                              color: LCARS_COLORS.peach,
                            }}
                          >
                            {children}
                          </code>
                        )
                      },
                      pre: ({ children }) => <>{children}</>,
                      hr: () => (
                        <div className="flex items-center gap-2 my-8">
                          <div
                            className="h-0.5 flex-1 rounded-full"
                            style={{
                              background: `linear-gradient(90deg, ${LCARS_COLORS.amber}, transparent)`,
                              opacity: 0.3,
                            }}
                          />
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: LCARS_COLORS.amber, opacity: 0.3 }}
                          />
                          <div
                            className="h-0.5 flex-1 rounded-full"
                            style={{
                              background: `linear-gradient(90deg, transparent, ${LCARS_COLORS.blue})`,
                              opacity: 0.3,
                            }}
                          />
                        </div>
                      ),
                      ul: ({ children }) => (
                        <ul className="space-y-1 my-3 list-none pl-0">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="space-y-1 my-3 list-none pl-0 lcars-ol-counter">{children}</ol>
                      ),
                      li: ({ children, ...props }) => {
                        // Detect ordered list by checking parent node type
                        const isOrdered = (props as Record<string, unknown>).ordered === true
                        const index = (props as Record<string, unknown>).index as number | undefined
                        return (
                          <li className="flex items-start gap-2 text-sm leading-relaxed">
                            {isOrdered ? (
                              <span
                                className="text-[11px] font-mono font-bold mt-0.5 min-w-[1.2em] text-right shrink-0"
                                style={{ color: LCARS_COLORS.amber, opacity: 0.7 }}
                              >
                                {(index ?? 0) + 1}.
                              </span>
                            ) : (
                              <span
                                className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                                style={{ background: LCARS_COLORS.amber, opacity: 0.5 }}
                              />
                            )}
                            <span>{children}</span>
                          </li>
                        )
                      },
                      strong: ({ children }) => (
                        <strong className="font-semibold" style={{ color: LCARS_COLORS.peach }}>
                          {children}
                        </strong>
                      ),
                    }}
                  >
                    {selectedDoc.content}
                  </ReactMarkdown>
                </div>

                {/* Document footer */}
                <footer className="mt-12 pt-6 border-t border-border/20">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 w-8 rounded-full"
                      style={{ background: LCARS_COLORS.purple, opacity: 0.4 }}
                    />
                    <div
                      className="h-1.5 w-16 rounded-full"
                      style={{ background: LCARS_COLORS.lavender, opacity: 0.3 }}
                    />
                    <div
                      className="h-1.5 flex-1 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${LCARS_COLORS.amber})`,
                        opacity: 0.2,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
                    <span>
                      End of document &middot; {formatFileSize(selectedDoc.size)}
                    </span>
                    <button
                      onClick={scrollToTop}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <ArrowUp className="w-3 h-3" />
                      Back to top
                    </button>
                  </div>
                </footer>
              </article>

              {/* ── Table of Contents (right) ──────────────────── */}
              {tocEntries.length > 0 && (
                <aside
                  className={`
                    shrink-0 border-l border-border/30 overflow-y-auto
                    transition-all duration-300 ease-in-out
                    hidden xl:block
                    ${tocOpen ? 'w-52 opacity-100' : 'w-0 opacity-0'}
                  `}
                  style={{ scrollbarWidth: 'thin' }}
                >
                  <div className="p-3 sticky top-0 min-w-[208px]">
                    <TableOfContents
                      entries={tocEntries}
                      activeId={activeTocId}
                      onNavigate={navigateToHeading}
                    />
                  </div>
                </aside>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── LCARS Bottom Status Bar ─────────────────────────────── */}
      <div className="shrink-0 border-t border-border/30">
        <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-muted-foreground">
          <div
            className="w-6 h-3 rounded-full"
            style={{ background: LCARS_COLORS.amber, opacity: 0.5 }}
          />
          <div
            className="w-12 h-3 rounded-full"
            style={{ background: LCARS_COLORS.lavender, opacity: 0.3 }}
          />
          <span className="flex-1 font-mono">
            ANGEL OS DOCUMENTATION CENTER &middot; LCARS v2.1
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Command className="w-3 h-3" />
              <kbd className="font-mono">/</kbd> search
            </span>
            <span className="hidden sm:inline">
              <kbd className="font-mono">[</kbd> nav &middot;{' '}
              <kbd className="font-mono">]</kbd> toc
            </span>
          </span>
          <div
            className="w-6 h-3 rounded-full"
            style={{ background: LCARS_COLORS.blue, opacity: 0.3 }}
          />
        </div>
      </div>

      {/* ── Search Overlay ──────────────────────────────────────── */}
      <SearchOverlay
        docs={docs}
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(doc) => loadDoc(doc.relativePath)}
      />

      {/* ── Scroll-to-top FAB (when in doc) ────────────────────── */}
      {selectedDoc && readingProgress > 20 && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-16 right-6 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 lcars-fade-in z-40"
          style={{
            background: LCARS_COLORS.amber,
            color: '#000',
          }}
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

/* ─── Helper ─────────────────────────────────────────────────────────── */

function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('')
  if (React.isValidElement(children)) {
    const props = children.props as Record<string, unknown>
    if (props?.children) {
      return extractTextFromChildren(props.children as React.ReactNode)
    }
  }
  return ''
}
