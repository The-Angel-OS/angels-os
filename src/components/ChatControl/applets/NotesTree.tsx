'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Pencil,
  Loader2,
} from 'lucide-react'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || ''

/** A single note in the channel's note hierarchy (stored in Channels.data.notes). */
interface NoteNode {
  id: string
  title: string
  content: string
  parentId: string | null
  order: number
  collapsed?: boolean
}

type DropPos = 'before' | 'after' | 'inside'

interface NotesTreeProps {
  /** Numeric channel id — notes persist to Channels.data.notes via PATCH. */
  channelId?: string | number
}

function uid(): string {
  // Deterministic-enough unique id without Math.random/Date in module scope.
  return 'n_' + Math.abs(Date.now() ^ (performance.now() * 1000)).toString(36) + '_' + Math.floor(performance.now()).toString(36)
}

function isDescendant(notes: NoteNode[], nodeId: string, maybeAncestorId: string): boolean {
  const byId = new Map(notes.map((n) => [n.id, n]))
  let cur = byId.get(nodeId)
  while (cur?.parentId) {
    if (cur.parentId === maybeAncestorId) return true
    cur = byId.get(cur.parentId)
  }
  return false
}

/** Reassign sequential order within each parent group. */
function renormalize(notes: NoteNode[]): NoteNode[] {
  const groups = new Map<string, NoteNode[]>()
  for (const n of notes) {
    const k = n.parentId ?? '__root__'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(n)
  }
  const out: NoteNode[] = []
  for (const list of groups.values()) {
    list.sort((a, b) => a.order - b.order)
    list.forEach((n, i) => out.push({ ...n, order: i }))
  }
  return out
}

