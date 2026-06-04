import React from 'react'

/**
 * CollectionHero — Branded hero banner for collection listing pages.
 *
 * Uses tenant branding CSS variables (--tenant-primary, --tenant-secondary)
 * to render a gradient hero that matches the current portal's brand.
 * Falls back gracefully to the global theme colors when no tenant is active.
 *
 * Designed to visually bridge the gap between the polished home page hero
 * and the plain collection listings (Posts, Events, Shop, etc.).
 */
export function CollectionHero({
  title,
  subtitle,
  icon,
  image,
}: {
  title: string
  subtitle?: string
  /** Optional emoji or icon displayed above the title */
  icon?: string
  /**
   * Optional background image (the tenant's branding.coverImage). When set, the
   * splash inherits the portal's hero image — visually unifying the list pages
   * with the home page. Falls back to the brand gradient when absent.
   */
  image?: string | null
}) {
  return (
    <section
      className="relative mb-8 overflow-hidden rounded-xl"
      style={{
        background: `linear-gradient(135deg,
          var(--tenant-primary, hsl(var(--primary))) 0%,
          var(--tenant-secondary, hsl(var(--secondary))) 50%,
          var(--tenant-primary, hsl(var(--primary))) 100%)`,
      }}
    >
      {/* Tenant hero image (inherited from branding.coverImage) */}
      {image && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Legibility overlay so white text stays readable over any image */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)' }}
          />
        </>
      )}

      {/* Subtle pattern overlay (gradient mode only) */}
      {!image && (
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 40%)`,
          }}
        />
      )}

      <div className="relative z-10 px-6 py-16 text-center sm:py-20 md:py-24">
        {icon && (
          <div className="mb-4 text-4xl opacity-80" aria-hidden="true">
            {icon}
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-3 max-w-xl text-base text-white/80 sm:text-lg">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  )
}
