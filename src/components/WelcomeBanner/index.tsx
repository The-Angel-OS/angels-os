'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { toast } from 'sonner'

const DISMISS_KEY = 'angelOS_welcome_dismissed'

interface WelcomeBannerProps {
  /** Whether the database has been seeded (spaces > 0 or products > 0) */
  isSeeded: boolean
}

/**
 * WelcomeBanner — Platform Home onboarding card.
 *
 * Shows when the database is unseeded (0 spaces, 0 products).
 * Includes: Angel OS introduction, documentation links, seed button,
 * and a dismiss option (persisted to localStorage).
 *
 * Users can re-show the banner by clicking "Show Welcome Guide"
 * that appears after dismissal.
 */
export function WelcomeBanner({ isSeeded }: WelcomeBannerProps) {
  const [dismissed, setDismissed] = useState(true) // Start hidden, check on mount
  const [seeding, setSeeding] = useState(false)
  const [seeded, setSeeded] = useState(isSeeded)

  // Check localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY)
    setDismissed(stored === 'true')
  }, [])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, 'true')
  }, [])

  const handleReshow = useCallback(() => {
    setDismissed(false)
    localStorage.removeItem(DISMISS_KEY)
  }, [])

  const handleSeed = useCallback(async () => {
    if (seeding || seeded) return

    setSeeding(true)

    const seedPromise = fetch('/next/seed', {
      method: 'POST',
      credentials: 'include',
      signal: AbortSignal.timeout(300_000), // 5 min timeout
    }).then(async (res) => {
      if (!res.ok) {
        let errorMsg = 'Seed failed'
        try {
          const data = await res.json()
          if (data.error) errorMsg = data.error
        } catch {
          // Response wasn't JSON
        }
        throw new Error(errorMsg)
      }
      return res
    })

    toast.promise(seedPromise, {
      loading: 'Seeding database — this may take 1-2 minutes...',
      success: () => {
        setSeeded(true)
        setSeeding(false)
        return 'Database seeded! Refresh the page to see your data.'
      },
      error: (err) => {
        setSeeding(false)
        const msg = err?.message || 'Unknown error'
        if (err?.name === 'TimeoutError') {
          return 'Seed timed out — the server may still be processing. Try refreshing in a minute.'
        }
        return `Seed failed: ${msg}`
      },
    })
  }, [seeding, seeded])

  // Already seeded and dismissed? Show nothing
  if (seeded && dismissed) return null

  // Dismissed but not seeded? Show a small reminder
  if (dismissed && !seeded) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex items-center gap-2">
          <span className="text-amber-600 dark:text-amber-400">
            <RocketIcon />
          </span>
          <span className="text-sm text-amber-800 dark:text-amber-300">
            Your database hasn&apos;t been seeded yet — no spaces, products, or sample content.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {seeding ? 'Seeding...' : 'Seed Now'}
          </button>
          <button
            onClick={handleReshow}
            className="text-xs text-amber-600 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
          >
            Show Guide
          </button>
        </div>
      </div>
    )
  }

  // Full welcome banner
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-muted/30">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Dismiss welcome guide"
      >
        <CloseIcon />
      </button>

      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <AngelIcon />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Welcome to Angel OS</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Constitutional AI platform where everyone gets an Angel.
              Multi-tenant commerce, collaboration spaces, and LEO AI agents — all in one stack.
            </p>
          </div>
        </div>

        {/* Quick Start Steps */}
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <StepCard
            number={1}
            title="Seed Your Database"
            description="Load sample tenants, products, spaces, and pages to explore the platform."
            action={
              seeded ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckIcon /> Seeded
                </span>
              ) : (
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {seeding ? (
                    <>
                      <SpinnerIcon /> Seeding...
                    </>
                  ) : (
                    <>
                      <DatabaseIcon /> Seed Now
                    </>
                  )}
                </button>
              )
            }
          />
          <StepCard
            number={2}
            title="Explore the Dashboard"
            description="View spaces, chat with LEO, manage tenants, and browse the product catalog."
          />
          <StepCard
            number={3}
            title="Configure Your Platform"
            description="Set up tenant branding, Stripe Connect, AI models, and Guardian Angel personas."
          />
        </div>

        {/* Documentation Links */}
        <div className="flex flex-wrap gap-3">
          <DocLink
            href="https://github.com/KennyStanleyJr/angels-os"
            icon={<GitHubIcon />}
            label="GitHub"
          />
          <DocLink href="/admin" icon={<AdminIcon />} label="Payload Admin" />
          <DocLink href="/" icon={<GlobeIcon />} label="Visit Site" />
          <DocLink
            href="/admin/collections/tenants"
            icon={<TenantIcon />}
            label="Manage Tenants"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────

function StepCard({
  number,
  title,
  description,
  action,
}: {
  number: number
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {number}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  )
}

function DocLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {icon}
      {label}
    </a>
  )
}

// ─── Icons (inline SVG, no dependencies) ─────────────────────────

function AngelIcon() {
  return (
    <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 2L9.5 8.5 3 10l5 4-1.5 7L12 17.5 17.5 21 16 14l5-4-6.5-1.5L12 2z"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function DatabaseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function RocketIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-6.233 0c-1.495 1.495-2.058 5.914-2.13 7.075a.36.36 0 00.384.384c1.161-.072 5.58-.635 7.075-2.13a4.493 4.493 0 00.005-5.329z"
      />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  )
}

function TenantIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  )
}