export function NotesTree({ channelId }: NotesTreeProps) {
  const [notes, setNotes] = useState<NoteNode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: DropPos } | null>(null)

  // Full channel.data so we never clobber sibling widget state (tasks, etc.).
  const dataRef = useRef<Record<string, unknown>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!channelId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${SERVER_URL}/api/channels/${channelId}?depth=0`, {
          credentials: 'include',
        })
        if (!res.ok) throw new Error(`Failed to load notes (${res.status})`)
        const doc = await res.json()
        const data = (doc?.data && typeof doc.data === 'object' ? doc.data : {}) as Record<string, unknown>
        dataRef.current = data
        const loaded = Array.isArray(data.notes) ? (data.notes as NoteNode[]) : []
        if (!cancelled) setNotes(renormalize(loaded))
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [channelId])

  // ── Persist (debounced) ───────────────────────────────────────
  const persist = useCallback(
    (next: NoteNode[]) => {
      if (!channelId) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaving(true)
        try {
          const body = { data: { ...dataRef.current, notes: next } }
          const res = await fetch(`${SERVER_URL}/api/channels/${channelId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error(`Save failed (${res.status})`)
          dataRef.current = { ...dataRef.current, notes: next }
        } catch (e) {
          setError((e as Error).message)
        } finally {
          setSaving(false)
        }
      }, 600)
    },
    [channelId],
  )

  const update = useCallback(
    (next: NoteNode[]) => {
      const normalized = renormalize(next)
      setNotes(normalized)
      persist(normalized)
    },
    [persist],
  )

  // ── Operations ────────────────────────────────────────────────
  const addNote = useCallback(
    (parentId: string | null) => {
      const id = uid()
      const siblings = notes.filter((n) => n.parentId === parentId)
      const node: NoteNode = {
        id,
        title: 'Untitled',
        content: '',
        parentId,
        order: siblings.length,
      }
      update([...notes, node])
      setSelectedId(id)
      setEditing(true)
    },
    [notes, update],
  )

  const deleteNote = useCallback(
    (id: string) => {
      // Remove the node and all descendants.
      const toRemove = new Set<string>([id])
      let grew = true
      while (grew) {
        grew = false
        for (const n of notes) {
          if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
            toRemove.add(n.id)
            grew = true
          }
        }
      }
      update(notes.filter((n) => !toRemove.has(n.id)))
      if (selectedId && toRemove.has(selectedId)) setSelectedId(null)
    },
    [notes, update, selectedId],
  )

  const patchNote = useCallback(
    (id: string, patch: Partial<NoteNode>) => {
      update(notes.map((n) => (n.id === id ? { ...n, ...patch } : n)))
    },
    [notes, update],
  )

  const toggleCollapse = useCallback(
    (id: string) => {
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, collapsed: !n.collapsed } : n)))
    },
    [],
  )

  // ── Drag & drop ───────────────────────────────────────────────
  const handleDrop = useCallback(
    (targetId: string, pos: DropPos) => {
      if (!dragId || dragId === targetId) return
      if (isDescendant(notes, targetId, dragId)) return // can't nest into own subtree

      const moving = notes.find((n) => n.id === dragId)
      const target = notes.find((n) => n.id === targetId)
      if (!moving || !target) return

      let newParent: string | null
      let newOrder: number
      if (pos === 'inside') {
        newParent = target.id
        newOrder = notes.filter((n) => n.parentId === target.id).length
      } else {
        newParent = target.parentId
        const sib = notes
          .filter((n) => n.parentId === target.parentId && n.id !== dragId)
          .sort((a, b) => a.order - b.order)
        const idx = sib.findIndex((n) => n.id === target.id)
        newOrder = (pos === 'before' ? idx : idx + 1) - 0.5
      }
      update(notes.map((n) => (n.id === dragId ? { ...n, parentId: newParent, order: newOrder } : n)))
      setDragId(null)
      setDropTarget(null)
    },
    [dragId, notes, update],
  )

  const tree = useMemo(() => {
    const childrenOf = (pid: string | null) =>
      notes.filter((n) => n.parentId === pid).sort((a, b) => a.order - b.order)
    return { childrenOf }
  }, [notes])

  const selected = selectedId ? notes.find((n) => n.id === selectedId) : null

  // ── Render a tree row (recursive) ─────────────────────────────
  const renderNode = (node: NoteNode, depth: number): React.ReactNode => {
    const kids = tree.childrenOf(node.id)
    const hasKids = kids.length > 0
    const isDrop = dropTarget?.id === node.id
    return (
      <div key={node.id}>
        <div
          draggable
          onDragStart={() => setDragId(node.id)}
          onDragEnd={() => {
            setDragId(null)
            setDropTarget(null)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            const rect = e.currentTarget.getBoundingClientRect()
            const y = e.clientY - rect.top
            const pos: DropPos = y < rect.height * 0.28 ? 'before' : y > rect.height * 0.72 ? 'after' : 'inside'
            setDropTarget({ id: node.id, pos })
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (dropTarget) handleDrop(dropTarget.id, dropTarget.pos)
          }}
          onClick={() => {
            setSelectedId(node.id)
            setEditing(false)
          }}
          className={`group/note flex items-center gap-1 rounded-md py-1 pr-1 text-sm cursor-pointer transition-colors ${
            selectedId === node.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
          } ${isDrop && dropTarget?.pos === 'inside' ? 'ring-1 ring-primary' : ''}`}
          style={{ paddingLeft: depth * 14 + 4 }}
        >
          {isDrop && dropTarget?.pos === 'before' && <div className="absolute -mt-3 h-0.5 w-full bg-primary" />}
          <GripVertical
            size={12}
            className="shrink-0 text-muted-foreground/30 opacity-0 group-hover/note:opacity-100"
          />
          {hasKids ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleCollapse(node.id)
              }}
              className="shrink-0 text-muted-foreground"
            >
              {node.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
          ) : (
            <span className="w-[13px] shrink-0" />
          )}
          <FileText size={12} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{node.title || 'Untitled'}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              addNote(node.id)
            }}
            title="Add sub-note"
            className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover/note:opacity-100"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteNote(node.id)
            }}
            title="Delete"
            className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover/note:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        </div>
        {!node.collapsed && hasKids && <div>{kids.map((k) => renderNode(k, depth + 1))}</div>}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 size={18} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Tree pane */}
      <div className="flex w-64 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </span>
          <div className="flex items-center gap-1.5">
            {saving && <Loader2 size={11} className="animate-spin text-muted-foreground" />}
            <button
              onClick={() => addNote(null)}
              title="New note"
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div
          className="relative flex-1 overflow-y-auto p-1.5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            // Drop on empty area → move to root end.
            e.preventDefault()
            if (dragId) {
              update(
                notes.map((n) =>
                  n.id === dragId ? { ...n, parentId: null, order: notes.length } : n,
                ),
              )
              setDragId(null)
              setDropTarget(null)
            }
          }}
        >
          {notes.length === 0 ? (
            <button
              onClick={() => addNote(null)}
              className="m-2 rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              + Create your first note
            </button>
          ) : (
            tree.childrenOf(null).map((n) => renderNode(n, 0))
          )}
        </div>
        {error && <p className="border-t border-border px-3 py-1 text-[10px] text-destructive">{error}</p>}
      </div>

      {/* Editor / viewer pane */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <input
                value={selected.title}
                onChange={(e) => patchNote(selected.id, { title: e.target.value })}
                placeholder="Untitled"
                className="flex-1 bg-transparent text-base font-semibold outline-none"
              />
              <button
                onClick={() => setEditing((v) => !v)}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                {editing ? <Eye size={13} /> : <Pencil size={13} />}
                {editing ? 'Preview' : 'Edit'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {editing ? (
                <textarea
                  value={selected.content}
                  onChange={(e) => patchNote(selected.id, { content: e.target.value })}
                  placeholder="Write in markdown…"
                  className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm outline-none"
                />
              ) : (
                <article className="prose prose-sm dark:prose-invert max-w-none p-4">
                  {selected.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.content}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground">Empty note. Click Edit to write.</p>
                  )}
                </article>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <FileText size={28} className="mb-3 opacity-40" />
            <p className="text-sm">Select a note, or create one.</p>
            <p className="mt-1 max-w-xs text-xs">
              Drag notes to reorder or nest them. Markdown supported. Stored with the channel.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
