'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'

interface LogEntry {
  id: string
  content: string
  author: string
  createdAt: string
  stardate: string
}

function toStardate(dateStr: string): string {
  const d = new Date(dateStr)
  const start = new Date(d.getFullYear(), 0, 0)
  const day = Math.floor((d.getTime() - start.getTime()) / 86400000)
  return `${d.getFullYear()}.${String(day).padStart(3, '0')}`
}

function extractPlainText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!content || typeof content !== 'object') return ''

  // Handle Payload richText (Lexical) format
  const obj = content as Record<string, unknown>

  // If it has a root with children (Lexical format)
  if (obj.root && typeof obj.root === 'object') {
    const root = obj.root as Record<string, unknown>
    if (Array.isArray(root.children)) {
      return root.children
        .map((node: Record<string, unknown>) => {
          if (Array.isArray(node.children)) {
            return node.children
              .map((child: Record<string, unknown>) => child.text || '')
              .join('')
          }
          return node.text || ''
        })
        .filter(Boolean)
        .join(' ')
    }
  }

  // Simple text field
  if (obj.text) return String(obj.text)

  return JSON.stringify(content).slice(0, 100)
}

export function OfficerLog() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchLog = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/messages?where[messageType][equals]=ai_agent&limit=20&sort=-createdAt&depth=1', { signal })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      const docs = data.docs || []
      setEntries(
        docs.map((msg: Record<string, unknown>) => {
          const author =
            msg.author && typeof msg.author === 'object'
              ? ((msg.author as Record<string, unknown>).name as string) ||
                ((msg.author as Record<string, unknown>).email as string) ||
                'LEO'
              : 'LEO'
          return {
            id: String(msg.id),
            content: extractPlainText(msg.content),
            author,
            createdAt: String(msg.createdAt),
            stardate: toStardate(String(msg.createdAt)),
          }
        }),
      )
    } catch {
      // API may not be available yet or request aborted — show empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchLog(controller.signal)
    const interval = setInterval(() => fetchLog(controller.signal), 30000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [fetchLog])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: 'var(--lcars-blue)' }}
        >
          Officer Log
        </p>
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: 'var(--lcars-green)',
              animation: 'lcars-heartbeat 2s ease-in-out infinite',
            }}
          />
          <span className="text-[9px] font-mono uppercase" style={{ color: 'var(--lcars-text-muted)' }}>
            Live Feed
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="space-y-1.5 max-h-[400px] overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div
              className="w-4 h-4 rounded-full animate-pulse"
              style={{ background: 'var(--lcars-amber)' }}
            />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <p
            className="text-xs font-mono text-center py-6"
            style={{ color: 'var(--lcars-text-muted)' }}
          >
            No officer log entries. LEO has not filed any reports yet.
          </p>
        )}

        {entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded px-3 py-2"
            style={{ background: 'rgba(17, 17, 34, 0.5)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[9px] font-mono uppercase"
                style={{ color: 'var(--lcars-amber)' }}
              >
                SD {entry.stardate}
              </span>
              <span className="text-[9px] font-mono" style={{ color: 'var(--lcars-text-muted)' }}>
                {entry.author}
              </span>
            </div>
            <p
              className="text-xs font-mono leading-relaxed line-clamp-2"
              style={{ color: 'var(--lcars-text)' }}
            >
              {entry.content || 'Log entry recorded.'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
