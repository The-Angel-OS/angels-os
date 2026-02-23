'use client'

import React, { useState } from 'react'
import { Plus, Settings, Users } from 'lucide-react'
import { SpaceSelector } from './SpaceSelector'
import { CreateSpaceDialog } from './CreateSpaceDialog'
import { SpaceSettingsDialog } from './SpaceSettingsDialog'
import { MemberPanel } from './MemberPanel'
import type { ChatSpace } from './types'

// ── Props ──────────────────────────────────────────────────────────────────

interface SpacesMenuHeaderProps {
  spaces: ChatSpace[]
  activeSpaceId: string
  onSpaceSelect: (spaceId: string) => void
  /** Called after a new space is created — should switch to it and refresh */
  onSpaceCreated: (spaceId: string) => void
  /** Called when space settings are saved */
  onSpaceUpdated?: (updated: Partial<ChatSpace>) => void
  /** Called after the active space is deleted — should switch to another space */
  onSpaceDeleted?: () => void
  isLoading?: boolean
  /** Compact mode — collapsed sidebar, only show SpaceSelector icon; hide action buttons */
  compact?: boolean
  /** Numeric space ID for MemberPanel (Payload integer ID, not slug string) */
  activeSpaceNumericId?: number
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * SpacesMenuHeader — Replaces the bare SpaceSelector in the channel sidebar.
 *
 * Renders:
 *   [SpaceIcon] Space Name [▼]   [👥] [⚙] [+]
 *
 * In compact mode (collapsed sidebar) only the SpaceSelector icon+chevron shows;
 * the three action buttons are hidden.
 */
export function SpacesMenuHeader({
  spaces,
  activeSpaceId,
  onSpaceSelect,
  onSpaceCreated,
  onSpaceUpdated,
  onSpaceDeleted,
  isLoading,
  compact,
  activeSpaceNumericId,
}: SpacesMenuHeaderProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)

  const activeSpace = spaces.find((s) => s.id === activeSpaceId)

  const handleSpaceCreated = (newSpaceId: string) => {
    setCreateOpen(false)
    onSpaceCreated(newSpaceId)
  }

  const handleSpaceUpdated = (updated: Partial<ChatSpace>) => {
    setSettingsOpen(false)
    onSpaceUpdated?.(updated)
  }

  const handleSpaceDeleted = () => {
    setSettingsOpen(false)
    onSpaceDeleted?.()
  }

  const numericSpaceId = activeSpaceNumericId ?? Number(activeSpaceId)

  return (
    <>
      <div className={`flex items-center ${compact ? '' : 'gap-0.5 pr-1'}`}>
        {/* Space selector — takes remaining width */}
        <div className="min-w-0 flex-1">
          <SpaceSelector
            spaces={spaces}
            activeSpaceId={activeSpaceId}
            onSelect={onSpaceSelect}
            isLoading={isLoading}
            compact={compact}
          />
        </div>

        {/* Action buttons — hidden in compact mode */}
        {!compact && (
          <div className="flex shrink-0 items-center">
            <button
              onClick={() => setMembersOpen(true)}
              title="Members"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Users size={14} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              title="Space settings"
              disabled={!activeSpace}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Settings size={14} />
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              title="Create new space"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Dialogs / panels — rendered outside the flex row ── */}

      <CreateSpaceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleSpaceCreated}
      />

      {activeSpace && (
        <SpaceSettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          space={activeSpace}
          onSpaceUpdated={handleSpaceUpdated}
          onSpaceDeleted={handleSpaceDeleted}
        />
      )}

      <MemberPanel
        spaceId={numericSpaceId}
        isOpen={membersOpen}
        onClose={() => setMembersOpen(false)}
      />
    </>
  )
}
