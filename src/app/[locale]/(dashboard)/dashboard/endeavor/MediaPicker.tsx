'use client'

/**
 * MediaPicker — pick an existing image from the tenant's Media library.
 *
 * Fetches /api/media (access-controlled to the active tenant) and shows a grid
 * to select from, so image fields aren't upload-only. Returns { id, url }.
 */

import React, { useEffect, useState } from 'react'

type MediaDoc = {
  id: number | string
  url?: string
  filename?: string
  alt?: string
  mimeType?: string
  thumbnailURL?: string
  sizes?: { thumbnail?: { url?: string } }
}

const thumb = (m: MediaDoc) => m.sizes?.thumbnail?.url || m.thumbnailURL || m.url || ''

export function MediaPicker({
  onSelect,
  onClose,
}: {
  onSelect: (m: { id: number | string; url: string }) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<MediaDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ limit: '120', sort: '-createdAt', depth: '0' })
        params.set('where[mimeType][like]', 'image')
        const res = await fetch(`/api/media?${params.toString()}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.errors?.[0]?.message || 'Failed to load media')
        const docs: MediaDoc[] = (data?.docs || []).filter((d: MediaDoc) => (d.mimeType || '').startsWith('image/'))
        if (active) setItems(docs)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load media')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const filtered = q.trim()
    ? items.filter((m) => `${m.filename || ''} ${m.alt || ''}`.toLowerCase().includes(q.toLowerCase()))
    : items

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-border p-3">
          <h3 className="text-sm font-semibold">Select existing media</h3>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search filename / alt…"
            className="ml-auto w-48 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-3">
          {loading ? (
            <p className="p-6 text-center text-xs text-muted-foreground">Loading media…</p>
          ) : error ? (
            <p className="p-6 text-center text-xs text-red-500">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              {items.length === 0 ? 'No images in the library yet — upload one instead.' : 'No matches.'}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => m.url && onSelect({ id: m.id, url: m.url })}
                  title={m.filename || String(m.id)}
                  className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted/30 hover:border-primary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb(m)} alt={m.alt || m.filename || ''} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
