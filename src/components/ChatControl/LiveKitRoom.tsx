'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  LiveKitRoom as LKRoom,
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track } from 'livekit-client'
import { X, Maximize2, Minimize2 } from 'lucide-react'

interface LiveKitRoomProps {
  /** LiveKit server URL (wss://) */
  url: string
  /** JWT token from /api/livekit/token */
  token: string
  /** Room name for display */
  roomName: string
  /** Called when user leaves the room */
  onLeave: () => void
  /** Start in full-screen overlay mode */
  fullScreen?: boolean
}

/**
 * Participant grid — renders video tiles for all tracks.
 */
function ParticipantGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  return (
    <GridLayout tracks={tracks} style={{ height: '100%' }}>
      <ParticipantTile />
    </GridLayout>
  )
}

/**
 * LiveKitRoom — Wraps the LiveKit React components for voice/video in a channel.
 *
 * Renders in a floating panel (default) or full-screen overlay.
 * Includes audio renderer, participant grid, and control bar.
 */
export function LiveKitRoom({
  url,
  token,
  roomName,
  onLeave,
  fullScreen: initialFullScreen = false,
}: LiveKitRoomProps) {
  const [isFullScreen, setIsFullScreen] = useState(initialFullScreen)
  const [isConnected, setIsConnected] = useState(false)

  const handleDisconnect = useCallback(() => {
    setIsConnected(false)
    onLeave()
  }, [onLeave])

  // Escape key exits full-screen
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isFullScreen])

  const containerClass = isFullScreen
    ? 'fixed inset-0 z-[100] flex flex-col bg-background'
    : 'absolute inset-x-0 bottom-0 z-50 flex flex-col border-t border-border bg-background'

  // Height for non-fullscreen: enough for audio-only + controls
  const style = isFullScreen ? undefined : { height: '280px' }

  return (
    <div className={containerClass} style={style}>
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
          <span className="text-xs font-medium text-muted-foreground">
            {isConnected ? roomName : 'Connecting...'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title={isFullScreen ? 'Exit full-screen' : 'Full-screen'}
          >
            {isFullScreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={handleDisconnect}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Leave call"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* LiveKit room */}
      <LKRoom
        serverUrl={url}
        token={token}
        onConnected={() => setIsConnected(true)}
        onDisconnected={handleDisconnect}
        data-lk-theme="default"
        className="flex-1 overflow-hidden"
        style={{ height: '100%' }}
      >
        <RoomAudioRenderer />
        {isFullScreen && <ParticipantGrid />}
        <ControlBar
          variation="minimal"
          controls={{
            camera: true,
            microphone: true,
            screenShare: isFullScreen,
            leave: true,
          }}
        />
      </LKRoom>
    </div>
  )
}
