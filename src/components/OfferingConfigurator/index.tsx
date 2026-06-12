'use client'

/**
 * OfferingConfigurator — one configurator shell for every catalog offering kind.
 *
 * Products / Services / Quests are three `kind`s of the same primitive (buy / book /
 * work). This schema-driven form gives owners in-dashboard CRUD for any of them:
 * pass a field schema + the target Payload collection and it renders a list +
 * create/edit form, writing through the Payload REST API. Services and Quests both
 * use it with different `fields`. (Products keeps its richer manager for now.)
 *
 * @see src/collections/Services  @see src/collections/Quests
 */
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox'

export interface FieldDef {
  /** Field name; dot-paths (e.g. "payout.amount") map to nested objects on submit. */
  name: string
  label: string
  type: FieldType
  options?: { label: string; value: string }[]
  required?: boolean
  help?: string
  placeholder?: string
}

export interface OfferingConfiguratorProps {
  kind: string // singular, e.g. "service" | "quest"
  collection: string // Payload slug, e.g. "services" | "quests"
  titleField: string // which field labels a row (e.g. "label" | "title")
  fields: FieldDef[]
  items: Record<string, any>[] // existing rows (serialized)
  tenantId: number | string
  /** Flat dot-path defaults for a NEW item (e.g. { status: 'draft' }). */
  newDefaults?: Record<string, any>
  /** Optional note rendered under the form (e.g. "advanced fields in admin"). */
  note?: string
}

// ── dot-path helpers ──────────────────────────────────────────────────────────
function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}
function setPath(target: any, path: string, value: any): void {
  const keys = path.split('.')
  let o = target
  for (let i = 0; i < keys.length - 1; i++) {
    o[keys[i]] = o[keys[i]] ?? {}
    o = o[keys[i]]
  }
  o[keys[keys.length - 1]] = value
}

export function OfferingConfigurator(props: OfferingConfiguratorProps) {
  const { kind, collection, titleField, fields, items, tenantId, newDefaults, note } = props
  const router = useRouter()
  const [editing, setEditing] = useState<Record<string, any> | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startNew = () => {
    setEditing({})
    setForm({ ...(newDefaults || {}) })
    setError(null)
  }
  const startEdit = (item: Record<string, any>) => {
    const f: Record<string, any> = {}
    for (const fd of fields) f[fd.name] = getPath(item, fd.name)
    setEditing(item)
    setForm(f)
    setError(null)
  }
  const cancel = () => { setEditing(null); setForm({}); setError(null) }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      // Expand dot-path form keys into a nested body; coerce number fields.
      const body: Record<string, any> = { tenant: tenantId }
      for (const fd of fields) {
        let v = form[fd.name]
        if (fd.type === 'number') v = v === '' || v == null ? undefined : Number(v)
        if (fd.type === 'checkbox') v = Boolean(v)
        if (v !== undefined) setPath(body, fd.name, v)
      }
      const isNew = !editing?.id
      const res = await fetch(`/api/${collection}${isNew ? '' : `/${editing!.id}`}`, {
        method: isNew ? 'POST' : 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.errors?.[0]?.message || `Save failed (${res.status})`)
      }
      cancel()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (item: Record<string, any>) => {
    if (!confirm(`Delete this ${kind}?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/${collection}/${item.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} {kind}{items.length === 1 ? '' : 's'}</p>
        {!editing && (
          <button onClick={startNew} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            + New {kind}
          </button>
        )}
      </div>

      {editing && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider">{editing.id ? `Edit ${kind}` : `New ${kind}`}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((fd) => (
              <label key={fd.name} className={`flex flex-col gap-1 text-sm ${fd.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                <span className="font-medium">{fd.label}{fd.required ? ' *' : ''}</span>
                {fd.type === 'textarea' ? (
                  <textarea rows={3} className="rounded-md border border-border bg-background px-2 py-1.5"
                    value={form[fd.name] ?? ''} placeholder={fd.placeholder}
                    onChange={(e) => setForm((s) => ({ ...s, [fd.name]: e.target.value }))} />
                ) : fd.type === 'select' ? (
                  <select className="rounded-md border border-border bg-background px-2 py-1.5"
                    value={form[fd.name] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [fd.name]: e.target.value }))}>
                    <option value="">—</option>
                    {fd.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : fd.type === 'checkbox' ? (
                  <input type="checkbox" className="h-4 w-4" checked={Boolean(form[fd.name])}
                    onChange={(e) => setForm((s) => ({ ...s, [fd.name]: e.target.checked }))} />
                ) : (
                  <input type={fd.type === 'number' ? 'number' : 'text'} className="rounded-md border border-border bg-background px-2 py-1.5"
                    value={form[fd.name] ?? ''} placeholder={fd.placeholder}
                    onChange={(e) => setForm((s) => ({ ...s, [fd.name]: e.target.value }))} />
                )}
                {fd.help && <span className="text-xs text-muted-foreground">{fd.help}</span>}
              </label>
            ))}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
          <div className="flex gap-2">
            <button disabled={busy} onClick={save} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button disabled={busy} onClick={cancel} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">Cancel</button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.length === 0 && <li className="p-4 text-sm text-muted-foreground">No {kind}s yet — create your first one.</li>}
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{getPath(item, titleField) || `(untitled ${kind})`}</p>
              <p className="truncate text-xs text-muted-foreground">{summary(kind, item)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => startEdit(item)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">Edit</button>
              <button onClick={() => remove(item)} className="rounded-md border border-border px-2 py-1 text-xs text-red-500 hover:bg-accent">Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A short one-line summary per kind for the list rows. */
function summary(kind: string, item: Record<string, any>): string {
  if (kind === 'service') {
    const price = item.priceUsd != null ? `$${item.priceUsd}` : '—'
    return `${price} · ${item.durationMinutes ?? '?'} min · ${item.enabled === false ? 'hidden' : 'enabled'}`
  }
  if (kind === 'quest') {
    const amt = getPath(item, 'payout.amount')
    return `${item.status ?? 'draft'}${amt != null ? ` · ${amt}¢ payout` : ''}`
  }
  return ''
}
