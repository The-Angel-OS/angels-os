'use client'

import React from 'react'
import { FolderOpen } from 'lucide-react'

interface FilesBrowserProps {
  channelId?: string
  spaceId?: string | null
}

/**
 * Placeholder for the Files applet.
 * Sprint 14+ replaces this with a real file browser reading from
 * the channel's message attachments and Media collection.
 */
export function FilesBrowser({ channelId: _channelId, spaceId: _spaceId }: FilesBrowserProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
        <FolderOpen size={32} className="text-muted-foreground/40" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">Files</h3>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Shared files and media for this channel will appear here. Drop files into the chat to start
        building your library.
      </p>
    </div>
  )
}
