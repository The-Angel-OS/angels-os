'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowUp, ArrowDown, Eye, Pencil, Loader2, BookOpen, ChevronLeft, Languages, ShieldCheck, ExternalLink } from 'lucide-react'
import { createWork, sealWork as sealWorkAction, translateWork as translateWorkAction, type WorkMedia, type WorkSummary } from './actions'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || ''

interface WorkPage {
  id: string
  order: number
  title?: string
  markdown: string
}
interface WorkDraft {
  title: string
  subtitle?: string
  media: WorkMedia
  languages: { code: string; name: string; rtl?: boolean }[]
  defaultLanguage: string
  pages: WorkPage[]
}

const MEDIA_OPTIONS: { value: WorkMedia; label: string }[] = [
  { value: 'doc', label: 'Document' },
  { value: 'book', label: 'Book' },
  { value: 'primer', label: 'Illustrated Primer' },
  { value: 'audio', label: 'Audiobook' },
  { value: 'video', label: 'Video' },
  { value: 'quest', label: 'Quest' },
]

const uid = () =>
  'p_' + Math.abs(Date.now() ^ Math.floor(performance.now() * 1000)).toString(36) + Math.floor(performance.now()).toString(36)

export function WorkStudio({ initialWorks, tenantName }: { initialWorks: WorkSummary[]; tenantName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = () => {
    const title = window.prompt('Title for the new work?')
    if (title == null) return
    startTransition(async () => {
      const res = await createWork(title)
      if (res.success && res.id) {
        router.refresh()
        setOpenId(res.id)
      } else {
        setError(res.error || 'Could not create work')
      }
    })
  }

  if (openId) {
    return <WorkEditor channelId={openId} onBack={() => { setOpenId(null); router.refresh() }} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Works Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Author and edit the works in {tenantName}’s Library. The workshop is mutable; sealing into a
            signed, shareable release comes next.
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? 'Creating…' : '+ New Work'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {initialWorks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
          No works yet. Create your first — a book, a case file, a primer.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {initialWorks.map((w) => (
            <button
              key={w.id}
              onClick={() => setOpenId(w.id)}
              className="group flex flex-col rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-semibold group-hover:text-primary">{w.title}</span>
              </div>
              <span className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {w.media} · {w.pageCount} page{w.pageCount !== 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function WorkEditor({ channelId, onBack }: { channelId: string; onBack: () => void }) {
  const [draft, setDraft] = useState<WorkDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState<null | 'seal' | 'translate'>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string; url?: string } | null>(null)

  const dataRef = useRef<Record<string, unknown>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${SERVER_URL}/api/channels/${channelId}?depth=0`, { credentials: 'include' })
        if (!res.ok) throw new Error(`Failed to load (${res.status})`)
        const doc = await res.json()
        const data = (doc?.data && typeof doc.data === 'object' ? doc.data : {}) as Record<string, unknown>
        dataRef.current = data
        const wd = (data.workDraft as WorkDraft) || {
          title: doc?.name || 'Untitled', media: 'doc', languages: [{ code: 'en', name: 'English' }], defaultLanguage: 'en', pages: [],
        }
        if (!cancelled) {
          setDraft({ ...wd, pages: [...(wd.pages || [])].sort((a, b) => a.order - b.order) })
          setSelectedPageId(wd.pages?.[0]?.id ?? null)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [channelId])

  const persist = useCallback(
    (next: WorkDraft) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaving(true)
        try {
          const body = { data: { ...dataRef.current, workDraft: next } }
          const res = await fetch(`${SERVER_URL}/api/channels/${channelId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error(`Save failed (${res.status})`)
          dataRef.current = { ...dataRef.current, workDraft: next }
        } catch (e) {
          setError((e as Error).message)
        } finally {
          setSaving(false)
        }
      }, 600)
    },
    [channelId],
  )

  const mutate = useCallback(
    (fn: (d: WorkDraft) => WorkDraft) => {
      setDraft((cur) => {
        if (!cur) return cur
        const next = fn(cur)
        persist(next)
        return next
      })
    },
    [persist],
  )

  const reorder = (pages: WorkPage[]) => pages.map((p, i) => ({ ...p, order: i }))

  const addPage = () =>
    mutate((d) => {
      const page: WorkPage = { id: uid(), order: d.pages.length, title: `Page ${d.pages.length + 1}`, markdown: '' }
      setSelectedPageId(page.id)
      return { ...d, pages: [...d.pages, page] }
    })

  const removePage = (id: string) =>
    mutate((d) => {
      const pages = reorder(d.pages.filter((p) => p.id !== id))
      if (selectedPageId === id) setSelectedPageId(pages[0]?.id ?? null)
      return { ...d, pages }
    })

  const movePage = (id: string, dir: -1 | 1) =>
    mutate((d) => {
      const idx = d.pages.findIndex((p) => p.id === id)
      const swap = idx + dir
      if (idx < 0 || swap < 0 || swap >= d.pages.length) return d
      const pages = [...d.pages]
      ;[pages[idx], pages[swap]] = [pages[swap], pages[idx]]
      return { ...d, pages: reorder(pages) }
    })

  const selectedPage = useMemo(() => draft?.pages.find((p) => p.id === selectedPageId) ?? null, [draft, selectedPageId])

  const handleTranslate = async () => {
    if (busy) return
    setNotice(null)
    setBusy('translate')
    try {
      const res = await translateWorkAction(channelId)
      if (res.success) {
        const n = res.added?.length ?? 0
        setNotice({ kind: 'ok', text: n > 0 ? `Translated into ${n} more language${n !== 1 ? 's' : ''}. Seal to publish them.` : 'Already translated into the platform languages.' })
      } else {
        setNotice({ kind: 'err', text: res.error || 'Translation failed' })
      }
    } finally {
      setBusy(null)
    }
  }

  const handleSeal = async () => {
    if (busy) return
    setNotice(null)
    setBusy('seal')
    try {
      const res = await sealWorkAction(channelId)
      if (res.success) {
        setNotice({
          kind: 'ok',
          text: `Sealed v${res.version} · ${res.languages?.length ?? 1} language${(res.languages?.length ?? 1) !== 1 ? 's' : ''} · signed & verified.`,
          url: res.slug ? `/learn/${res.slug}` : undefined,
        })
      } else {
        setNotice({ kind: 'err', text: res.error || 'Seal failed' })
      }
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
  if (!draft) return <div className="p-8 text-sm text-red-500">{error || 'Could not load this work.'}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> All works
        </button>
        <div className="flex items-center gap-2">
          <span className="mr-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {saving ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</> : 'Saved'}
          </span>
          <button
            onClick={handleTranslate}
            disabled={!!busy || draft.pages.length === 0}
            title="Auto-translate into the platform languages"
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {busy === 'translate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
            Translate
          </button>
          <button
            onClick={handleSeal}
            disabled={!!busy || draft.pages.length === 0}
            title="Seal into a signed, shareable release"
            className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy === 'seal' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Seal &amp; Publish
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm ${
            notice.kind === 'ok'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          <span>{notice.text}</span>
          {notice.url && (
            <a href={notice.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline">
              Open in the Library <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

      {/* Work metadata */}
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Title
          <input value={draft.title} onChange={(e) => mutate((d) => ({ ...d, title: e.target.value }))} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Subtitle
          <input value={draft.subtitle || ''} onChange={(e) => mutate((d) => ({ ...d, subtitle: e.target.value }))} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Media type
          <select value={draft.media} onChange={(e) => mutate((d) => ({ ...d, media: e.target.value as WorkMedia }))} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
            {MEDIA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {/* Pages: list + editor */}
      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <div className="rounded-xl border border-border bg-card p-2">
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pages</span>
            <button onClick={addPage} className="text-primary hover:opacity-80" aria-label="Add page"><Plus className="h-4 w-4" /></button>
          </div>
          {draft.pages.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No pages yet. Add one to start writing.</p>
          ) : (
            <ul className="space-y-0.5">
              {draft.pages.map((p, i) => (
                <li key={p.id}>
                  <div className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${selectedPageId === p.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                    <button onClick={() => setSelectedPageId(p.id)} className="flex-1 truncate text-left">{p.title || `Page ${i + 1}`}</button>
                    <button onClick={() => movePage(p.id, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3 w-3" /></button>
                    <button onClick={() => movePage(p.id, 1)} disabled={i === draft.pages.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3 w-3" /></button>
                    <button onClick={() => removePage(p.id)} className="text-red-500 hover:opacity-80" aria-label="Delete page"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          {!selectedPage ? (
            <p className="text-sm text-muted-foreground">Select or add a page to edit.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  value={selectedPage.title || ''}
                  onChange={(e) => mutate((d) => ({ ...d, pages: d.pages.map((p) => (p.id === selectedPage.id ? { ...p, title: e.target.value } : p)) }))}
                  placeholder="Page title"
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-medium"
                />
                <button onClick={() => setPreview((v) => !v)} className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-muted">
                  {preview ? <><Pencil className="h-3 w-3" /> Edit</> : <><Eye className="h-3 w-3" /> Preview</>}
                </button>
              </div>
              {preview ? (
                <article className="prose prose-sm max-w-none rounded-md border border-border bg-background p-3 dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedPage.markdown || '_Nothing yet._'}</ReactMarkdown>
                </article>
              ) : (
                <textarea
                  value={selectedPage.markdown}
                  onChange={(e) => mutate((d) => ({ ...d, pages: d.pages.map((p) => (p.id === selectedPage.id ? { ...p, markdown: e.target.value } : p)) }))}
                  placeholder="Write in Markdown…"
                  className="min-h-[24rem] w-full rounded-md border border-border bg-background p-3 font-mono text-sm leading-relaxed"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
