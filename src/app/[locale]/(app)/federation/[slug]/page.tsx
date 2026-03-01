import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { ProductGridItem } from '@/components/ProductGridItem'
import { Grid } from '@/components/Grid'
import Link from 'next/link'
import type { Metadata } from 'next'

// Shared label maps
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  // Try to find endeavor by name match (slugified)
  const endeavors = await payload.find({
    collection: 'endeavors',
    where: {
      'federation.networkVisible': { equals: true },
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  const endeavor = endeavors.docs.find(
    (doc: any) => slugify(doc.name || '') === slug,
  )

  if (!endeavor) {
    return { title: 'Enterprise Not Found' }
  }

  return {
    title: `${(endeavor as any).name} — Angel OS Federation`,
    description: (endeavor as any).tagline || (endeavor as any).description || 'An Enterprise in the Angel OS Federation',
  }
}

export default async function EndeavorPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Find endeavor by slugified name match
  const endeavors = await payload.find({
    collection: 'endeavors',
    where: {
      'federation.networkVisible': { equals: true },
    },
    limit: 200,
    depth: 1,
    overrideAccess: true,
  })

  const endeavor = endeavors.docs.find(
    (doc: any) => slugify(doc.name || '') === slug,
  ) as any

  if (!endeavor) {
    notFound()
  }

  // Get the endeavor's tenant to query their products
  const tenantId = typeof endeavor.tenant === 'object' ? endeavor.tenant?.id : endeavor.tenant
  let products: any[] = []

  if (tenantId) {
    try {
      const productResult = await payload.find({
        collection: 'products',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { _status: { equals: 'published' } } as any,
          ],
        },
        limit: 12,
        depth: 1,
        overrideAccess: true,
        sort: '-createdAt',
        select: {
          title: true,
          slug: true,
          gallery: true,
          categories: true,
          priceInUSD: true,
          meta: true,
        },
      })
      products = productResult.docs
    } catch {
      // Products query may fail if tenant doesn't match — non-fatal
    }
  }

  // Serialize endeavor data
  const name = endeavor.name || 'Unnamed Enterprise'
  const tagline = endeavor.tagline || ''
  const description = endeavor.description || ''
  const missionStatement = endeavor.missionStatement || ''
  const endeavorType = endeavor.endeavorType || 'custom'
  const holonTypes: string[] = endeavor.holonTypes || []
  const capabilities: Array<{ skill: string; description: string }> = (endeavor.capabilities || []).map(
    (c: any) => ({ skill: c.skill || '', description: c.description || '' }),
  )
  const operator = {
    name: endeavor.operator?.name || '',
    role: endeavor.operator?.role || '',
  }
  const region = {
    city: endeavor.region?.city || '',
    state: endeavor.region?.state || '',
    country: endeavor.region?.country || '',
  }
  const federation = {
    federationId: endeavor.federation?.federationId || '',
    ministryStatus: endeavor.federation?.ministryStatus || 'applicant',
    constitutionVersion: endeavor.federation?.constitutionVersion || '',
    constitutionSignedAt: endeavor.federation?.constitutionSignedAt || '',
  }
  const logo = endeavor.logo?.url || null
  const coverImage = endeavor.coverImage?.url || null

  const regionParts = [region.city, region.state, region.country].filter(Boolean)
  const regionText = regionParts.join(', ')

  const isBookingBased = holonTypes.includes('guardian-angel') ||
    endeavorType === 'booking-based' ||
    endeavorType === 'service-provider'

  return (
    <div className="min-h-screen">
      {/* Cover Image */}
      {coverImage ? (
        <div className="relative h-48 w-full overflow-hidden bg-muted md:h-64 lg:h-72">
          <img
            src={coverImage}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
      ) : (
        <div className="h-32 w-full bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5" />
      )}

      <div className="container relative">
        {/* Logo + Identity */}
        <div className={`${coverImage ? '-mt-12' : 'pt-8'} mb-8 flex items-end gap-4`}>
          {logo ? (
            <img
              src={logo}
              alt={name}
              className="h-24 w-24 shrink-0 rounded-2xl border-4 border-background bg-background object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-4 border-background bg-primary/10 text-3xl font-bold text-primary shadow-lg">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 pb-1">
            <h1 className="text-2xl font-bold md:text-3xl">{name}</h1>
            {tagline && (
              <p className="text-lg text-muted-foreground">{tagline}</p>
            )}
          </div>
        </div>

        {/* Badges Row */}
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {/* Endeavor Type */}
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
            {TYPE_LABELS[endeavorType] || endeavorType}
          </span>

          {/* Holon Types */}
          {holonTypes.map((type: string) => (
            <span
              key={type}
              className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {HOLON_LABELS[type] || type}
            </span>
          ))}

          {/* Region */}
          {regionText && (
            <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
              📍 {regionText}
            </span>
          )}

          {/* Federation Status */}
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${
              STATUS_STYLES[federation.ministryStatus] || STATUS_STYLES.applicant
            }`}
          >
            {federation.ministryStatus}
          </span>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-8 pb-16 lg:grid-cols-3">
          {/* Left Column: About + Mission + Capabilities */}
          <div className="space-y-8 lg:col-span-2">
            {/* Mission Statement */}
            {missionStatement && (
              <section className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Mission
                </h2>
                <p className="text-muted-foreground leading-relaxed">{missionStatement}</p>
              </section>
            )}

            {/* Description */}
            {description && (
              <section className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-3 text-lg font-semibold">About</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{description}</p>
              </section>
            )}

            {/* Capabilities */}
            {capabilities.length > 0 && (
              <section className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold">Capabilities</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {capabilities.map((cap, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border/50 bg-muted/30 p-4"
                    >
                      <h3 className="mb-1 font-medium">{cap.skill}</h3>
                      {cap.description && (
                        <p className="text-sm text-muted-foreground">{cap.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Products Section */}
            {products.length > 0 && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Shop This Enterprise</h2>
                  <span className="text-sm text-muted-foreground">
                    {products.length} product{products.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <Grid className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {products.map((product: any) => (
                    <ProductGridItem key={product.id} product={product} />
                  ))}
                </Grid>
              </section>
            )}

            {/* Booking CTA */}
            {isBookingBased && (
              <section className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold">Book a Service</h3>
                <p className="mb-4 text-muted-foreground">
                  {name} offers bookable services. Schedule a session, consultation, or appointment.
                </p>
                <span className="inline-block rounded-lg bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
                  Booking page coming soon
                </span>
              </section>
            )}
          </div>

          {/* Right Column: Sidebar */}
          <div className="space-y-6">
            {/* Operator Card */}
            {operator.name && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Operated By
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {operator.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{operator.name}</p>
                    {operator.role && (
                      <p className="text-sm text-muted-foreground">{operator.role}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Federation Info */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Federation
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="capitalize font-medium">{federation.ministryStatus}</span>
                </div>
                {federation.constitutionVersion && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Constitution</span>
                    <span>v{federation.constitutionVersion}</span>
                  </div>
                )}
                {federation.constitutionSignedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signed</span>
                    <span>{new Date(federation.constitutionSignedAt).toLocaleDateString()}</span>
                  </div>
                )}
                {federation.federationId && (
                  <div>
                    <span className="text-muted-foreground">Federation ID</span>
                    <code className="mt-1 block rounded bg-muted px-2 py-1 text-xs break-all">
                      {federation.federationId}
                    </code>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Explore
              </h3>
              <div className="space-y-2">
                <Link
                  href="/federation/discover"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Discover More Enterprises
                </Link>
                <Link
                  href="/federation/street-signs"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  Browse Street Signs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
