'use client'

/**
 * PageComments — "the page is a channel on the AI bus."
 *
 * A togglable comments popup whose channel is derived from the current route
 * (`page:<path>`). It reads via /api/ai-bus/poll and posts via /api/chat/send —
 * zero new infrastructure: the page literally becomes a conversation surface on
 * the same bus everything else (and LEO) lives on. First plank of the
 * conversational console.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquare, X, Send, Loader2, Flag, Trash2 } from 'lucide-react'
import { useAuth } from '@/providers/Auth'

// Same-origin (relative): NEXT_PUBLIC_SERVER_URL is baked at build time to the
// canonical origin, so on a tenant subdomain it would fetch cross-origin (CORS
// "Failed to fetch") and drop the subdomain session cookie. Empty = current host.
// (Mirrors the fix already applied in useChat.ts.)
const SERVER_URL = ''

// Decaying poll: fast when the conversation is live, backing off when quiet, so
// an idle open panel isn't hammering the bus. Resets on new messages / activity.
const POLL_BASE_MS = 4000
const POLL_MAX_MS = 30000
const POLL_DECAY = 1.5

interface BusMessage {
  id: string
  author?: unknown
  content?: unknown
  createdAt?: string
}

const textOf = (content: unknown): string => {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object' && typeof (content as { text?: unknown }).text === 'string') {
    return (content as { text: string }).text
  }
  return ''
}
const nameOf = (author: unknown): string => {
  if (author && typeof author === 'object') {
    const a = author as { name?: string; email?: string }
    return a.name || a.email || 'Someone'
  }
  return 'Someone'
}
const idOf = (author: unknown): string | undefined => {
  if (author && typeof author === 'object') {
    const id = (author as { id?: string | number }).id
    return id != null ? String(id) : undefined
  }
  return author != null ? String(author) : undefined
}
// Strip a leading /xx locale segment so a page channel is stable across locales.
const pageChannel = (pathname: string): string =>
  'page:' + (pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/')

export function PageComments({ spaceId }: { spaceId?: string }) {
  const pathname = usePathname() || '/'
  const { user } = useAuth()
  const channel = useMemo(() => pageChannel(pathname), [pathname])

  const userId = idOf(user)
  const roles = (user as { roles?: string[] } | null)?.roles
  const isAdmin = Array.isArray(roles) && (roles.includes('admin') || roles.includes('super_admin'))

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<BusMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reported, setReported] = useState<Set<string>>(new Set())
  const listRef = useRef<HTMLDivElement>(null)
  const pollDelayRef = useRef(POLL_BASE_MS)
  const lastSigRef = useRef('')

  const resetPoll = useCallback(() => {
    pollDelayRef.current = POLL_BASE_MS
  }, [])

  const load = useCallback(async (): Promise<BusMessage[] | null> => {
    if (!spaceId || !user) return null
    setLoading(true)
    try {
      const url = `${SERVER_URL}/api/ai-bus/poll?spaceId=${encodeURIComponent(spaceId)}&channel=${encodeURIComponent(channel)}&limit=100`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      const data = await res.json()
      const msgs: BusMessage[] = Array.isArray(data.messages) ? data.messages : []
      setMessages(msgs)
      setError(null) // recovered — clear any stale error so a transient blip doesn't stick
      return msgs
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setLoading(false)
    }
  }, [spaceId, user, channel])

  // Decaying poll while open: reset to the fast cadence on new messages, otherwise
  // back off toward POLL_MAX. Resets when the route (channel) changes.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    pollDelayRef.current = POLL_BASE_MS
    const tick = async () => {
      const msgs = await load()
      if (cancelled) return
      const sig = msgs ? msgs.map((m) => m.id).join(',') : lastSigRef.current
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig
        pollDelayRef.current = POLL_BASE_MS // fresh activity → poll fast again
      } else {
        pollDelayRef.current = Math.min(POLL_MAX_MS, pollDelayRef.current * POLL_DECAY)
      }
      timer = setTimeout(tick, pollDelayRef.current)
    }
    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [open, load])
  useEffect(() => {
    setMessages([])
  }, [channel])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || !spaceId || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`${SERVER_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ space: spaceId, channel, content: { text }, messageType: 'user' }),
      })
      if (!res.ok) throw new Error(`Send failed (${res.status})`)
      setDraft('')
      resetPoll() // expect a reply soon → poll fast
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }, [draft, spaceId, channel, sending, load, resetPoll])

  // Moderation: delete (own or admin, via Payload REST which enforces access) and
  // flag/report (any user, non-destructive → moves the message to pending).
  const deleteComment = useCallback(async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this comment?')) return
    try {
      const res = await fetch(`${SERVER_URL}/api/messages/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      setMessages((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const flagComment = useCallback(async (id: string) => {
    setReported((prev) => new Set(prev).add(id)) // optimistic
    try {
      const res = await fetch(`${SERVER_URL}/api/comment-ops/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageId: id }),
      })
      if (!res.ok) throw new Error(`Report failed (${res.status})`)
    } catch (e) {
      setReported((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setError((e as Error).message)
    }
  }, [])

  if (!spaceId) return null

  return (
    <>
      {/* Toggle — sits to the left of the floating chat bubble */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close page comments' : 'Open page comments'}
        className="fixed bottom-5 right-20 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-transform hover:scale-105"
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Comments on this page</p>
              <p className="truncate text-[11px] text-muted-foreground">{channel}</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!user ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-40" />
              <p>Sign in to read and join the conversation on this page.</p>
              <a href="/login" className="font-medium text-primary hover:underline">Sign in</a>
            </div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {loading && messages.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground">No comments yet. Start the conversation.</p>
                ) : (
                  messages.map((m) => {
                    const own = Boolean(userId && idOf(m.author) === userId)
                    const canDelete = own || isAdmin
                    return (
                      <div key={m.id} className="group text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-medium">{nameOf(m.author)}</span>
                            {m.createdAt && (
                              <span className="ml-2 text-[10px] text-muted-foreground">
                                {new Date(m.createdAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          {/* Moderation controls — appear on hover */}
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {reported.has(m.id) ? (
                              <span className="text-[10px] text-amber-500">Reported</span>
                            ) : (
                              !own && (
                                <button
                                  onClick={() => flagComment(m.id)}
                                  title="Report this comment"
                                  className="text-muted-foreground hover:text-amber-500"
                                >
                                  <Flag className="h-3.5 w-3.5" />
                                </button>
                              )
                            )}
                            {canDelete && (
                              <button
                                onClick={() => deleteComment(m.id)}
                                title="Delete this comment"
                                className="text-muted-foreground hover:text-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-foreground/90">{textOf(m.content)}</p>
                      </div>
                    )
                  })
                )}
              </div>

              {error && <p className="px-4 pb-1 text-xs text-red-500">{error}</p>}

              <div className="flex items-end gap-2 border-t border-border p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onFocus={resetPoll}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  rows={1}
                  placeholder="Add a comment…"
                  className="max-h-24 min-h-[2.25rem] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  aria-label="Send comment"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
