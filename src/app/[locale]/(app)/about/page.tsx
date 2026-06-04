import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Metadata } from 'next'
import React from 'react'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'
import { CollectionHero } from '@/components/CollectionHero'

export async function generateMetadata(): Promise<Metadata> {
  const { tenant } = await resolveTenantFromHeaders()
  const siteName = tenant?.branding?.siteName || tenant?.name || 'Angel OS'
  return {
    title: `About | ${siteName}`,
    description: `Learn more about ${siteName} — our mission, our team, and why we exist.`,
  }
}

/**
 * About page — tenant-aware with automatic fallback.
 *
 * 1. Checks if a CMS page with slug 'about' exists for this tenant
 * 2. If yes, renders it (via redirect to the dynamic [slug] route)
 * 3. If no, generates a branded about page from tenant + endeavor data
 */
export default async function AboutPage() {
  const payload = await getPayload({ config: configPromise })
  const { tenant, tenantFilter } = await resolveTenantFromHeaders()

  // Check for CMS-managed about page
  try {
    const pages = await payload.find({
      collection: 'pages',
      where: {
        and: [
          { slug: { equals: 'about' } },
          tenantFilter,
          { _status: { equals: 'published' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (pages.docs.length > 0) {
      // CMS page exists — render via dynamic route
      const { redirect } = await import('next/navigation')
      redirect('/about')
    }
  } catch {
    // Fall through to generated about page
  }

  // Generate branded about page from tenant data
  const siteName = tenant?.branding?.siteName || tenant?.name || 'Angel OS'
  const description = (tenant as any)?.description || ''

  // Try to find the endeavor record for richer data
  let endeavor: any = null
  if (tenant?.id) {
    try {
      const endeavors = await payload.find({
        collection: 'endeavors' as any,
        where: { tenant: { equals: tenant.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      endeavor = endeavors.docs[0] || null
    } catch {
      // Endeavors collection may not exist
    }
  }

  const missionStatement = endeavor?.missionStatement || ''
  const capabilities: Array<{ skill: string; description: string }> = endeavor?.capabilities || []
  const operator = endeavor?.operator || null

  return (
    <div className="container py-8">
      <CollectionHero
        title={`About ${siteName}`}
        subtitle={description || 'Our mission, our story, our purpose.'}
        image={tenantHeroImage(tenant)}
      />

      <div className="mx-auto max-w-3xl space-y-10 py-8">
        {/* Mission Statement */}
        {missionStatement && (
          <section>
            <h2 className="mb-4 text-2xl font-bold text-foreground">Our Mission</h2>
            <blockquote className="border-l-4 border-primary pl-4 text-lg italic text-muted-foreground">
              {missionStatement}
            </blockquote>
          </section>
        )}

        {/* Capabilities */}
        {capabilities.length > 0 && (
          <section>
            <h2 className="mb-6 text-2xl font-bold text-foreground">What We Do</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {capabilities.map((cap, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-5">
                  <h3 className="mb-2 font-semibold text-foreground">{cap.skill}</h3>
                  <p className="text-sm text-muted-foreground">{cap.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Team / Operator */}
        {operator && (
          <section>
            <h2 className="mb-4 text-2xl font-bold text-foreground">Leadership</h2>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="font-semibold text-foreground">{operator.name}</p>
              <p className="text-sm text-muted-foreground">{operator.role}</p>
            </div>
          </section>
        )}

        {/* Fallback for default/platform tenant */}
        {!missionStatement && !capabilities.length && (
          <section className="space-y-4 text-muted-foreground">
            <p>
              Angel OS is the open-source platform where every business gets a Guardian Angel
              — an AI-powered assistant that knows your products, manages your bookings,
              and serves your customers with genuine care.
            </p>
            <p>
              Built by a community household in Clearwater, Florida. No salaries, no venture
              capital, no platform fees. Every dollar goes to keeping the lights on, the servers
              running, and the people fed.
            </p>
            <p>
              We believe in dignity, transparency, service, non-harm, accountability,
              sovereignty, and portability. These aren&apos;t corporate values — they&apos;re
              constitutional principles forged into code.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
