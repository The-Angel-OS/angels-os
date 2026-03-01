import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'

export const metadata = {
  title: 'Federation — Angel OS',
  description: 'Part of the Angel OS Federation — constitutional commerce for the modern age.',
}

export default async function FederationPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tenant: any = null

  if (tenantSlug) {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenant = tenants.docs?.[0]
  }
  if (!tenant) {
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenant = defaults.docs?.[0]
  }

  // Get this site's Endeavor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let endeavor: any = null
  if (tenant?.id) {
    try {
      const endeavors = await payload.find({
        collection: 'endeavors',
        where: {
          tenant: { equals: tenant.id },
        },
        limit: 1,
        depth: 1,
        overrideAccess: true,
      })
      endeavor = endeavors.docs?.[0]
    } catch {
      // Endeavor may not exist yet
    }
  }

  // Get federation stats
  let peerCount = 0
  try {
    const peers = await payload.find({
      collection: 'endeavors',
      where: {
        'federation.networkVisible': { equals: true },
      },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    peerCount = peers.totalDocs
  } catch {
    // Non-critical
  }

  // Get a sample of StreetSigns from peers
  let streetSigns: Array<{
    id: string
    title: string
    description: string
    contentType: string
    sourceName: string
    thumbnail: string | null
  }> = []
  try {
    const signs = await payload.find({
      collection: 'street-signs',
      where: { status: { equals: 'active' } },
      limit: 6,
      depth: 1,
      overrideAccess: true,
      sort: '-createdAt',
    })
    streetSigns = signs.docs.map((doc: any) => ({
      id: String(doc.id),
      title: doc.title || 'Untitled',
      description: doc.description || '',
      contentType: doc.contentType || 'product',
      sourceName: doc.source?.dioceseName || 'Unknown',
      thumbnail: doc.thumbnail?.url || doc.thumbnail?.filename || null,
    }))
  } catch {
    // StreetSigns collection may not exist yet
  }

  const endeavorName = endeavor?.name || tenant?.name || 'This Enterprise'
  const endeavorTagline = endeavor?.tagline || ''
  const endeavorMission = endeavor?.missionStatement || endeavor?.description || ''
  const capabilities = (endeavor?.capabilities || []).map((c: any) => ({
    skill: c.skill || '',
    description: c.description || '',
  }))
  const holonTypes: string[] = endeavor?.holonTypes || []

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-16 md:py-24">
        <div className="container text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-primary">
            Part of the Angel OS Federation
          </p>
          <h1 className="mb-4 text-3xl font-bold md:text-5xl">
            {endeavorName}
          </h1>
          {endeavorTagline && (
            <p className="mx-auto mb-6 max-w-2xl text-lg text-muted-foreground">
              {endeavorTagline}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/federation/discover"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Discover Enterprises
            </Link>
            <Link
              href="/federation/street-signs"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Browse Street Signs
            </Link>
          </div>
        </div>
      </div>

      <div className="container py-12">
        {/* Network Stats */}
        <div className="mb-12 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-3xl font-bold text-primary">{peerCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enterprise{peerCount !== 1 ? 's' : ''} in Network
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-3xl font-bold text-primary">60%</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Revenue to Sellers (Fair Split)
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-3xl font-bold text-primary">5%</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Every Sale to Justice Fund
            </p>
          </div>
        </div>

        {/* Our Mission Section */}
        {endeavorMission && (
          <div className="mb-12 rounded-xl border border-border bg-card p-8">
            <h2 className="mb-4 text-xl font-bold">Our Mission</h2>
            <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
              {endeavorMission}
            </p>
          </div>
        )}

        {/* Capabilities */}
        {capabilities.length > 0 && (
          <div className="mb-12">
            <h2 className="mb-6 text-xl font-bold">What We Offer</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((cap: { skill: string; description: string }, i: number) => (
                <div key={i} className="rounded-lg border border-border bg-card p-5">
                  <h3 className="mb-1 font-semibold">{cap.skill}</h3>
                  {cap.description && (
                    <p className="text-sm text-muted-foreground">{cap.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Constitutional Commerce */}
        <div className="mb-12 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 p-8">
          <h2 className="mb-6 text-xl font-bold">Constitutional Commerce</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold">The Ultimate Fair Split</h3>
              <p className="text-sm text-muted-foreground">
                Every transaction in the Angel OS Federation follows a constitutional revenue split.
                60% goes directly to the seller, 20% sustains the platform, 15% rewards the Guardian
                Angel who helped make the connection, and 5% flows into the Justice Fund.
              </p>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Everyone Gets an Angel</h3>
              <p className="text-sm text-muted-foreground">
                LEO, your AI assistant, works on every page to help customers find what they need,
                answer questions, and guide them through the shopping experience. Commerce powered by
                empathy, not extraction.
              </p>
            </div>
          </div>
        </div>

        {/* Street Signs from Peers */}
        {streetSigns.length > 0 && (
          <div className="mb-12">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">From the Network</h2>
              <Link
                href="/federation/street-signs"
                className="text-sm text-primary hover:underline"
              >
                View all →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {streetSigns.map((sign) => (
                <div
                  key={sign.id}
                  className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30"
                >
                  {sign.thumbnail && (
                    <div className="mb-3 h-32 overflow-hidden rounded-lg">
                      <img
                        src={sign.thumbnail}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <span className="mb-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                    {sign.contentType}
                  </span>
                  <h3 className="mb-1 font-medium line-clamp-1">{sign.title}</h3>
                  {sign.description && (
                    <p className="mb-2 text-sm text-muted-foreground line-clamp-2">
                      {sign.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/60">
                    From {sign.sourceName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center">
          <h2 className="mb-2 text-xl font-bold">Join the Federation</h2>
          <p className="mb-4 text-muted-foreground">
            Every Enterprise in Angel OS is part of something bigger. Create your own Angel OS site
            and join the constitutional commerce network.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/create-account"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get Started
            </Link>
            <Link
              href="/federation/discover"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Explore the Network
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
