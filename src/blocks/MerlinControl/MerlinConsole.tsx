'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Check, Volume2, VolumeX } from 'lucide-react'

/**
 * MerlinConsole — talk to a node's LOCAL brain from MerlinControl, as the logged-in user.
 *
 * Your prompt rides the bus (POST /api/node-ops/chat → node-command) into the node's
 * runAgent (local brain + tool belt); the reply comes back as a message we poll for.
 * Async by nature — the node answers in a few seconds, only while it's online.
 */
type Turn = { id: string | number; role: string; text: string; at: string }

/** How many turns to show before "Show earlier" (default-hide older, standard chat UX). */
const INITIAL_VISIBLE = 15
/** How many chars before a message collapses behind "Show more". */
const COLLAPSE_CHARS = 700

/**
 * Strip machine plumbing so the console shows prose, not payloads:
 *  - the `@@ANGELS_RESULT@@:<id>:<json>` sentinel a node embeds for structured skill
 *    results (the file browser greps it out separately — it must never render)
 *  - the trailing `_(request <id>)_` correlation marker
 */
function cleanText(text: string): string {
  let s = text || ''
  const i = s.indexOf('@@ANGELS_RESULT@@')
  if (i >= 0) s = s.slice(0, i)
  s = s.replace(/\n*_\(request [^)]*\)_\s*$/i, '')
  return s.trim()
}

/** One console bubble: long messages collapse; hover reveals Copy + Speak (device TTS). */
function ConsoleBubble({ role, text }: { role: string; text: string }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const speakingRef = useRef(false)
  const isUser = role === 'user'
  const long = text.length > COLLAPSE_CHARS
  const shown = long && !expanded ? text.slice(0, COLLAPSE_CHARS).trimEnd() + '…' : text

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable */
    }
  }
  const speak = () => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!synth) return
    if (speakingRef.current) { synth.cancel(); return }
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.onend = () => { speakingRef.current = false; setSpeaking(false) }
    u.onerror = () => { speakingRef.current = false; setSpeaking(false) }
    speakingRef.current = true
    setSpeaking(true)
    synth.speak(u)
  }
  useEffect(() => () => { if (speakingRef.current) window.speechSynthesis?.cancel() }, [])

  return (
    <div className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
          isUser ? 'bg-primary/10 text-foreground' : 'bg-muted text-foreground/90'
        }`}
      >
        {shown}
        {long && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 block text-[10px] font-medium uppercase tracking-wide text-primary hover:underline"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
      <div className={`mt-1 flex items-center gap-0.5 px-1 opacity-0 transition-opacity group-hover:opacity-100 ${isUser ? 'flex-row-reverse' : ''}`}>
        <button onClick={copy} title="Copy" aria-label="Copy message" className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </button>
        <button onClick={speak} title={speaking ? 'Stop' : 'Speak'} aria-label={speaking ? 'Stop speaking' : 'Speak message'} className={`rounded p-1 transition-colors hover:bg-muted ${speaking ? 'text-green-500' : 'text-muted-foreground hover:text-foreground'}`}>
          {speaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
        </button>
      </div>
    </div>
  )
}

export function MerlinConsole({ endeavor, nodeId, online }: { endeavor: string; nodeId: string; online: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(INITIAL_VISIBLE)
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

  // Clean the plumbing out + drop turns that were pure payload (nothing left to show).
  const cleaned = useMemo(
    () => turns.map((t) => ({ ...t, text: cleanText(t.text) })).filter((t) => t.text),
    [turns],
  )
  const shownTurns = cleaned.slice(-visible)
  const hidden = cleaned.length - shownTurns.length

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [shownTurns.length])

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
        {cleaned.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask this Merlin anything about itself — its files, config, or status. It runs your
            request through its own brain and tools on the box.
          </p>
        ) : (
          <>
            {hidden > 0 && (
              <div className="flex justify-center pb-1">
                <button
                  onClick={() => setVisible((v) => v + 25)}
                  className="rounded-full border border-border px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
                >
                  Show earlier ({hidden} more)
                </button>
              </div>
            )}
            {shownTurns.map((t) => (
              <ConsoleBubble key={t.id} role={t.role} text={t.text} />
            ))}
          </>
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
