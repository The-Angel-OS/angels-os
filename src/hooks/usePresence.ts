'use client'

import { useCallback, useEffect, useState } from 'react'

export interface OnlineUser {
  userId: number | string
  name: string | null
  email: string | null
  status: string
  lastSeenAt: string
  spaceId: number | string | null
}

interface UsePresenceOptions {
  /** Only ping/poll when true (e.g. logged in). */
  enabled?: boolean
  /** Scope presence to a space (for per-space "N online"); null = global. */
  spaceId?: number | string | null
  /**
   * When false, only POLL (read) — never ping. Use for read-only consumers
   * (e.g. a member panel) so they don't fight the single global pinger over the
   * user's presence row.
   */
  ping?: boolean
  pingMs?: number
  pollMs?: number
}

/**
 * Presence heartbeat + roster. Marks the current user online (~30s, focus-aware)
 * and polls who else is online. The foundation of the dashboard-as-MMORPG-hub.
 *
 * @see src/endpoints/presence-ping.ts / presence-online.ts
 */
export function usePresence({
  enabled = true,
  spaceId = null,
  ping: shouldPing = true,
  // Gentle by default — the prod Postgres pool is small (max=3 on Vercel), so
  // presence stays light: a ping a minute, a poll every ~45s.
  pingMs = 60000,
  pollMs = 45000,
}: UsePresenceOptions = {}) {
  const [online, setOnline] = useState<OnlineUser[]>([])
  const [count, setCount] = useState(0)
  const [isOnline, setIsOnline] = useState(false)

  const ping = useCallback(async () => {
    try {
      const path = typeof window !== 'undefined' ? window.location.pathname : undefined
      const res = await fetch('/api/presence-ops/ping', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'online', spaceId, path }),
      })
      setIsOnline(res.ok)
    } catch {
      setIsOnline(false)
    }
  }, [spaceId])

  const poll = useCallback(async () => {
    try {
      const q = spaceId ? `?space=${encodeURIComponent(String(spaceId))}` : ''
      const res = await fetch(`/api/presence-ops/online${q}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setOnline(Array.isArray(data.online) ? data.online : [])
      setCount(typeof data.count === 'number' ? data.count : 0)
    } catch {
      /* transient — keep last known */
    }
  }, [spaceId])

  useEffect(() => {
    if (!enabled) {
      setIsOnline(false)
      setCount(0)
      setOnline([])
      return
    }

    // Fire immediately, then on intervals (ping only while the tab is visible).
    if (shouldPing) void ping()
    void poll()
    const pingTimer = shouldPing
      ? setInterval(() => {
          if (document.visibilityState === 'visible') void ping()
        }, pingMs)
      : undefined
    const pollTimer = setInterval(() => void poll(), pollMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (shouldPing) void ping()
        void poll()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (pingTimer) clearInterval(pingTimer)
      clearInterval(pollTimer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, shouldPing, ping, poll, pingMs, pollMs])

  return { online, count, isOnline }
}
