'use client'

import React from 'react'
import { MessageSquare, FileImage, CheckSquare } from 'lucide-react'

export interface ChannelTab {
  id: string
  label: string
  icon?: React.ReactNode
}

const DEFAULT_TABS: ChannelTab[] = [
  { id: 'chat', label: 'Chat', icon: <MessageSquare size={14} /> },
  { id: 'files', label: 'Files', icon: <FileImage size={14} /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={14} /> },
]

interface ChannelTabsProps {
  tabs?: ChannelTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

/**
 * Tab bar for channel content switching (Chat, Files, Tasks, etc.)
 * Extensible: Sprint 11 adds per-channel widget tabs from channel.widgets config.
 */
export function ChannelTabs({
  tabs = DEFAULT_TABS,
  activeTab,
  onTabChange,
}: ChannelTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border px-3 bg-muted/20">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative ${
            activeTab === tab.id
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.icon}
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
      ))}
    </div>
  )
}
