'use client'

import React, { useState, useCallback } from 'react'
import { Headphones, PhoneOff, Loader2 } from 'lucide-react'
import { LiveKitRoom } from './LiveKitRoom'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || ''

interface LiveKitButtonProps {
  spaceId: string
  channelSlug: string
  /** Container element reference for positioning the LiveKit room panel */
  containerRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * LiveKitButton — Join/leave voice/video for a channel.
 *
 * Clicking "Voice" fetches a LiveKit token from /api/livekit/token,
 * then renders the LiveKitRoom component in the chat area.
 */
export function LiveKitButton({ spaceId, channelSlug }: LiveKitButtonProps) {
  const [isJoined, setIsJoined] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [roomData, setRoomData] = useState<{
    token: string
    url: string
    roomName: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = useCallback(async () => {
    if (isConnecting || isJoined) return
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
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsConnecting(false)
    }
  }, [spaceId, channelSlug, isConnecting, isJoined])

  const handleLeave = useCallback(() => {
    setIsJoined(false)
    setRoomData(null)
  }, [])

  return (
    <>
      {/* Join/Leave button */}
      <button
        onClick={isJoined ? handleLeave : handleJoin}
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
