'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Unread badges and the read marker.
 *
 * `useChat` already polls, but only for the channel you are LOOKING at — it
 * knows nothing about your other channels, which is exactly where unread lives.
 * So this is its own loop, and a slow one: nobody needs sub-minute precision on
 * "there is something in #general".
 */

/** How often to ask for counts. Deliberately slow — this is ambient, not live. */
const UNREAD_POLL_MS = 20_000

/**
 * How long you must sit in a channel before it counts as read. Marking the
 * instant a channel opens means an accidental click clears a badge you wanted.
 */
const MARK_READ_DELAY_MS = 1_500

export interface ReadStateApi {
  /** channel slug → unread count, already capped by the server. */
  unread: Record<string, number>
  /** Server's cap, so the UI can render "99+" rather than a bare 99. */
  cap: number
  /** The mark the active channel had when you opened it — the divider anchor. */
  lastReadAt: string | null
  /** Force a channel to "read up to now". Safe to call often; monotonic server-side. */
  markRead: (channel: string) => void
  /** Drop a channel's badge immediately, before the next poll confirms it. */
  clearLocal: (channel: string) => void
}

export function useReadState(channelSlugs: string[], activeChannel: string, enabled = true): ReadStateApi {
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [cap, setCap] = useState(99)
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)

  // The slug list changes identity on every render of the parent; comparing the
  // JOINED string keeps the poll from restarting on each one.
  const key = channelSlugs.slice().sort().join(',')
  const keyRef = useRef(key)
  keyRef.current = key

  const fetchUnread = useCallback(async () => {
    const slugs = keyRef.current
    if (!slugs) return
    try {
      const res = await fetch(`/api/chat/unread?channels=${encodeURIComponent(slugs)}`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const data = (await res.json()) as { unread?: Record<string, number>; cap?: number }
      setUnread(data.unread || {})
      if (typeof data.cap === 'number') setCap(data.cap)
    } catch {
      // Ambient decoration. A failed poll should never surface as an error the
      // reader has to dismiss; the next tick tries again.
    }
  }, [])

  useEffect(() => {
    if (!enabled || !key) return
    void fetchUnread()
    const id = setInterval(() => void fetchUnread(), UNREAD_POLL_MS)
    return () => clearInterval(id)
  }, [enabled, key, fetchUnread])

  const clearLocal = useCallback((channel: string) => {
    setUnread((prev) => (prev[channel] ? { ...prev, [channel]: 0 } : prev))
  }, [])

  const markRead = useCallback(
    (channel: string) => {
      if (!channel) return
      clearLocal(channel)
      void fetch('/api/chat/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channel, at: new Date().toISOString() }),
      }).catch(() => {
        // The server merges monotonically, so a dropped mark costs one stale
        // badge until the next visit — not a wrong read state.
      })
    },
    [clearLocal],
  )

  // Opening a channel marks it read, after a beat. The divider anchor is
  // captured BEFORE the mark, or "new since" would always be "since now".
  useEffect(() => {
    if (!enabled || !activeChannel) return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/users/me', { credentials: 'include' })
        const data = (await res.json()) as { user?: { readState?: Record<string, string> } }
        if (!cancelled) setLastReadAt(data?.user?.readState?.[activeChannel] ?? null)
      } catch {
        if (!cancelled) setLastReadAt(null)
      }
    })()

    const id = setTimeout(() => markRead(activeChannel), MARK_READ_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [enabled, activeChannel, markRead])

  // While you are sitting in a channel, keep the mark current so messages that
  // arrive under your nose do not come back as unread the moment you leave.
  useEffect(() => {
    if (!enabled || !activeChannel) return
    const id = setInterval(() => markRead(activeChannel), UNREAD_POLL_MS)
    return () => clearInterval(id)
  }, [enabled, activeChannel, markRead])

  return { unread, cap, lastReadAt, markRead, clearLocal }
}
