'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'angel-os-onboarding-dismissed'

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
    href: '/dashboard/endeavor',
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

export default function OnboardingGuide({ role, prefix = '' }: OnboardingGuideProps) {
  const [dismissed, setDismissed] = useState(true) // default hidden to avoid flash

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setDismissed(stored === 'true')
  }, [])

  if (dismissed) return null

  const steps = role === 'admin' || role === 'super_admin' ? ADMIN_STEPS : USER_STEPS
  const title =
    role === 'admin' || role === 'super_admin'
      ? 'Get Started with Your Enterprise'
      : 'Welcome to Angel OS'
  const subtitle =
    role === 'admin' || role === 'super_admin'
      ? 'Follow these steps to set up your Enterprise and start growing your network.'
      : 'Here are a few things to help you get started.'

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div className="relative rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <h2 className="mb-1 text-lg font-bold">{title}</h2>
      <p className="mb-5 text-sm text-muted-foreground">{subtitle}</p>

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
            <span className="text-xs font-medium text-primary group-hover:underline">
              {step.cta} &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
