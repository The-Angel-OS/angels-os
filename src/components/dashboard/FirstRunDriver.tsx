'use client'

import React, { useCallback, useEffect, useState } from 'react'

/**
 * FirstRunDriver — the conversational new-user driver.
 *
 * Shown to a signed-in person who has a personal portal but hasn't stood up an
 * endeavor yet. Instead of a static checklist or a form wizard, it hands the
 * conversation to LEO: one click opens the LEO panel with a seeded message, LEO
 * asks a question or two, calls commission_endeavor(kind:'circle'), and — via the
 * active-endeavor switch (resolveActiveTenant) — lands the person standing INSIDE
 * their new Circle. The day-one job (a private shared space + inviting your people)
 * is the pull. @see src/components/ChatControl/SidebarChat.tsx (leo:ask listener)
 *
 * Circle-first (Ken 260717): a Circle is the lowest-friction, highest-pull first
 * endeavor — kinship, no commerce setup, no money required to feel alive. The
 * business path is offered as the secondary option.
 */
const DISMISS_KEY = 'angelOS_firstrun_dismissed'

function askLeo(text: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('leo:ask', { detail: { text } }))
}

export function FirstRunDriver({ userName }: { userName?: string }) {
  const [dismissed, setDismissed] = useState(true) // start hidden; decide on mount

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true')
  }, [])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, 'true')
  }, [])

  if (dismissed) return null

  const greeting = userName ? `${userName}, ` : ''

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Dismiss"
        aria-label="Dismiss first-run guide"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="p-6 md:p-8">
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight">{greeting}let&apos;s start your Circle</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A Circle is a private space for the people who matter to you — a shared
              home, a timeline, a place to keep things together. Tell LEO who it&apos;s
              for and it&apos;ll set the whole thing up in about a minute. You stay the
              owner; nothing&apos;s public.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() =>
              askLeo(
                "I'd like to create a private Circle for my family. Help me set it up — ask me for a name and anything you need.",
              )
            }
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
            </svg>
            Start my Circle with LEO
          </button>

          <button
            onClick={() =>
              askLeo(
                "I want to start a business endeavor. Help me set it up — ask me for a name and what it does.",
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Start a business endeavor instead
          </button>
        </div>
      </div>
    </div>
  )
}
