'use client'

import React, { useState, useRef, useCallback } from 'react'
import { ChevronDown, Bot, Globe, Lock, Users } from 'lucide-react'
import type { ChatSpace } from './types'
import { AI_BUS_SPACE_SLUG } from './useSpaces'
import { useClickOutside } from '@/hooks/useClickOutside'

interface SpaceSelectorProps {
  spaces: ChatSpace[]
  activeSpaceId: string
  onSelect: (spaceId: string) => void
  isLoading?: boolean
  /** Compact mode for collapsed sidebar — just icon + chevron */
  compact?: boolean
}

/** Icon for a space based on its type */
function SpaceIcon({ space, size = 14 }: { space: ChatSpace; size?: number }) {
  if (space.slug === AI_BUS_SPACE_SLUG) {
    return <Bot size={size} className="shrink-0 text-violet-500" />
  }
  if (space.visibility === 'public') {
    return <Globe size={size} className="shrink-0 text-emerald-500" />
  }
  if (space.visibility === 'private') {
    return <Lock size={size} className="shrink-0 text-amber-500" />
  }
  return <Users size={size} className="shrink-0 text-muted-foreground" />
}

/**
 * SpaceSelector — Dropdown for switching between spaces the user belongs to.
 *
 * Shows the active space name + icon, clicking opens a popover with all spaces.
 * AI Bus space gets a distinct robot icon and is sorted to the bottom.
 */
export function SpaceSelector({
  spaces,
  activeSpaceId,
  onSelect,
  isLoading,
  compact,
}: SpaceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeSpace = spaces.find((s) => s.id === activeSpaceId)
  const closeDropdown = useCallback(() => setIsOpen(false), [])
  useClickOutside(dropdownRef, closeDropdown, isOpen)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (spaces.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">No spaces available</div>
    )
  }

  // Single space — no need for a selector, just show the name
  if (spaces.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <SpaceIcon space={spaces[0]} />
        {!compact && (
          <span className="truncate text-sm font-semibold text-foreground">
            {spaces[0].name}
          </span>
        )}
      </div>
    )
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/50"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {activeSpace && <SpaceIcon space={activeSpace} />}
        {!compact && (
          <span className="flex-1 truncate text-sm font-semibold text-foreground">
            {activeSpace?.name || 'Select space'}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-background shadow-lg"
          role="listbox"
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {spaces.map((space) => {
              const isActive = space.id === activeSpaceId
              return (
                <button
                  key={space.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onSelect(space.id)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <SpaceIcon space={space} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{space.name}</div>
                    {space.description && (
                      <div className="truncate text-xs opacity-60">{space.description}</div>
                    )}
                  </div>
                  {space.isSystem && (
                    <span className="shrink-0 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                      System
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
