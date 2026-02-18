'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

type SSEMessage = {
  id: number | string
  space: number | string | { id: number }
  channel?: string
  content: unknown
  author?: unknown
  messageType?: string
  createdAt: string
  [key: string]: unknown
}

type UseAIBusStreamOptions = {
  spaceId?: number | string
  channel?: string
  enabled?: boolean
  onMessage?: (message: SSEMessage) => void
  onError?: (error: Event) => void
  onReconnect?: () => void
}

type UseAIBusStreamReturn = {
  connected: boolean
  subscriberCount: number
  reconnect: () => void
}

/**
 * React hook for consuming the AI Bus SSE stream.
 *
 * Usage:
 * ```tsx
 * const { connected } = useAIBusStream({
 *   spaceId: 1,
 *   channel: 'general',
 *   onMessage: (msg) => addMessageToList(msg),
 * })
 * ```
 */
export function useAIBusStream({
  spaceId,
  channel,
  enabled = true,
  onMessage,
  onError,
  onReconnect,
}: UseAIBusStreamOptions): UseAIBusStreamReturn {
  const [connected, setConnected] = useState(false)
  const [subscriberCount, setSubscriberCount] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)
  const onReconnectRef = useRef(onReconnect)

  // Keep callback refs up to date without triggering reconnects
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => { onReconnectRef.current = onReconnect }, [onReconnect])

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const params = new URLSearchParams()
    if (spaceId) params.set('spaceId', String(spaceId))
    if (channel) params.set('channel', channel)

    const url = `/api/ai-bus/stream${params.toString() ? `?${params}` : ''}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.addEventListener('connected', (e) => {
      try {
        const data = JSON.parse(e.data)
        setConnected(true)
        setSubscriberCount(data.subscriberCount || 0)
      } catch {
        setConnected(true)
      }
    })

    es.addEventListener('message', (e) => {
      try {
        const message = JSON.parse(e.data)
        onMessageRef.current?.(message)
      } catch {
        // Skip malformed messages
      }
    })

    es.addEventListener('heartbeat', () => {
      // Keep-alive — no action needed
    })

    es.addEventListener('reconnect', () => {
      // Server asked us to reconnect (timeout)
      es.close()
      setConnected(false)
      // Reconnect after a short delay
      reconnectTimeoutRef.current = setTimeout(() => {
        onReconnectRef.current?.()
        connect()
      }, 1000)
    })

    es.onerror = (e) => {
      setConnected(false)
      onErrorRef.current?.(e)

      // Auto-reconnect with backoff
      es.close()
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 3000)
    }
  }, [spaceId, channel])

  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setConnected(false)
      return
    }

    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      setConnected(false)
    }
  }, [enabled, connect])

  const reconnect = useCallback(() => {
    connect()
  }, [connect])

  return { connected, subscriberCount, reconnect }
}
