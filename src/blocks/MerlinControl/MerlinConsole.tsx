'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

/**
 * MerlinConsole — talk to a node's LOCAL brain from MerlinControl, as the logged-in user.
 *
 * Your prompt rides the bus (POST /api/node-ops/chat → node-command) into the node's
 * runAgent (local brain + tool belt); the reply comes back as a message we poll for.
 * Async by nature — the node answers in a few seconds, only while it's online.
 */
type Turn = { role: string; text: string; at: string }

export function MerlinConsole({ endeavor, nodeId, online }: { endeavor: string; nodeId: string; online: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const cursorRef = useRef<string>('')
  const endRef = useRef<HTMLDivElement>(null)

  const poll = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ endeavor, nodeId })
      if (cursorRef.current) qs.set('since', cursorRef.current)
      const r = await fetch(`/api/node-ops/chat?${qs.toString()}`, { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      if (Array.isArray(d.messages) && d.messages.length) setTurns((prev) => [...prev, ...d.messages])
      if (d.cursor) cursorRef.current = d.cursor
    } catch {
      /* transient */
    }
  }, [endeavor, nodeId])

  useEffect(() => {
    void poll()
    const id = setInterval(() => void poll(), 3000)
    return () => clearInterval(id)
  }, [poll])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns.length])

  const send = async () => {
    const message = input.trim()
    if (!message || sending) return
    setSending(true)
    setInput('')
    try {
      const r = await fetch('/api/node-ops/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endeavor, nodeId, message }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        setTurns((prev) => [...prev, { role: 'assistant', text: `⚠ ${e.error || `error ${r.status}`}`, at: new Date().toISOString() }])
      }
      await poll() // surface the user turn quickly; the reply lands on a later poll
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[55vh] flex-col rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-sm font-medium">Merlin Console · {nodeId}</div>
        <span className={`flex items-center gap-1.5 text-xs ${online ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
          {online ? 'online · local brain' : 'offline — answers when the node is up'}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask this Merlin anything about itself — its files, config, or status. It runs your
            request through its own brain and tools on the box.
          </p>
        ) : (
          turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  t.role === 'user' ? 'bg-primary/10 text-foreground' : 'bg-muted text-foreground/90'
                }`}
              >
                {t.text}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 border-t border-border p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder={`Message ${nodeId}…`}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
