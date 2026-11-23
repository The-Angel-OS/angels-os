'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Users, ShoppingBag, MessageSquare, Calendar, CheckCircle2, ArrowRight } from 'lucide-react'

export const FourPillarsMonetization: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'memberships' | 'storefront' | 'spaces' | 'events'>('memberships')

  const pillars = [
    {
      id: 'memberships' as const,
      icon: Users,
      title: 'Memberships & Tiers',
      tagline: 'Duplicate & Surpass Patreon',
      description: 'Predictable, recurring subscription revenue directly from your most dedicated supporters. Set your own custom monthly or annual tiers with instant unlock gates.',
      color: 'from-blue-600 to-indigo-600',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      features: [
        'Custom membership tiers ($5, $15, $50/mo or annual discounts)',
        'Patreon-style JoinToUnlockModal gating on exclusive videos and posts',
        'Direct recurring billing via Square & PayPal (zero platform escrow delays)',
        'Automated member badges and private channel permissions',
      ],
      previewImg: '/images/creator-spaces-preview.svg',
      ctaLabel: 'Explore Membership Engine',
      ctaUrl: '/start?focus=memberships',
    },
    {
      id: 'storefront' as const,
      icon: ShoppingBag,
      title: 'Creator Stores & POD Merch',
      tagline: 'Zero Inventory Risk Commerce',
      description: 'Sell physical Print-on-Demand merchandise and high-margin digital products to anyone — fans don’t even have to be paying monthly members to shop.',
      color: 'from-pink-600 to-rose-600',
      badgeColor: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
      features: [
        'Zero-inventory apparel (heavyweight hoodies, tees, embroidered dad hats)',
        'Automated Printful v2 & Printify order fulfillment (Sprint D POD engine)',
        'Digital goods: unreleased audio stems, presets, video courses, research PDFs',
        'Automatic member discounts (e.g. "Members get 15% off all merch")',
      ],
      previewImg: '/images/creator-merch-mockup.svg',
      ctaLabel: 'Launch Creator Storefront',
      ctaUrl: '/start?focus=storefront',
    },
    {
      id: 'spaces' as const,
      icon: MessageSquare,
      title: 'Community Spaces & Chat',
      tagline: 'Own Your Social Graph',
      description: 'Replace fragmented Discord servers and Facebook groups with branded, real-time threaded chat rooms and audio spaces hosted directly on your domain.',
      color: 'from-violet-600 to-purple-600',
      badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      features: [
        'Discord-style topic channels, announcements, and back-stage chat',
        'Live voice channels & audio hangouts directly in the browser',
        'Zero algorithm suppression — 100% of fans see your announcements',
        'Granular permissions by membership tier or public standing',
      ],
      previewImg: '/images/creator-spaces-preview.svg',
      ctaLabel: 'Build Your Community Space',
      ctaUrl: '/start?focus=spaces',
    },
    {
      id: 'events' as const,
      icon: Calendar,
      title: 'Paid Events & 1-on-1 Sessions',
      tagline: 'Ticketing & Client Bookings',
      description: 'Host paid virtual workshops, masterclasses, and bookable 1-on-1 strategy sessions without paying Calendly, Eventbrite, or Zoom add-on fees.',
      color: 'from-amber-600 to-orange-600',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      features: [
        'Square-powered ticket checkouts with automated ticket generation',
        '1-on-1 client bookings with custom availability windows & deposit rules',
        'Automated email confirmation, calendar ICS invites, and refund handling',
        'Integrated member-only ticket pricing and VIP access passes',
      ],
      previewImg: '/images/leo-ai-chat-preview.svg',
      ctaLabel: 'Set Up Bookings & Events',
      ctaUrl: '/start?focus=events',
    },
  ]

  const current = pillars.find((p) => p.id === activeTab) || pillars[0]

  return (
    <section id="four-pillars" className="relative w-full py-16 overflow-hidden scroll-mt-16">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="container relative z-10">
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            Four Pillars of Creator Independence
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            Everything You Need to Monetize. Zero Fragmented SaaS.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            Patreon charges 8–12% just for memberships. Shopify costs $39/mo for merch. Circle costs $89/mo for chat.
            Angel OS unites all four revenue pillars under your own domain for just <span className="font-semibold text-foreground">$10/month and 4%</span>.
          </p>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1.5 rounded-xl bg-card/60 backdrop-blur border border-border max-w-4xl mx-auto mb-10">
          {pillars.map((pillar) => {
            const Icon = pillar.icon
            const isSelected = activeTab === pillar.id
            return (
              <button
                key={pillar.id}
                onClick={() => setActiveTab(pillar.id)}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{pillar.title.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* Active Tab Showcase Panel */}
        <div className="grid gap-8 lg:grid-cols-12 items-center rounded-2xl border border-border/80 bg-card/40 backdrop-blur-md p-6 sm:p-10 shadow-xl">
          {/* Copy Column (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md text-xs font-bold border ${current.badgeColor} w-fit mb-3`}>
              {current.tagline}
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
              {current.title}
            </h3>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              {current.description}
            </p>

            {/* Checklist */}
            <ul className="mt-6 space-y-3">
              {current.features.map((feat, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Link
                href={current.ctaUrl}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                {current.ctaLabel}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Media Preview Column (7 cols) */}
          <div className="lg:col-span-7 relative group overflow-hidden rounded-xl border border-border/60 bg-black/40 p-2 shadow-inner aspect-[16/10]">
            <div className="relative w-full h-full rounded-lg overflow-hidden">
              <Image
                src={current.previewImg}
                alt={current.title}
                fill
                className="object-contain p-2 transition-transform duration-500 group-hover:scale-[1.02]"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
