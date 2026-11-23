'use client'

import React from 'react'
import Link from 'next/link'
import {
  PLAN_ANNUAL_PRICE_CENTS,
  PLAN_FEE_BPS,
  PLAN_PRICE_CENTS,
  PORTAL_QUOTA,
  type PortalPlan,
} from '@/utilities/portalPlan'
import { UpgradeButton } from './UpgradeButton'
import { PlanReturnConfirm } from './PlanReturnConfirm'

type CardPlan = 'free' | 'creator' | 'site' | 'business'

type Tier = {
  id: CardPlan
  name: string
  badge?: string
  price: string
  annualNote?: string
  fee: string
  summary: string
  adds: string[]
}

const priceOf = (id: CardPlan) =>
  PLAN_PRICE_CENTS[id] === 0 ? '$0' : `$${PLAN_PRICE_CENTS[id] / 100}/mo`

const annualOf = (id: CardPlan) =>
  PLAN_ANNUAL_PRICE_CENTS[id] > 0
    ? `or $${Math.round(PLAN_ANNUAL_PRICE_CENTS[id] / 100)}/yr`
    : undefined

const feePctOf = (id: CardPlan) => Number((PLAN_FEE_BPS[id] / 100).toFixed(2)).toString()

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Starter (Preview)',
    price: priceOf('free'),
    fee: `${feePctOf('free')}% platform fee (capped at $9.99/txn)`,
    summary: 'Zero-friction live preview on a spacesangels.com address. Keep it as long as you want.',
    adds: [
      `Instant handle.spacesangels.com portal (${PORTAL_QUOTA.free} portal)`,
      'Public YouTube video catalog mirrored',
      'Pages, posts, donations & SSL hosting',
      'Basic LEO AI preview',
      'Angel OS footer credit',
    ],
  },
  {
    id: 'creator',
    name: 'Creator',
    badge: 'Most Popular',
    price: priceOf('creator'),
    annualNote: annualOf('creator'),
    fee: `${feePctOf('creator')}% platform fee — half of Patreon`,
    summary: 'Unlock paid memberships, your custom domain, and LEO AI trained on your channel.',
    adds: [
      'Paid memberships & gated videos/posts',
      'LEO Site AI + YouTube transcript RAG search',
      'Spaces community, Events, Bookings & Merch',
      'Your own custom domain, pointed and secured',
      'Direct Square OAuth payouts + PayPal/Venmo',
    ],
  },
  {
    id: 'site',
    name: 'Pro',
    price: priceOf('site'),
    annualNote: annualOf('site'),
    fee: `${feePctOf('site')}% platform fee (capped at $9.99/txn)`,
    summary: 'White-label branding, CRM tools, and lower fees — pays for itself around $800/mo sales.',
    adds: [
      'Everything in Creator',
      'White-label footer ("Powered by The Angel OS" removed)',
      'CRM customer list & member follow-ups',
      'Higher LEO quota & optional BYOK AI keys',
      `Up to ${PORTAL_QUOTA.site} portals included`,
    ],
  },
  {
    id: 'business',
    name: 'Studio',
    price: priceOf('business'),
    annualNote: annualOf('business'),
    fee: `${feePctOf('business')}% platform fee on all sales`,
    summary: 'Zero platform cut on anything you earn — built for high-volume creators and studios.',
    adds: [
      'Everything in Pro',
      '0% Angel OS platform fee on memberships, merch & bookings',
      `Up to ${PORTAL_QUOTA.business} portals under one roof`,
      'Team seats & priority support',
    ],
  },
]

export function PlanPanel({
  plan,
  tenantName,
  embedded = false,
}: {
  plan: PortalPlan
  tenantName?: string
  embedded?: boolean
}) {
  const isDemo = plan === 'demo'
  const isAgency = plan === 'agency'
  const offCard = isDemo || isAgency
  const current = (offCard ? 'business' : plan) as CardPlan
  const currentIndex = TIERS.findIndex((t) => t.id === current)

  return (
    <div className={embedded ? 'space-y-4' : 'mx-auto max-w-6xl p-6'}>
      {embedded ? (
        <h2 className="text-lg font-semibold">Plan &amp; Billing</h2>
      ) : (
        <h1 className="text-2xl font-bold">Your plan</h1>
      )}

      <PlanReturnConfirm />

      {isDemo ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {tenantName ? `${tenantName} is a ` : 'This is a '}
          <strong className="text-foreground">demonstration portal</strong> — capabilities are
          switched on with a 0% platform fee and nothing is being billed.
        </p>
      ) : isAgency ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {tenantName ? `${tenantName} is on the ` : 'This portal is on the '}
          <strong className="text-foreground">Agency plan</strong> — everything in Studio, plus room
          for {PORTAL_QUOTA.agency} portals. Each site you launch carries its own plan.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {tenantName ? `${tenantName} is on ` : 'This portal is on '}
          <strong className="text-foreground">
            {TIERS[currentIndex >= 0 ? currentIndex : 0]!.name}
          </strong>
          . Nothing gets rebuilt when you move up — a paid plan unlocks memberships, LEO AI, and
          lower platform fees on the site you already have.
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((tier, i) => {
          const isCurrent = !offCard && tier.id === current
          const isUpgrade = i > currentIndex
          return (
            <div
              key={tier.id}
              className={`flex flex-col rounded-lg border p-5 ${
                isCurrent
                  ? 'border-primary bg-primary/5'
                  : tier.badge
                    ? 'border-primary/40 bg-card'
                    : 'border-border bg-card'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{tier.name}</h3>
                <div className="text-right">
                  <span className="text-sm font-semibold text-foreground">{tier.price}</span>
                  {tier.annualNote && (
                    <p className="text-[11px] text-muted-foreground">{tier.annualNote}</p>
                  )}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {isCurrent && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Current plan
                  </span>
                )}
                {!isCurrent && tier.badge && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                    {tier.badge}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{tier.summary}</p>
              <p className="mt-2 text-xs font-medium text-foreground/80">{tier.fee}</p>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm text-muted-foreground">
                {tier.adds.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span aria-hidden="true" className="text-primary">
                      ·
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
              {isUpgrade &&
                !offCard &&
                (tier.id === 'creator' || tier.id === 'site' || tier.id === 'business') && (
                  <UpgradeButton plan={tier.id} label={tier.name} />
                )}
            </div>
          )
        })}
      </div>

      {!isAgency && (
        <p className="mt-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Managing client sites or networks?</strong> The
          Agency plan supports up to {PORTAL_QUOTA.agency} portals, priced as a conversation rather
          than a checkout.{' '}
          <Link className="underline" href="/dashboard/spaces">
            Ask Leo
          </Link>{' '}
          and we will set it up.
        </p>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Prices are per site, per month, in US dollars. No setup fee, no contract, cancel any month.
        Full detail on{' '}
        <a
          className="underline"
          href="https://spacesangels.com/pricing"
          target="_blank"
          rel="noopener noreferrer"
        >
          the pricing page
        </a>
        . Questions?{' '}
        <Link className="underline" href="/dashboard/spaces">
          Ask Leo
        </Link>
        .
      </p>
    </div>
  )
}
