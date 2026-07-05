'use client'

import React from 'react'
import Link from 'next/link'
import { Rocket } from 'lucide-react'
import { DashboardWidget } from '@/components/dashboard/widgets'

interface OnboardingGuideProps {
  role: 'super_admin' | 'admin' | 'user'
  prefix?: string
}

const ADMIN_STEPS = [
  {
    number: 1,
    title: 'Complete Enterprise Setup',
    description: 'Let LEO guide you through configuring your Enterprise in 17 minutes.',
    href: '/dashboard/setup',
    cta: 'Start Setup',
  },
  {
    number: 2,
    title: 'Define Your Endeavor',
    description: 'Set your mission, capabilities, and federation identity.',
    href: '/dashboard/admin/settings?tab=endeavor',
    cta: 'Set Up Endeavor',
  },
  {
    number: 3,
    title: 'Invite Your Team',
    description: 'Bring people into your Enterprise and start growing.',
    href: '/dashboard/admin/invitations',
    cta: 'Send Invites',
  },
]

const USER_STEPS = [
  {
    number: 1,
    title: 'Explore Spaces',
    description: 'Join community spaces and connect with others.',
    href: '/dashboard/spaces',
    cta: 'View Spaces',
  },
  {
    number: 2,
    title: 'Browse the Shop',
    description: 'Discover products from creators in the marketplace.',
    href: '/shop',
    cta: 'Shop Now',
  },
  {
    number: 3,
    title: 'Chat with LEO',
    description: 'Your Constitutional AI guardian angel is ready to help.',
    href: '/dashboard/spaces',
    cta: 'Start Chatting',
  },
]

/**
 * Onboarding guide — now a framework-managed dashboard widget. Collapse it or
 * hide it; it's restorable from the tray (per-user, server-synced). No more
 * permanent localStorage dismissal — the maker never loses a card.
 */
export default function OnboardingGuide({ role, prefix = '' }: OnboardingGuideProps) {
  const isAdmin = role === 'admin' || role === 'super_admin'
  const steps = isAdmin ? ADMIN_STEPS : USER_STEPS
  const title = isAdmin ? 'Get Started with Your Enterprise' : 'Welcome to Angel OS'
  const subtitle = isAdmin
    ? 'Follow these steps to set up your Enterprise and start growing your network.'
    : 'Here are a few things to help you get started.'

  return (
    <DashboardWidget id="get-started" title={title} icon={<Rocket className="h-4 w-4 text-primary" />}>
      <p className="mb-4 text-sm text-muted-foreground">{subtitle}</p>
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <Link
            key={step.number}
            href={`${prefix}${step.href}`}
            className="group rounded-lg border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
          >
            <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {step.number}
            </div>
            <h3 className="mb-1 text-sm font-semibold">{step.title}</h3>
            <p className="mb-3 text-xs text-muted-foreground">{step.description}</p>
            <span className="text-xs font-medium text-primary group-hover:underline">{step.cta} &rarr;</span>
          </Link>
        ))}
      </div>
    </DashboardWidget>
  )
}
