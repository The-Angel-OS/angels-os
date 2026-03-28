'use client'

import React from 'react'
import Link from 'next/link'

export interface FederationHolon {
  id: number | string
  name: string
  tagline: string
  description: string
  endeavorType: string
  holonTypes: string[]
  missionStatement: string
  status: string
  capabilities: Array<{ skill: string; description: string }>
  region: { city: string; state: string; country: string }
  federation: { federationId: string; ministryStatus: string }
  logo: string | null
  coverImage: string | null
  /** Canonical storefront URL — used for card link + OG unfurl */
  storefrontUrl: string | null
  /** Tenant branding context */
  tenant?: {
    slug: string
    siteName: string | null
    domain: string | null
  } | null
}

const HOLON_LABELS: Record<string, string> = {
  manufacturer: 'Manufacturer',
  retailer: 'Retailer',
  creator: 'Creator',
  community: 'Community',
  'guardian-angel': 'Guardian Angel',
}

const TYPE_LABELS: Record<string, string> = {
  'service-provider': 'Service Provider',
  'retail-commerce': 'Retail & Commerce',
  'creator-content': 'Creator & Content',
  'booking-based': 'Booking & Scheduling',
  custom: 'Custom',
}

const STATUS_STYLES: Record<string, string> = {
  applicant: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  probation: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function FederationCard({ holon }: { holon: FederationHolon }) {
  const regionParts = [holon.region.city, holon.region.state, holon.region.country].filter(Boolean)
  const regionText = regionParts.length > 0 ? regionParts.join(', ') : null

  // Primary link: storefront URL if available, else internal federation detail page
  const href = holon.storefrontUrl || `/federation/${slugify(holon.name)}`
  const isExternal = !!holon.storefrontUrl?.startsWith('http')

  // Configure link: tenant dashboard → endeavor settings
  const configureHref = holon.tenant?.slug
    ? `/dashboard/endeavor`
    : null

  const CardWrapper = isExternal ? 'a' : Link
  const cardProps = isExternal
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { href }

  return (
    <div className="group relative rounded-lg border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md">
      {/* Configure shortcut — top-right corner */}
      {configureHref && (
        <Link
          href={configureHref}
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-all hover:bg-primary hover:text-primary-foreground group-hover:opacity-100"
          title="Configure this Endeavor"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      )}

      <CardWrapper {...(cardProps as any)} className="block">
        {/* Cover Image */}
        {holon.coverImage && (
          <div className="h-32 w-full overflow-hidden rounded-t-lg">
            <img
              src={holon.coverImage}
              alt={`${holon.name || 'Enterprise'} cover`}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}

        <div className="p-5">
          {/* Header */}
          <div className="mb-3 flex items-start gap-3">
            {holon.logo ? (
              <img
                src={holon.logo}
                alt={holon.name}
                className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {holon.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold">{holon.name}</h3>
              {holon.tagline && (
                <p className="truncate text-sm text-muted-foreground">{holon.tagline}</p>
              )}
            </div>
          </div>

          {/* Holon Type Badges */}
          {holon.holonTypes.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {holon.holonTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                >
                  {HOLON_LABELS[type] || type}
                </span>
              ))}
            </div>
          )}

          {/* Type + Region + Status */}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{TYPE_LABELS[holon.endeavorType] || holon.endeavorType}</span>
            {regionText && (
              <>
                <span className="text-border">|</span>
                <span>{regionText}</span>
              </>
            )}
            <span className="text-border">|</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                STATUS_STYLES[holon.federation.ministryStatus] || STATUS_STYLES.applicant
              }`}
            >
              {holon.federation.ministryStatus}
            </span>
          </div>

          {/* Capabilities */}
          {holon.capabilities.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-1.5">
                {holon.capabilities.slice(0, 4).map((cap, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    title={cap.description}
                  >
                    {cap.skill}
                  </span>
                ))}
                {holon.capabilities.length > 4 && (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    +{holon.capabilities.length - 4} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Description preview */}
          {holon.description && (
            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{holon.description}</p>
          )}

          {/* Storefront URL + Federation ID */}
          <div className="flex items-center justify-between text-xs text-muted-foreground/60">
            {holon.storefrontUrl ? (
              <span className="truncate" title={holon.storefrontUrl}>
                {holon.storefrontUrl.replace(/^https?:\/\//, '')}
              </span>
            ) : holon.tenant?.slug ? (
              <span className="truncate">
                {holon.tenant.siteName || holon.tenant.slug}
              </span>
            ) : null}
            {holon.federation.federationId && (
              <code className="rounded bg-muted px-1 text-[10px]">{holon.federation.federationId.slice(0, 12)}...</code>
            )}
          </div>
        </div>
      </CardWrapper>
    </div>
  )
}
