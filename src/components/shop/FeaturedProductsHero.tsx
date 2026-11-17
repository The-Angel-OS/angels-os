'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Product } from '@/payload-types'
import { Media } from '@/components/Media'

type Props = {
  products: Partial<Product>[]
}

export function FeaturedProductsHero({ products }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)

  // Auto-rotate every 6 seconds if there are multiple items
  useEffect(() => {
    if (products.length <= 1) return
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % products.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [products.length])

  if (!products || products.length === 0) return null

  const activeProduct = products[activeIndex] || products[0]
  const gallery = activeProduct.gallery || []

  // Front mock image
  const frontImage =
    gallery[0]?.image && typeof gallery[0]?.image !== 'string'
      ? gallery[0]?.image
      : activeProduct.meta?.image && typeof activeProduct.meta.image !== 'string'
        ? activeProduct.meta.image
        : null

  // Graphic / artwork image (prefer 3rd or 4th in gallery, fallback to front)
  const artworkImage =
    gallery.length > 2 && gallery[gallery.length - 1]?.image && typeof gallery[gallery.length - 1]?.image !== 'string'
      ? gallery[gallery.length - 1]?.image
      : frontImage

  return (
    <div className="relative mb-10 overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 md:p-8 shadow-2xl">
      {/* Subtle ambient lighting */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative z-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        {/* Left column: Content */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-mono font-semibold uppercase tracking-wider text-amber-400">
              ★ Spotlight Collection
            </span>
            <span className="text-xs font-mono text-slate-400">
              Original Channel Schwag &amp; Apparel
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white line-clamp-2">
            {activeProduct.title}
          </h2>

          <p className="text-sm sm:text-base text-slate-300 line-clamp-2 max-w-xl">
            Custom heavy-duty apparel and investigative emblems. Built with high-resolution master artwork prints.
          </p>

          <div className="flex flex-wrap items-baseline gap-4 pt-1">
            {typeof activeProduct.priceInUSD === 'number' && (
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-amber-400">
                ${(activeProduct.priceInUSD > 100 ? activeProduct.priceInUSD / 100 : activeProduct.priceInUSD).toFixed(2)}
              </span>
            )}
            <span className="text-xs font-mono text-emerald-400">
              ✓ Direct Creator Support · Fast Shipping
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={`/products/${activeProduct.slug}`}
              className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/20"
            >
              View Product &amp; Order →
            </Link>
          </div>

          {/* Product indicator selector */}
          {products.length > 1 && (
            <div className="flex items-center gap-2 pt-4">
              <span className="text-xs font-mono text-slate-400 mr-2">Featured items:</span>
              {products.map((p, idx) => (
                <button
                  key={p.id || idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    idx === activeIndex
                      ? 'w-8 bg-amber-400'
                      : 'w-2.5 bg-slate-700 hover:bg-slate-500'
                  }`}
                  aria-label={`Select product ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right column: Graphic & Mockup Showcase */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <Link
            href={`/products/${activeProduct.slug}`}
            className="group relative flex aspect-square w-full max-w-[340px] items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-transform hover:scale-[1.02]"
          >
            {frontImage && (
              <div className="relative h-full w-full overflow-hidden rounded-lg">
                <Media
                  resource={frontImage}
                  className="h-full w-full object-contain"
                  imgClassName="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                  size="350px"
                />
              </div>
            )}

            {/* Floating artwork preview badge if distinct artwork exists */}
            {artworkImage && artworkImage !== frontImage && (
              <div className="absolute -bottom-3 -right-3 h-20 w-20 rounded-xl border border-amber-500/40 bg-slate-950/90 p-1.5 shadow-xl backdrop-blur-md">
                <Media
                  resource={artworkImage}
                  className="h-full w-full object-contain"
                  imgClassName="h-full w-full object-contain"
                  size="80px"
                />
              </div>
            )}
          </Link>
        </div>
      </div>
    </div>
  )
}
