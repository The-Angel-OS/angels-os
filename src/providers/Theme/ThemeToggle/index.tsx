'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import type { Theme } from '../types'
import { useTheme } from '..'
import { themeLocalStorageKey } from '../shared'

type Mode = 'auto' | 'light' | 'dark'

const NEXT: Record<Mode, Mode> = { auto: 'light', light: 'dark', dark: 'auto' }
const ICON: Record<Mode, React.ComponentType<{ className?: string }>> = {
  auto: Monitor,
  light: Sun,
  dark: Moon,
}
const LABEL: Record<Mode, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' }

/**
 * One-tap theme control for places a dropdown doesn't fit.
 *
 * The existing ThemeSelector is a Select rendered ONLY in the site footer, so on
 * a phone changing theme meant scrolling an entire page to reach it — and the
 * dashboard has no footer at all, so there was no way in from there. A select
 * inside an already-open sheet or dropdown is also awkward (a popover inside a
 * popover), hence a cycling button: auto → light → dark → auto.
 *
 * `compact` renders an icon-only square for tight corners (the top bar); the
 * default shows the icon plus the current mode, for menu rows where a bare
 * glyph would be a guessing game.
 */
export const ThemeToggle: React.FC<{ compact?: boolean; className?: string }> = ({
  compact = false,
  className,
}) => {
  const { setTheme } = useTheme()
  const [mode, setMode] = useState<Mode>('auto')

  useEffect(() => {
    const stored = window.localStorage.getItem(themeLocalStorageKey)
    setMode(stored === 'light' || stored === 'dark' ? stored : 'auto')
  }, [])

  const cycle = () => {
    const next = NEXT[mode]
    setMode(next)
    setTheme(next === 'auto' ? null : (next as Theme))
  }

  const Icon = ICON[mode]
  const base =
    'inline-flex items-center gap-2 rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground'

  return (
    <button
      type="button"
      onClick={cycle}
      // The label carries the NEXT state so the control explains what tapping
      // does, rather than only what it currently is.
      aria-label={`Theme: ${LABEL[mode]}. Switch to ${LABEL[NEXT[mode]]}`}
      title={`Theme: ${LABEL[mode]}`}
      className={`${base} ${compact ? 'h-9 w-9 justify-center' : 'w-full px-2 py-1.5'} ${className ?? ''}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!compact && <span>{LABEL[mode]}</span>}
    </button>
  )
}
