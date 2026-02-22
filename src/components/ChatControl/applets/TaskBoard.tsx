'use client'

import React from 'react'
import { CheckSquare } from 'lucide-react'

interface TaskBoardProps {
  channelId?: string
  spaceId?: string | null
}

/**
 * Placeholder for the Tasks applet.
 * Sprint 14+ replaces this with a real task board reading from
 * the channel's data field (kanban columns, task items, assignees).
 */
export function TaskBoard({ channelId: _channelId, spaceId: _spaceId }: TaskBoardProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
        <CheckSquare size={32} className="text-muted-foreground/40" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">Tasks</h3>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Channel tasks and action items will appear here. Ask LEO to create tasks from your
        conversations.
      </p>
    </div>
  )
}
