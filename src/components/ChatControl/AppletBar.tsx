'use client'

import React from 'react'
import { MessageSquare, FolderOpen, CheckSquare, Headphones, ListTree } from 'lucide-react'
import type { Applet } from './types'

// ─── Icon resolver ──────────────────────────────────────────────
// Maps Applet.icon (string name) to Lucide component.
// New applets register their icon here.
const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  MessageSquare,
  FolderOpen,
  CheckSquare,
  Headphones,
  ListTree,
}

interface AppletBarProps {
  applets: Applet[]
  activeApplet: string
  onAppletChange: (appletId: string) => void
}

/**
 * Icon-only toggle bar for switching between channel applets.
 * Renders in the channel header between the channel name and action buttons.
 * Matches the existing h-7 w-7 icon button pattern (Settings, Members).
 */
export function AppletBar({ applets, activeApplet, onAppletChange }: AppletBarProps) {
  if (applets.length <= 1) return null

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 px-1 py-0.5">
      {applets.map((applet) => {
        const Icon = ICON_MAP[applet.icon]
        const isActive = activeApplet === applet.id

        return (
          <button
            key={applet.id}
            onClick={() => onAppletChange(applet.id)}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted active:bg-muted hover:text-foreground'
            }`}
            title={applet.label}
          >
            {Icon ? <Icon size={16} /> : <span className="text-xs">{applet.label[0]}</span>}
          </button>
        )
      })}
    </div>
  )
}
