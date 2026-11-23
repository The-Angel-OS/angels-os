'use client'

import React from 'react'
import Link from 'next/link'
import { PLAN_PRICE_CENTS, PLAN_FEE_BPS, type PortalPlan } from '@/utilities/portalPlan'
import { UpgradeButton } from './UpgradeButton'
import { PlanReturnConfirm } from './PlanReturnConfirm'

type Tier = {
  id: 'free' | 'site' | 'business'
  name: string
  price: string
  fee: string
  summary: string
  adds: string[]
}

const priceOf = (id: Tier['id']) =>
  PLAN_PRICE_CENTS[id] === 0 ? '$0' : `$${PLAN_PRICE_CENTS[id] / 100}/mo`

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    price: priceOf('free'),
    fee: `${PLAN_FEE_BPS.free / 100}% of each deposit, never more than $9.99`,
    summary: 'Your website, live, on a spacesangels.com address. Keep it as long as you like.',
    adds: [
      'Five-page website, built for you',
      'Hosting, SSL and security',
      'A contact form that reaches you',
      'Mobile-friendly, light and dark themes',
      'A small “Powered by The Angel OS” line in the footer',
    ],
  },
  {
    id: 'site',
    name: 'Site',
    price: priceOf('site'),
    fee: `${PLAN_FEE_BPS.site / 100}% of each deposit — half the free rate`,
    summary: 'Your own domain instead of ours, and the footer credit gone.',
    adds: [
      'Your own domain name, pointed and secured',
      'The footer credit removed',
      'Unlimited changes — ask Leo, or edit any page yourself',
      'New pages and posts whenever you want them',
      'Photos generated for you if you don’t have any',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: priceOf('business'),
    fee: 'No booking fee at all',
    summary: 'Everything above, plus the part that actually earns.',
    adds: [
      'Customers book online and leave a deposit that holds the slot',
      'Deposits credited to the final invoice',
      'Your customer list and follow-ups, kept for you',
      'An assistant that answers questions about your business',
      'Memberships and recurring billing for your own customers',
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
  const current = (offCard ? 'business' : plan) as Tier['id']
  const currentIndex = TIERS.findIndex((t) => t.id === current)

  return (
    <div className={embedded ? 'space-y-4' : 'mx-auto max-w-4xl p-6'}>
      {embedded ? (
        <h2 className="text-lg font-semibold">Plan &amp; Billing</h2>
      ) : (
        <h1 className="text-2xl font-bold">Your plan</h1>
      )}

      <PlanReturnConfirm />

      {isDemo ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {tenantName ? `${tenantName} is a ` : 'This is a '}
          <strong className="text-foreground">demonstration portal</strong> — everything below is
          switched on and nothing is being billed. When you are ready to make it yours, the plans
          are here so you know what it costs; nothing gets rebuilt when you pick one.
        </p>
      ) : isAgency ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {tenantName ? `${tenantName} is on the ` : 'This portal is on the '}
          <strong className="text-foreground">Agency plan</strong> — everything in Business, and
          room for a hundred portals. Each site you build still carries its own plan; this one
          governs how many you may hold.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {tenantName ? `${tenantName} is on ` : 'This portal is on '}
          <strong className="text-foreground">
            {TIERS[currentIndex >= 0 ? currentIndex : 0]!.name}
          </strong>
          . Nothing gets rebuilt when you move up — a paid plan unlocks what is already sitting
          behind your site.
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {TIERS.map((tier, i) => {
          const isCurrent = !offCard && tier.id === current
          const isUpgrade = i > currentIndex
          return (
            <div
              key={tier.id}
              className={`flex flex-col rounded-lg border p-5 ${
                isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{tier.name}</h3>
                <span className="text-sm font-medium text-muted-foreground">{tier.price}</span>
              </div>
              {isCurrent && (
                <span className="mt-1 self-start rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Current plan
                </span>
              )}
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
              {isUpgrade && !offCard && (tier.id === 'site' || tier.id === 'business') && (
                <UpgradeButton plan={tier.id} label={tier.name} />
              )}
            </div>
          )
        })}
      </div>

      {!isAgency && (
        <p className="mt-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Building sites for other people?</strong> The Agency
          plan supports up to 100 portals, priced as a conversation rather than a checkout.{' '}
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
