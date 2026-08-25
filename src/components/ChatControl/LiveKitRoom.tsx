'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  LiveKitRoom as LKRoom,
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks,
  MediaDeviceMenu,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track } from 'livekit-client'
import { X, Maximize2, Minimize2, Settings2, FlipHorizontal } from 'lucide-react'

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
  /** Embedded mode — fills parent container (for applet content area) */
  embedded?: boolean
  /** Start with video enabled */
  initialVideo?: boolean
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
 * Device pickers + mirror toggle.
 *
 * These existed already and were unreachable: the panel was a block child of a
 * container whose next sibling carried `height: 100%`, so the grid covered it
 * and the menus were rendered off-screen. Hence "no option to select vid or mic
 * device" on a build that shipped both. The room body is a flex column now, and
 * this row sizes to content.
 */
function DevicePanel({ mirrored, onToggleMirror }: { mirrored: boolean; onToggleMirror: () => void }) {
  return (
    <div className="shrink-0 border-b border-border bg-muted/30 px-4 py-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Mic</span>
          <MediaDeviceMenu kind="audioinput" />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Speaker</span>
          <MediaDeviceMenu kind="audiooutput" />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Camera</span>
          <MediaDeviceMenu kind="videoinput" />
        </label>
        <button
          type="button"
          onClick={onToggleMirror}
          className={`flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs transition-colors ${
            mirrored ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
          }`}
          title="Flip your own preview horizontally"
        >
          <FlipHorizontal size={13} />
          Mirror my video
        </button>
      </div>
    </div>
  )
}

/**
 * Everything inside <LKRoom>, in one place.
 *
 * Was copy-pasted three times (embedded, full-screen, panel), which is how the
 * device panel came to exist in exactly one of them.
 */
function RoomBody({
  showDeviceSettings,
  mirrored,
  onToggleMirror,
  showGrid = true,
}: {
  showDeviceSettings: boolean
  mirrored: boolean
  onToggleMirror: () => void
  showGrid?: boolean
}) {
  return (
    <div className={`flex h-full min-h-0 flex-col ${mirrored ? '' : 'angel-lk-unmirrored'}`}>
      <RoomAudioRenderer />
      {showDeviceSettings && <DevicePanel mirrored={mirrored} onToggleMirror={onToggleMirror} />}
      {showGrid && (
        <div className="min-h-0 flex-1">
          <ParticipantGrid />
        </div>
      )}
      <div className="shrink-0">
        <ControlBar
          variation="minimal"
          controls={{ camera: true, microphone: true, screenShare: true, leave: true, settings: false }}
        />
      </div>
    </div>
  )
}

/**
 * LiveKitRoom — Wraps the LiveKit React components for voice/video in a channel.
 *
 * Three modes:
 * - **Floating panel** (default): 280px panel at bottom of chat area
 * - **Full-screen overlay**: fills entire viewport (z-100)
 * - **Embedded** (embedded=true): fills parent container, used as channel applet
 */
export function LiveKitRoom({
  url,
  token,
  roomName,
  onLeave,
  fullScreen: initialFullScreen = false,
  embedded = false,
  initialVideo = false,
}: LiveKitRoomProps) {
  const [isFullScreen, setIsFullScreen] = useState(initialFullScreen)
  const [isConnected, setIsConnected] = useState(false)
  const [showDeviceSettings, setShowDeviceSettings] = useState(false)
  // Mirroring your own preview is the right default for a webcam and wrong for
  // anything pointed at the world — a phone camera over DroidCam renders every
  // word backwards. Remembered, because whichever you are, you are it every time.
  const [mirrored, setMirrored] = useState(true)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('angel.livekit.mirror')
      if (saved !== null) setMirrored(saved === '1')
    } catch {
      // Private mode; the default stands.
    }
  }, [])
  const toggleMirror = useCallback(() => {
    setMirrored((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem('angel.livekit.mirror', next ? '1' : '0')
      } catch {
        // Not worth failing a call over.
      }
      return next
    })
  }, [])

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

  // ─── Embedded mode: fills parent container (applet content area) ──
  if (embedded) {
    return (
      <div className="flex flex-1 flex-col bg-background">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-sm font-medium text-foreground">
              {isConnected ? roomName : 'Connecting...'}
            </span>
            {isConnected && (
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                Connected
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowDeviceSettings(!showDeviceSettings)}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${showDeviceSettings ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              title="Device settings"
            >
              <Settings2 size={14} />
            </button>
            <button
              onClick={() => setIsFullScreen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Full-screen"
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-500/10 dark:text-red-400 transition-colors"
              title="Leave call"
            >
              <X size={14} />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* LiveKit room — fills remaining space */}
        <LKRoom
          serverUrl={url}
          token={token}
          video={initialVideo}
          audio={true}
          onConnected={() => setIsConnected(true)}
          onDisconnected={handleDisconnect}
          data-lk-theme="default"
          className="flex-1 overflow-hidden"
          style={{ height: '100%' }}
        >
          <RoomBody showDeviceSettings={showDeviceSettings} mirrored={mirrored} onToggleMirror={toggleMirror} />
        </LKRoom>

        {/* Full-screen overlay when toggled */}
        {isFullScreen && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-background">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm font-medium">{roomName}</span>
              </div>
              <button
                onClick={() => setIsFullScreen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Exit full-screen (Esc)"
              >
                <Minimize2 size={14} />
              </button>
            </div>
            <LKRoom
              serverUrl={url}
              token={token}
              data-lk-theme="default"
              className="flex-1 overflow-hidden"
              style={{ height: '100%' }}
            >
              <RoomBody showDeviceSettings={showDeviceSettings} mirrored={mirrored} onToggleMirror={toggleMirror} />
            </LKRoom>
          </div>
        )}
      </div>
    )
  }

  // ─── Floating / fullscreen mode (original) ────────────────────
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
        <RoomBody showDeviceSettings={showDeviceSettings} mirrored={mirrored} onToggleMirror={toggleMirror} showGrid={isFullScreen} />
      </LKRoom>
    </div>
  )
}
