'use client'

/**
 * MediaPicker — pick an existing image, server-paginated + server-filtered.
 *
 * Was: fetch ALL images (limit 120) and filter in the browser — chokes past a few
 * dozen. Now it queries /api/media with limit + page + a `filename like` where
 * clause, so the filter spans the WHOLE library (not just loaded rows) and only a
 * page of thumbnails renders at a time. Access-scoped to the active tenant.
 *
 * Channel source (optional): when opened with a space+channel, a "This channel"
 * tab lists the images posted to that channel (message attachments) so you can
 * re-submit an existing channel image back into the pipeline — not just the tenant
 * library. Falls back to Library-only when no channel context is given.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'

type MediaDoc = {
  id: number | string
  url?: string
  filename?: string
  alt?: string
  mimeType?: string
  thumbnailURL?: string
  sizes?: { thumbnail?: { url?: string } }
}

const PAGE = 24
const thumb = (m: MediaDoc) => m.sizes?.thumbnail?.url || m.thumbnailURL || m.url || ''

export function MediaPicker({
  onSelect,
  onConfirm,
  onClose,
  tenantId,
  spaceId,
  channelSlug,
  multiple = false,
  defaultSource,
}: {
  onSelect: (m: { id: number | string; url: string }) => void
  /** Multi-select confirm — receives all picked items at once. Requires multiple. */
  onConfirm?: (items: Array<{ id: number | string; url: string }>) => void
  onClose: () => void
  /** Scope the library to a single tenant (super_admins are in every tenant). */
  tenantId?: string | number | null
  /** Optional: enables a "This channel" tab sourcing images from channel posts. */
  spaceId?: string | number | null
  channelSlug?: string | null
  /** Select many images and confirm together (for "add these three to a gallery"). */
  multiple?: boolean
  /** Which tab to open on first render (falls back to library if no channel). */
  defaultSource?: 'library' | 'channel'
}) {
  const hasChannel = !!(spaceId && channelSlug)
  const [source, setSource] = useState<'library' | 'channel'>(
    defaultSource === 'channel' && hasChannel ? 'channel' : defaultSource || 'library',
  )
  // Multi-select accumulator (keyed by media id). Unused in single-select mode.
  const [selected, setSelected] = useState<Map<string, { id: number | string; url: string }>>(new Map())
  const toggle = (m: { id: number | string; url: string }) =>
    setSelected((prev) => {
      const next = new Map(prev)
      const k = String(m.id)
      if (next.has(k)) next.delete(k)
      else next.set(k, m)
      return next
    })
  const [items, setItems] = useState<MediaDoc[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('') // debounced query

  // Debounce the search box → server query (whole-library search).
  useEffect(() => {
    const t = setTimeout(() => { setDq(q.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [q])

  // Reset paging when switching source.
  useEffect(() => { setPage(1) }, [source])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        let docs: MediaDoc[] = []
        let pages = 1
        let total = 0

        if (source === 'channel' && hasChannel) {
          // Channel images = image attachments on this channel's messages.
          const p = new URLSearchParams({ sort: '-createdAt', limit: '60', depth: '2' })
          p.set('where[and][0][space][equals]', String(spaceId))
          p.set('where[and][1][channel][equals]', String(channelSlug))
          const res = await fetch(`/api/messages?${p.toString()}`, { credentials: 'include' })
          const data = await res.json()
          if (!res.ok) throw new Error(data?.errors?.[0]?.message || 'Failed to load channel media')
          const seen = new Set<string>()
          for (const msg of data?.docs || []) {
            for (const att of msg.attachments || []) {
              const m = att?.media
              if (m && typeof m === 'object' && (m.mimeType || '').startsWith('image/') && m.url && !seen.has(String(m.url))) {
                seen.add(String(m.url))
                docs.push(m as MediaDoc)
              }
            }
          }
          if (dq) docs = docs.filter((m) => `${m.filename || ''} ${m.alt || ''}`.toLowerCase().includes(dq.toLowerCase()))
          total = docs.length
          pages = 1
        } else {
          // Library = the SAME tenant-scoped query as /dashboard/media — the
          // server resolves the tenant from the host, so nothing leaks across
          // portals regardless of what the client passes.
          const p = new URLSearchParams({ limit: String(PAGE), page: String(page), type: 'image' })
          if (dq) p.set('q', dq)
          const res = await fetch(`/api/media-library?${p.toString()}`, { credentials: 'include' })
          const data = await res.json()
          if (!res.ok) throw new Error(data?.errors?.[0]?.message || 'Failed to load media')
          docs = (data?.docs || []).filter((d: MediaDoc) => (d.mimeType || '').startsWith('image/'))
          pages = Number(data?.totalPages) || 1
          total = Number(data?.totalDocs) || docs.length
        }

        if (active) { setItems(docs); setTotalPages(pages); setTotalDocs(total) }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load media')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [tenantId, spaceId, channelSlug, source, page, dq, hasChannel])

  const rangeLabel = useMemo(() => {
    if (source === 'channel') return `${totalDocs} image${totalDocs !== 1 ? 's' : ''}`
    if (totalDocs === 0) return '0'
    const start = (page - 1) * PAGE + 1
    const end = (page - 1) * PAGE + items.length
    return `${start}–${end} of ${totalDocs}`
  }, [source, page, items.length, totalDocs])

  const tab = (key: 'library' | 'channel', label: string) => (
    <button
      type="button"
      onClick={() => setSource(key)}
      className={`rounded px-3 py-1 text-xs font-medium ${source === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
    >
      {label}
    </button>
  )

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          <h3 className="text-sm font-semibold">Select existing media</h3>
          {hasChannel && (
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              {tab('library', 'Library')}
              {tab('channel', 'This channel')}
            </div>
          )}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search filename / alt…"
            className="ml-auto w-48 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs outline-none focus:border-primary"
          />
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="p-6 text-center text-xs text-muted-foreground">Loading media…</p>
          ) : error ? (
            <p className="p-6 text-center text-xs text-red-500">{error}</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              {dq ? 'No matches.' : source === 'channel' ? 'No images posted to this channel yet.' : 'No images in the library yet — upload one instead.'}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {items.map((m) => {
                const isSel = selected.has(String(m.id))
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (!m.url) return
                      if (multiple) toggle({ id: m.id, url: m.url })
                      else onSelect({ id: m.id, url: m.url })
                    }}
                    title={m.filename || String(m.id)}
                    className={`group relative aspect-square overflow-hidden rounded-md border bg-muted/30 hover:border-primary ${isSel ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb(m)} alt={m.alt || m.filename || ''} loading="lazy" className="h-full w-full object-cover" />
                    {multiple && (
                      <span className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${isSel ? 'bg-primary text-primary-foreground' : 'bg-black/40 text-white/70'}`}>
                        {isSel ? '✓' : '+'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer: count + pager (library only; channel is a single window) */}
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>{rangeLabel}{multiple && selected.size > 0 ? ` · ${selected.size} selected` : ''}</span>
          <span className="flex items-center gap-2">
            {source === 'library' && totalPages > 1 && (
              <>
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-border px-2 py-0.5 disabled:opacity-40 hover:bg-muted">← Prev</button>
                <span>Page {page} / {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded border border-border px-2 py-0.5 disabled:opacity-40 hover:bg-muted">Next →</button>
              </>
            )}
            {multiple && (
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={() => onConfirm?.(Array.from(selected.values()))}
                className="rounded bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
              >
                Add {selected.size || ''} selected
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
