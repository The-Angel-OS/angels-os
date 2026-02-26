'use client'

import React, { useState, useCallback } from 'react'
import { Headphones, PhoneOff, Loader2, Mic, Video } from 'lucide-react'
import { LiveKitRoom } from './LiveKitRoom'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || ''

interface LiveKitButtonProps {
  spaceId: string
  channelSlug: string
  /** Container element reference for positioning the LiveKit room panel */
  containerRef?: React.RefObject<HTMLDivElement | null>
  /** Embedded mode — renders as full content area applet instead of header button */
  embedded?: boolean
}

/**
 * LiveKitButton — Join/leave voice/video for a channel.
 *
 * Two modes:
 * - **Header button** (default): Small "Voice" button in channel header, renders floating panel on join
 * - **Embedded applet** (embedded=true): Full content area with join CTA and room display
 */
export function LiveKitButton({ spaceId, channelSlug, embedded = false }: LiveKitButtonProps) {
  const [isJoined, setIsJoined] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [roomData, setRoomData] = useState<{
    token: string
    url: string
    roomName: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [videoEnabled, setVideoEnabled] = useState(false)

  const handleJoin = useCallback(async (withVideo = false) => {
    if (isConnecting || isJoined) return
    setVideoEnabled(withVideo)
    setIsConnecting(true)
    setError(null)

    try {
      const res = await fetch(`${SERVER_URL}/api/livekit/token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, channelSlug }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to join voice channel')
        setIsConnecting(false)
        return
      }

      const data = await res.json()
      setRoomData({
        token: data.token,
        url: data.url,
        roomName: data.roomName,
      })
      setIsJoined(true)

      // Post a system message for channel activity tracking
      fetch(`${SERVER_URL}/api/chat/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { type: 'text', text: `📞 Joined the voice channel${withVideo ? ' with video' : ''}` },
          space: spaceId,
          channel: channelSlug,
          messageType: 'system',
        }),
      }).catch(() => {}) // Non-critical
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsConnecting(false)
    }
  }, [spaceId, channelSlug, isConnecting, isJoined]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLeave = useCallback(() => {
    setIsJoined(false)
    setRoomData(null)
    // Post a system message for channel activity tracking
    fetch(`${SERVER_URL}/api/chat/send`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { type: 'text', text: '📞 Left the voice channel' },
        space: spaceId,
        channel: channelSlug,
        messageType: 'system',
      }),
    }).catch(() => {}) // Non-critical
  }, [spaceId, channelSlug])

  // ─── Embedded mode: full content area applet ──────────────────
  if (embedded) {
    // Joined — show room filling the content area
    if (isJoined && roomData) {
      return (
        <LiveKitRoom
          url={roomData.url}
          token={roomData.token}
          roomName={roomData.roomName}
          onLeave={handleLeave}
          embedded
          initialVideo={videoEnabled}
        />
      )
    }

    // Not joined — show join CTA
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Headphones className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Voice Channel</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Join voice to talk with other members in this channel. Camera and screen sharing available.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleJoin(false)}
            disabled={isConnecting}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isConnecting && !videoEnabled ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Mic size={16} />
            )}
            {isConnecting && !videoEnabled ? 'Connecting...' : 'Join Voice'}
          </button>
          <button
            onClick={() => handleJoin(true)}
            disabled={isConnecting}
            className="flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {isConnecting && videoEnabled ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Video size={16} />
            )}
            {isConnecting && videoEnabled ? 'Connecting...' : 'Join with Video'}
          </button>
        </div>

        <p className="text-xs text-muted-foreground/60">
          You can toggle camera and microphone after joining
        </p>
      </div>
    )
  }

  // ─── Header button mode (original) ────────────────────────────
  return (
    <>
      {/* Join/Leave button */}
      <button
        onClick={isJoined ? handleLeave : () => handleJoin(false)}
        disabled={isConnecting}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
          isJoined
            ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400'
            : error
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        title={isJoined ? 'Leave voice channel' : error || 'Join voice channel'}
      >
        {isConnecting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isJoined ? (
          <PhoneOff size={14} />
        ) : (
          <Headphones size={14} />
        )}
        <span>{isJoined ? 'Leave' : 'Voice'}</span>
      </button>

      {/* LiveKit room panel (renders inside the chat area) */}
      {isJoined && roomData && (
        <LiveKitRoom
          url={roomData.url}
          token={roomData.token}
          roomName={roomData.roomName}
          onLeave={handleLeave}
        />
      )}
    </>
  )
}
