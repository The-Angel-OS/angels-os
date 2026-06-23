'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

/**
 * MerlinConsole — talk to a node's LOCAL brain from MerlinControl, as the logged-in user.
 *
 * Your prompt rides the bus (POST /api/node-ops/chat → node-command) into the node's
 * runAgent (local brain + tool belt); the reply comes back as a message we poll for.
 * Async by nature — the node answers in a few seconds, only while it's online.
 */
type Turn = { id: string | number; role: string; text: string; at: string }

export function MerlinConsole({ endeavor, nodeId, online }: { endeavor: string; nodeId: string; online: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Live online from our own 3s poll — the render-time `online` prop goes stale the
  // moment the node heartbeats (or stops). The poll is the source of truth.
  const [liveOnline, setLiveOnline] = useState(online)
  const endRef = useRef<HTMLDivElement>(null)

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/node-ops/chat?endeavor=${encodeURIComponent(endeavor)}&nodeId=${encodeURIComponent(nodeId)}`, { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      if (typeof d.online === 'boolean') setLiveOnline(d.online)
      // Fetch the full transcript and REPLACE — dedup by construction (no append → no echoes).
      if (Array.isArray(d.messages)) setTurns(d.messages)
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
    setError(null)
    try {
      const r = await fetch('/api/node-ops/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endeavor, nodeId, message }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        setError(e.error || `error ${r.status}`)
      } else {
        await poll() // surface the user turn quickly; the reply lands on a later poll
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-sm font-medium">Merlin Console · {nodeId}</div>
        <span className={`flex items-center gap-1.5 text-xs ${liveOnline ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${liveOnline ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
          {liveOnline ? 'online · local brain' : 'offline — answers when the node is up'}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask this Merlin anything about itself — its files, config, or status. It runs your
            request through its own brain and tools on the box.
          </p>
        ) : (
          turns.map((t) => (
            <div key={t.id} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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

      {error ? (
        <div className="border-t border-border px-3 py-2 text-xs text-red-500 dark:text-red-400">⚠ {error}</div>
      ) : null}

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
