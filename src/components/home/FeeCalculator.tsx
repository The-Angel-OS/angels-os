'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { DollarSign, Check, X, ArrowRight, TrendingUp } from 'lucide-react'

export const FeeCalculator: React.FC = () => {
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(3000)

  // Calculations:
  // Angel OS: $10/mo + 4% fee (or $99/yr)
  const angelPlatformFeeMonthly = monthlyRevenue * 0.04
  const angelSubscriptionMonthly = 10
  const angelTotalMonthly = angelPlatformFeeMonthly + angelSubscriptionMonthly
  const angelTotalAnnual = angelTotalMonthly * 12

  // Fragmented Stack:
  // Patreon (average 10% fee on memberships)
  // Shopify ($39/mo)
  // Circle ($89/mo)
  // Calendly ($12/mo)
  const fragmentedSaaSMonthly = 39 + 89 + 12 // $140/mo
  const patreonTakeRate = 0.10 // 10% average Patreon tier cut
  const fragmentedTakeRateMonthly = monthlyRevenue * patreonTakeRate
  const fragmentedTotalMonthly = fragmentedTakeRateMonthly + fragmentedSaaSMonthly
  const fragmentedTotalAnnual = fragmentedTotalMonthly * 12

  // Net Savings:
  const annualSavings = Math.max(0, fragmentedTotalAnnual - angelTotalAnnual)
  const monthlySavings = Math.max(0, fragmentedTotalMonthly - angelTotalMonthly)

  return (
    <section id="fee-calculator" className="relative w-full py-16 overflow-hidden scroll-mt-16">
      <div className="container relative z-10">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <DollarSign className="w-3.5 h-3.5" />
            Transparent Economics
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            Calculate How Much More You Keep With Angel OS
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            Patreon takes up to 12% of your revenue, and you still need Shopify ($39), Circle ($89), and Calendly ($12) to run your business. See how much you save with our unified $10/mo + 4% Creator plan.
          </p>
        </div>

        {/* Calculator Body */}
        <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6 sm:p-10 shadow-2xl">
          {/* Revenue Slider Control */}
          <div className="mb-10 text-center">
            <label className="block text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Your Estimated Monthly Creator Earnings
            </label>
            <div className="text-4xl sm:text-5xl font-black text-foreground tracking-tight mb-4">
              ${monthlyRevenue.toLocaleString()}
              <span className="text-xl sm:text-2xl font-medium text-muted-foreground">/mo</span>
            </div>

            <input
              type="range"
              min="500"
              max="20000"
              step="250"
              value={monthlyRevenue}
              onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
              className="w-full max-w-xl h-3 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between max-w-xl mx-auto text-xs text-muted-foreground mt-2">
              <span>$500/mo</span>
              <span>$5,000/mo</span>
              <span>$10,000/mo</span>
              <span>$20,000/mo</span>
            </div>
          </div>

          {/* Side by Side Comparison Grid */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            {/* Old Fragmented Stack Card */}
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground">Fragmented Creator Stack</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-destructive/20 text-destructive">
                    Patreon + 3 Tools
                  </span>
                </div>

                <ul className="space-y-2.5 text-xs sm:text-sm text-muted-foreground mb-6">
                  <li className="flex items-center gap-2">
                    <X className="w-4 h-4 text-destructive shrink-0" />
                    <span>Patreon Fee (10% avg): <strong>${Math.round(fragmentedTakeRateMonthly).toLocaleString()}/mo</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="w-4 h-4 text-destructive shrink-0" />
                    <span>Shopify Merch Store: <strong>$39/mo</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="w-4 h-4 text-destructive shrink-0" />
                    <span>Circle.so Community Chat: <strong>$89/mo</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="w-4 h-4 text-destructive shrink-0" />
                    <span>Calendly 1-on-1 Bookings: <strong>$12/mo</strong></span>
                  </li>
                </ul>
              </div>

              <div className="border-t border-border/80 pt-4">
                <div className="text-xs text-muted-foreground">You Pay Platform Vendors:</div>
                <div className="text-2xl font-bold text-destructive">
                  ${Math.round(fragmentedTotalMonthly).toLocaleString()}
                  <span className="text-xs font-normal text-muted-foreground">/mo (${Math.round(fragmentedTotalAnnual).toLocaleString()}/yr)</span>
                </div>
              </div>
            </div>

            {/* Angel OS Creator Plan Card */}
            <div className="rounded-xl border-2 border-primary bg-primary/5 p-6 flex flex-col justify-between shadow-lg relative">
              <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider">
                All-in-One Engine
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground">Angel OS Creator Plan</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    Half of Patreon!
                  </span>
                </div>

                <ul className="space-y-2.5 text-xs sm:text-sm text-foreground/90 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Platform Fee (4%): <strong>${Math.round(angelPlatformFeeMonthly).toLocaleString()}/mo</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Creator Plan Platform: <strong>$10/mo ($99/yr)</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Storefront &amp; POD Merch: <strong>Included Free</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Community Spaces &amp; Chat: <strong>Included Free</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>LEO AI Video Archive RAG: <strong>Included Free</strong></span>
                  </li>
                </ul>
              </div>

              <div className="border-t border-border/80 pt-4">
                <div className="text-xs text-muted-foreground">You Pay Angel OS:</div>
                <div className="text-2xl font-bold text-primary">
                  ${Math.round(angelTotalMonthly).toLocaleString()}
                  <span className="text-xs font-normal text-muted-foreground">/mo (${Math.round(angelTotalAnnual).toLocaleString()}/yr)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Annual Savings Banner Highlight */}
          <div className="rounded-xl bg-gradient-to-r from-emerald-950/60 via-emerald-900/40 to-emerald-950/60 border border-emerald-500/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-emerald-300">
                  Annual Creator Savings: ${Math.round(annualSavings).toLocaleString()} / year
                </h4>
                <p className="text-xs text-emerald-400/80">
                  You keep an extra ${Math.round(monthlySavings).toLocaleString()} in your own pocket every single month.
                </p>
              </div>
            </div>

            <Link
              href="/start"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 px-5 py-2.5 text-sm font-bold text-black transition-colors shrink-0 shadow-md"
            >
              Start Your Portal for $10/mo
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
