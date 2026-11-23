'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Check, Sparkles, ArrowRight } from 'lucide-react'

export const PricingLadderSection: React.FC = () => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')

  const plans = [
    {
      name: 'Starter (Preview)',
      tagline: 'Zero-friction exploration',
      monthlyPrice: '$0',
      annualPrice: '$0',
      periodLabel: '/mo',
      fee: '5% platform fee',
      popular: false,
      ctaText: 'Start Free Preview',
      ctaUrl: '/start?plan=starter',
      features: [
        'Instant yourhandle.spacesangels.com subdomain',
        'Public YouTube video & post mirror',
        'Basic pages, blog & donation support',
        'Limited LEO AI assistant demo',
        'Standard edge SSL & Cloudflare security',
        'Angel OS footer badge',
      ],
    },
    {
      name: 'Creator (Flagship)',
      tagline: 'The sweet spot for 90% of YouTubers',
      monthlyPrice: '$10',
      annualPrice: '$99',
      periodLabel: billingPeriod === 'monthly' ? '/mo' : '/year ($8.25/mo)',
      fee: '4% platform fee (Half of Patreon!)',
      popular: true,
      ctaText: 'Launch Creator Portal',
      ctaUrl: '/start?plan=creator',
      features: [
        'Everything in Starter, plus:',
        'Memberships & recurring patron subscriptions',
        'Creator Storefront & Print-on-Demand (POD) merch',
        'Community Spaces & real-time Discord-style chat',
        'Square paid event ticketing & 1-on-1 bookings',
        'LEO AI trained on your YouTube back-catalog',
        'Custom domain support (yourdomain.com)',
        'Dual-rail Square + PayPal direct payouts',
      ],
    },
    {
      name: 'Creator Pro',
      tagline: 'For creators earning $800+/month',
      monthlyPrice: '$29',
      annualPrice: '$290',
      periodLabel: billingPeriod === 'monthly' ? '/mo' : '/year ($24/mo)',
      fee: '1.5% platform fee',
      popular: false,
      ctaText: 'Upgrade to Pro',
      ctaUrl: '/start?plan=pro',
      features: [
        'Everything in Creator, plus:',
        '100% White-label (hide Angel OS branding)',
        'CRM audience manager & broadcast emails',
        'Higher LEO AI indexing quota / BYOK keys',
        'Up to 3 active portal domains',
        'Priority transcript vector re-indexing',
      ],
    },
    {
      name: 'Studio',
      tagline: 'For high earners & multi-channel brands',
      monthlyPrice: '$79',
      annualPrice: '$790',
      periodLabel: billingPeriod === 'monthly' ? '/mo' : '/year ($65/mo)',
      fee: '0% platform fee (Keep 100%!)',
      popular: false,
      ctaText: 'Launch Studio',
      ctaUrl: '/start?plan=studio',
      features: [
        'Everything in Pro, plus:',
        '0% Platform Fee on all transactions',
        'Up to 10 active portals under one account',
        'Team seats & multi-channel managers',
        'Dedicated account onboarding & VIP support',
      ],
    },
  ]

  return (
    <section id="pricing-ladder" className="relative w-full py-16 scroll-mt-16">
      <div className="container">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            Transparent Creator Pricing
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            Simple, Creator-Friendly Pricing. No Hidden Take-Rates.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            Start for free, launch for $10/mo, and keep more of what you earn as your channel grows.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'annual' : 'monthly')}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted transition-colors focus:outline-none"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-primary transition-transform ${
                  billingPeriod === 'annual' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingPeriod === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Annual <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold ml-1">Save 18%</span>
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-stretch">
          {plans.map((plan, i) => {
            const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualPrice
            return (
              <div
                key={i}
                className={`relative flex flex-col justify-between rounded-2xl p-6 transition-all ${
                  plan.popular
                    ? 'border-2 border-primary bg-card/80 shadow-2xl scale-[1.02] z-10'
                    : 'border border-border bg-card/40 hover:border-border/80 hover:bg-card/60'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
                    <Sparkles className="w-3 h-3" /> Most Popular
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 min-h-[32px]">{plan.tagline}</p>

                  <div className="mt-4 mb-2 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-foreground">{price}</span>
                    <span className="text-xs text-muted-foreground">{plan.periodLabel}</span>
                  </div>

                  <div className="text-xs font-bold text-primary mb-6">{plan.fee}</div>

                  <div className="border-t border-border/80 pt-4 mb-6">
                    <ul className="space-y-2.5 text-xs text-muted-foreground">
                      {plan.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span className={fIdx === 0 && plan.popular ? 'font-semibold text-foreground' : ''}>
                            {feat}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Link
                  href={plan.ctaUrl}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm font-semibold transition-colors w-full ${
                    plan.popular
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow'
                      : 'border border-border hover:bg-muted text-foreground'
                  }`}
                >
                  {plan.ctaText}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
