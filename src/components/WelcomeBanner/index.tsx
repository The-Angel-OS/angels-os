'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { toast } from 'sonner'

const DISMISS_KEY = 'angelOS_welcome_dismissed'

export type UserRole = 'super_admin' | 'admin' | 'user'

interface WelcomeBannerProps {
  /** Whether the database has been seeded (spaces > 0 or products > 0) */
  isSeeded: boolean
  /** User's effective role for showing role-appropriate content */
  userRole?: UserRole
  /** User's display name */
  userName?: string
}

/**
 * WelcomeBanner — Role-based onboarding card.
 *
 * Shows different content depending on user role:
 * - super_admin: Platform admin view with seed (danger zone), explore, configure
 * - admin: Business owner view with products, content, branding setup
 * - user: Member view with shop, chat, orders
 *
 * Seed button is only shown to super_admin, behind a danger zone confirmation.
 */
export function WelcomeBanner({ isSeeded, userRole = 'user', userName }: WelcomeBannerProps) {
  const [dismissed, setDismissed] = useState(true) // Start hidden, check on mount
  const [seeding, setSeeding] = useState(false)
  const [seeded, setSeeded] = useState(isSeeded)
  const [seedConfirmStep, setSeedConfirmStep] = useState(0) // 0=none, 1=first confirm, 2=really sure

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
    setSeedConfirmStep(0)

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

  const isSuperAdmin = userRole === 'super_admin'
  const isAdminRole = userRole === 'super_admin' || userRole === 'admin'

  // Already seeded and dismissed? Show nothing
  if (seeded && dismissed) return null

  // Dismissed but not seeded? Show a small reminder (only for super_admins)
  if (dismissed && !seeded) {
    if (!isSuperAdmin) return null // Regular users don't need seed reminders
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
            onClick={() => setSeedConfirmStep(1)}
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
        {seedConfirmStep > 0 && (
          <SeedDangerZone
            step={seedConfirmStep}
            seeding={seeding}
            onConfirm={() => {
              if (seedConfirmStep === 1) setSeedConfirmStep(2)
              else handleSeed()
            }}
            onCancel={() => setSeedConfirmStep(0)}
          />
        )}
      </div>
    )
  }

  // ── Role-based welcome banners ──

  // Get role-specific config
  const bannerConfig = getRoleBannerConfig(userRole, userName)

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
            <h2 className="text-xl font-bold tracking-tight">{bannerConfig.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{bannerConfig.subtitle}</p>
          </div>
        </div>

        {/* Quick Start Steps — role-specific */}
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {bannerConfig.steps.map((step, i) => (
            <StepCard
              key={i}
              number={i + 1}
              title={step.title}
              description={step.description}
              action={step.action}
            />
          ))}
        </div>

        {/* Seed Danger Zone — super_admin only, separate from steps */}
        {isSuperAdmin && !seeded && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
            <div className="flex items-center gap-2 mb-2">
              <WarningIcon />
              <h3 className="text-sm font-bold text-red-700 dark:text-red-400">Danger Zone</h3>
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mb-3">
              Seeding the database will load sample tenants, products, spaces, and pages.
              This overwrites existing sample data. Only do this on fresh installs or dev environments.
            </p>
            {seedConfirmStep === 0 && (
              <button
                onClick={() => setSeedConfirmStep(1)}
                disabled={seeding}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900 disabled:opacity-50"
              >
                <DatabaseIcon /> Seed Database
              </button>
            )}
            {seedConfirmStep > 0 && (
              <SeedDangerZone
                step={seedConfirmStep}
                seeding={seeding}
                onConfirm={() => {
                  if (seedConfirmStep === 1) setSeedConfirmStep(2)
                  else handleSeed()
                }}
                onCancel={() => setSeedConfirmStep(0)}
              />
            )}
          </div>
        )}

        {isSuperAdmin && seeded && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
            <CheckIcon />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Database seeded successfully
            </span>
          </div>
        )}

        {/* Documentation Links — role-appropriate */}
        <div className="flex flex-wrap gap-3">
          {bannerConfig.links.map((link, i) => (
            <DocLink key={i} href={link.href} icon={link.icon} label={link.label} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Seed Danger Zone Confirmation ──────────────────────────────

function SeedDangerZone({
  step,
  seeding,
  onConfirm,
  onCancel,
}: {
  step: number
  seeding: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-2 flex items-center gap-2">
      {step === 1 && (
        <>
          <span className="text-xs font-medium text-red-600 dark:text-red-400">
            Are you sure? This will overwrite sample data.
          </span>
          <button
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700"
          >
            Yes, I&apos;m sure
          </button>
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <span className="text-xs font-bold text-red-700 dark:text-red-400">
            ⚠️ Really really sure? This cannot be undone.
          </span>
          <button
            onClick={onConfirm}
            disabled={seeding}
            className="rounded-md bg-red-700 px-3 py-1 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {seeding ? (
              <span className="inline-flex items-center gap-1">
                <SpinnerIcon /> Seeding...
              </span>
            ) : (
              'Yes, seed the database!'
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={seeding}
            className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
        </>
      )}
    </div>
  )
}

// ─── Role-based banner config ──────────────────────────────────

interface StepConfig {
  title: string
  description: string
  action?: React.ReactNode
}

interface LinkConfig {
  href: string
  icon: React.ReactNode
  label: string
}

function getRoleBannerConfig(
  role: UserRole,
  userName?: string,
): {
  title: string
  subtitle: string
  steps: StepConfig[]
  links: LinkConfig[]
} {
  const greeting = userName ? `Welcome, ${userName}!` : 'Welcome to Angel OS'

  switch (role) {
    case 'super_admin':
      return {
        title: 'Welcome to Angel OS',
        subtitle:
          'Constitutional AI platform where everyone gets an Angel. Multi-tenant commerce, collaboration spaces, and LEO AI agents — all in one stack.',
        steps: [
          {
            title: 'Manage Tenants',
            description: 'Provision new Endeavors, view federation stats, and manage platform operations.',
          },
          {
            title: 'Explore the Dashboard',
            description: 'View spaces, chat with LEO, manage tenants, and browse the product catalog.',
          },
          {
            title: 'Configure Your Platform',
            description: 'Set up tenant branding, Stripe Connect, AI models, and Guardian Angel personas.',
          },
        ],
        links: [
          { href: 'https://github.com/KennyStanleyJr/angels-os', icon: <GitHubIcon />, label: 'GitHub' },
          { href: '/admin', icon: <AdminIcon />, label: 'Payload Admin' },
          { href: '/', icon: <GlobeIcon />, label: 'Visit Site' },
          { href: '/admin/collections/tenants', icon: <TenantIcon />, label: 'Manage Tenants' },
        ],
      }

    case 'admin':
      return {
        title: greeting,
        subtitle:
          'You\'re a business admin. Set up your products, manage your team, and configure your storefront.',
        steps: [
          {
            title: 'Add Your Products',
            description: 'List products in your shop with pricing, images, and inventory management.',
          },
          {
            title: 'Invite Your Team',
            description: 'Add team members to your spaces and assign roles for collaboration.',
          },
          {
            title: 'Discover the Federation',
            description: 'Browse other Endeavors, find partners, and grow your network.',
          },
        ],
        links: [
          { href: '/dashboard/spaces', icon: <ChatIconSmall />, label: 'Spaces' },
          { href: '/shop', icon: <GlobeIcon />, label: 'Visit Shop' },
          { href: '/dashboard/admin/settings?tab=endeavor', icon: <AdminIcon />, label: 'Endeavor Setup' },
        ],
      }

    default: // 'user' / customer
      return {
        title: greeting,
        subtitle:
          'Browse products, join community spaces, and chat with LEO — your Constitutional AI assistant.',
        steps: [
          {
            title: 'Browse the Shop',
            description: 'Discover products from makers in our community marketplace.',
          },
          {
            title: 'Join the Conversation',
            description: 'Chat with LEO and connect with the community in collaboration spaces.',
          },
          {
            title: 'Track Your Orders',
            description: 'View your order history, track shipments, and manage your account.',
          },
        ],
        links: [
          { href: '/shop', icon: <GlobeIcon />, label: 'Browse Shop' },
          { href: '/dashboard/spaces', icon: <ChatIconSmall />, label: 'Spaces' },
          { href: '/account', icon: <AdminIcon />, label: 'My Account' },
        ],
      }
  }
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

function WarningIcon() {
  return (
    <svg className="h-4 w-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
  )
}

function ChatIconSmall() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  )
}
