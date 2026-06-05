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
import { MessageSquare, X, Send, Loader2 } from 'lucide-react'
import { useAuth } from '@/providers/Auth'

// Same-origin (relative): NEXT_PUBLIC_SERVER_URL is baked at build time to the
// canonical origin, so on a tenant subdomain it would fetch cross-origin (CORS
// "Failed to fetch") and drop the subdomain session cookie. Empty = current host.
// (Mirrors the fix already applied in useChat.ts.)
const SERVER_URL = ''

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
// Strip a leading /xx locale segment so a page channel is stable across locales.
const pageChannel = (pathname: string): string =>
  'page:' + (pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/')

export function PageComments({ spaceId }: { spaceId?: string }) {
  const pathname = usePathname() || '/'
  const { user } = useAuth()
  const channel = useMemo(() => pageChannel(pathname), [pathname])

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<BusMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!spaceId || !user) return
    setLoading(true)
    try {
      const url = `${SERVER_URL}/api/ai-bus/poll?spaceId=${encodeURIComponent(spaceId)}&channel=${encodeURIComponent(channel)}&limit=100`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      const data = await res.json()
      setMessages(Array.isArray(data.messages) ? data.messages : [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [spaceId, user, channel])

  // Load on open + light poll while open; reset when the route (channel) changes.
  useEffect(() => {
    if (!open) return
    load()
    const t = setInterval(load, 6000)
    return () => clearInterval(t)
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
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }, [draft, spaceId, channel, sending, load])

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
                  messages.map((m) => (
                    <div key={m.id} className="text-sm">
                      <span className="font-medium">{nameOf(m.author)}</span>
                      {m.createdAt && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          {new Date(m.createdAt).toLocaleString()}
                        </span>
                      )}
                      <p className="mt-0.5 whitespace-pre-wrap text-foreground/90">{textOf(m.content)}</p>
                    </div>
                  ))
                )}
              </div>

              {error && <p className="px-4 pb-1 text-xs text-red-500">{error}</p>}

              <div className="flex items-end gap-2 border-t border-border p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
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
