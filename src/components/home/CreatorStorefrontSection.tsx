'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag, Sparkles, Truck, ShieldCheck, ArrowRight, Tag } from 'lucide-react'

export const CreatorStorefrontSection: React.FC = () => {
  const [selectedProduct, setSelectedProduct] = useState(0)

  const products = [
    {
      title: 'Heavyweight Studio Hoodie',
      type: 'Print-on-Demand (POD)',
      price: '$58.00',
      memberPrice: '$48.00',
      description: 'Ultra-heavyweight 420gsm combed cotton with custom high-density chest embroidery. Produced on-demand via Printful v2 & Printify with automated order routing and edge fulfillment.',
      specs: ['100% Combed Cotton (420 GSM)', 'Pre-shrunk organic fabric', 'Zero creator inventory held', 'Dispatched within 48-72h'],
      tag: 'Best Seller',
    },
    {
      title: 'Declassified Research Dossier (PDF)',
      type: 'Instant Digital Download',
      price: '$24.00',
      memberPrice: '$16.00',
      description: '140-page investigative case file with full-color high-resolution architectural scans, LiDAR terrain models, and source references. Delivered instantly upon checkout.',
      specs: ['High-res PDF + ePub editions', 'Watermarked with buyer key', 'Instant download link + email', 'Zero shipping or fulfillment fee'],
      tag: 'Digital Exclusive',
    },
    {
      title: 'Matte Ceramic Studio Mug',
      type: 'Print-on-Demand (POD)',
      price: '$22.00',
      memberPrice: '$18.00',
      description: '15oz heavy ceramic mug in matte charcoal with laser-engraved insignia. Dishwasher and microwave safe. Drop-shipped directly to fans worldwide.',
      specs: ['15oz capacity ceramic', 'Precision laser engraving', 'Eco-friendly cardboard mailer', 'Worldwide shipping tracked'],
      tag: 'New Drop',
    },
    {
      title: 'VIP 1-on-1 Consultation (60 Min)',
      type: 'Bookable Client Session',
      price: '$150.00',
      memberPrice: '$120.00',
      description: 'Private 1-on-1 strategy video call directly with the creator. Automated calendar availability sync with Square booking checkout and automated Google Meet / Zoom links.',
      specs: ['Direct calendar integration', 'Automated ICS calendar invite', 'Square payment guarantee', 'Custom intake questionnaire'],
      tag: 'High Ticket',
    },
  ]

  const active = products[selectedProduct]

  return (
    <section id="creator-storefront" className="relative w-full py-16 bg-muted/20 border-y border-border/60 scroll-mt-16">
      <div className="container">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <ShoppingBag className="w-3.5 h-3.5" />
            Zero-Inventory Creator Commerce
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            Launch Your Storefront With Zero Upfront Cost or Inventory
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            Duplicate Patreon’s commerce power on your own domain. Sell custom merchandise, digital downloads, and bookings to any visitor — fans don’t even have to be paying monthly members to buy from your shop.
          </p>
        </div>

        {/* Storefront Interactive Showcase (Kessela ProductPanel Style) */}
        <div className="grid gap-10 lg:grid-cols-12 items-center rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6 sm:p-10 shadow-2xl">
          {/* Left Column: Visual Mockup Canvas (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden border border-border/80 bg-zinc-950 p-2 shadow-inner group">
              <Image
                src="/images/creator-merch-mockup.svg"
                alt="Creator Merchandise Showcase"
                fill
                className="object-contain p-2 transition-transform duration-500 group-hover:scale-[1.02]"
                priority
              />
              <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold backdrop-blur">
                <Sparkles className="w-3.5 h-3.5" />
                Live POD Engine (Printful &amp; Printify)
              </div>
            </div>

            {/* Product Switcher Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {products.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedProduct(idx)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                    selectedProduct === idx
                      ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-sm'
                      : 'border-border/60 bg-card/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  }`}
                >
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-[11px] text-primary mt-0.5">{p.price}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Kessela-style Product Detail Specs (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
                {active.type}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {active.tag}
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
              {active.title}
            </h3>

            {/* Price Row */}
            <div className="flex items-baseline gap-3 mt-3">
              <span className="text-3xl font-extrabold text-primary">
                {active.price}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
                Members Pay {active.memberPrice}
              </span>
            </div>

            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              {active.description}
            </p>

            {/* Feature Specs */}
            <div className="mt-6 border-t border-border/80 pt-5 space-y-2">
              {active.specs.map((spec, i) => (
                <div key={i} className="flex items-center gap-2 text-xs sm:text-sm text-foreground/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>{spec}</span>
                </div>
              ))}
            </div>

            {/* Trust highlights */}
            <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground pt-4 border-t border-border/60">
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-emerald-500" />
                Auto-Fulfilled
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                Square Payout
              </span>
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-purple-500" />
                0% Inventory
              </span>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/start?focus=storefront"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                Create Your Creator Store
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/shop"
                className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                Browse Live Merch Demo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
