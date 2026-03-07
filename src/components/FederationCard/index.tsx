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
  /** Tenant branding context — links card to the storefront */
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
  const href = `/federation/${slugify(holon.name)}`

  return (
    <Link href={href} className="group block rounded-lg border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md">
      {/* Cover Image */}
      {holon.coverImage && (
        <div className="h-32 w-full overflow-hidden rounded-t-lg">
          <img
            src={holon.coverImage}
            alt=""
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

        {/* Storefront + Federation ID */}
        <div className="flex items-center justify-between text-xs text-muted-foreground/60">
          {holon.tenant?.slug && (
            <span className="truncate" title={holon.tenant.domain || holon.tenant.slug}>
              🏪 {holon.tenant.siteName || holon.tenant.slug}
            </span>
          )}
          {holon.federation.federationId && (
            <code className="rounded bg-muted px-1 text-[10px]">{holon.federation.federationId.slice(0, 12)}...</code>
          )}
        </div>
      </div>
    </Link>
  )
}
