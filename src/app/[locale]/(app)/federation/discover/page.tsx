import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { FederationDiscover } from './FederationDiscover'
import { aggregatePeerHolons } from '@/utilities/federationDiscovery'
import { getMarketChildren } from '@/utilities/marketMembership'
import { registrableApex, tenantStorefrontUrl } from '@/utilities/registrableApex'

export const metadata = {
  title: 'Discover the Federation',
  description: 'Browse Enterprises in the Angel OS federation network.',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FederationDiscoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ market?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const marketSlug = (await searchParams)?.market?.trim() || ''

  const payload = await getPayload({ config: configPromise })

  // Fetch network-visible Endeavors (depth: 2 resolves tenant branding)
  let endeavors: Awaited<ReturnType<typeof payload.find>>
  try {
    endeavors = await payload.find({
      collection: 'endeavors',
      where: {
        'federation.networkVisible': { equals: true },
      },
      limit: 100,
      depth: 2,
      overrideAccess: true,
      sort: '-updatedAt',
    })
  } catch (err) {
    console.error('[FederationDiscover] Query failed:', err)
    return <FederationDiscover initialHolons={[]} total={0} enterprises={1} />
  }

  // Build base URL from server environment for storefront URL resolution
  // Sprint 43: Use VERCEL_PROJECT_PRODUCTION_URL as second fallback before localhost
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
    || 'http://localhost:3000'
  const serverHost = new URL(serverUrl).host.replace(/^www\./, '') // e.g. spacesangels.com or localhost:3000
  // Apex this node serves on — drives synthesized storefronts (spacesangels.com,
  // kendev.co, …). Localhost in dev falls back to the public apex, never slug.localhost.
  const nodeApex = registrableApex(serverHost.includes('localhost') ? null : serverHost)

  // Default Discovery banner = each Endeavor's tenant HOME PAGE unfurl image
  // (Pages.meta.image). One batched query → tenantId → image URL. The viewer on
  // the home page "slots into" this card banner across the network.
  const homeImageByTenant = new Map<string, string>()
  try {
    const tenantIds = endeavors.docs
      .map((d: any) => (typeof d.tenant === 'object' ? d.tenant?.id : d.tenant))
      .filter((v: unknown) => v != null)
    if (tenantIds.length) {
      const homes = await payload.find({
        collection: 'pages',
        where: { and: [{ slug: { equals: 'home' } }, { tenant: { in: tenantIds } }] },
        depth: 1,
        limit: 200,
        overrideAccess: true,
      })
      for (const p of homes.docs as any[]) {
        const tid = typeof p.tenant === 'object' ? p.tenant?.id : p.tenant
        const img =
          p.meta?.image && typeof p.meta.image === 'object'
            ? p.meta.image.url || p.meta.image.filename
            : null
        if (tid != null && img) homeImageByTenant.set(String(tid), img)
      }
    }
  } catch {
    // Non-critical — cards just fall back to the letter avatar.
  }

  const holons = endeavors.docs.map((doc: any) => {
    // Resolve tenant branding (multiTenantPlugin injects 'tenant' relation)
    const tenant = typeof doc.tenant === 'object' ? doc.tenant : null
    const siteName = tenant?.branding?.siteName || null
    const tenantSlug = tenant?.slug || null
    const tenantDomain = tenant?.domain || null
    // Sprint 43: Use stored federation domain from heartbeat persistence
    const federationDomain = (doc.federation?.domain as string) || null

    // Canonical storefront URL: primary bound client domain → real `domain` →
    // federation domain → synthesized slug.<nodeApex>. Single source of truth.
    const storefrontUrl = tenantStorefrontUrl(tenant, nodeApex, federationDomain)

    return {
      id: doc.id,
      // Use tenant siteName as primary display name if the Endeavor name is missing or generic
      name: doc.name || siteName || 'Unnamed Enterprise',
      tagline: doc.tagline || tenant?.branding?.tagline || '',
      description: doc.description || '',
      endeavorType: doc.endeavorType || 'custom',
      holonTypes: doc.holonTypes || [],
      missionStatement: doc.missionStatement || '',
      status: doc.status || 'forming',
      capabilities: (doc.capabilities || []).map((c: any) => ({
        skill: c.skill,
        description: c.description || '',
      })),
      region: {
        city: doc.region?.city || '',
        state: doc.region?.state || '',
        country: doc.region?.country || 'US',
      },
      federation: {
        federationId: doc.federation?.federationId || '',
        ministryStatus: doc.federation?.ministryStatus || 'applicant',
      },
      logo:
        doc.logo?.url ||
        doc.logo?.filename ||
        (typeof tenant?.branding?.logo === 'object' ? tenant.branding.logo?.url : null) ||
        null,
      // Banner: explicit endeavor coverImage → tenant home-page unfurl image.
      coverImage:
        doc.coverImage?.url ||
        doc.coverImage?.filename ||
        homeImageByTenant.get(String(tenant?.id)) ||
        null,
      storefrontUrl,
      // Tenant branding context
      tenant: tenantSlug
        ? {
            slug: tenantSlug,
            siteName: siteName || null,
            domain: tenantDomain || null,
          }
        : null,
    }
  })

  // Enterprises = federated nodes (Dioceses) on the network = peers (excluding
  // revoked/suspended) + this Enterprise itself. Distinct from Endeavors (the
  // ministries listed above), which is the conceptual grain: Enterprise = the
  // trust/federation unit, Endeavor = a work hosted within one.
  let enterprises = 1
  try {
    const peers = await payload.count({
      collection: 'federation-peers',
      where: { ministryStatus: { not_in: ['revoked', 'suspended'] } },
      overrideAccess: true,
    })
    enterprises = (peers.totalDocs || 0) + 1
  } catch {
    enterprises = 1
  }

  // Cross-node aggregation: pull network-visible Endeavors from active peer
  // Dioceses and merge them in, tagged with their origin Enterprise. Resilient —
  // offline/slow peers are skipped, so this never blocks the local listing.
  const peerHolons = await aggregatePeerHolons(payload)
  let allHolons = [...holons, ...peerHolons]

  // Market front door: ?market=<parentSlug> narrows to that market's merchants and
  // retitles the page. The parent grouping lives in the settings bag (no schema change).
  let marketName: string | undefined
  if (marketSlug) {
    const childSlugs = new Set(await getMarketChildren(payload, marketSlug))
    allHolons = allHolons.filter((h) => h.tenant?.slug && childSlugs.has(h.tenant.slug))
    // Prefer the parent endeavor's display name for the heading; fall back to the slug.
    const parent = holons.find((h) => h.tenant?.slug === marketSlug)
    marketName = parent?.name || marketSlug
  }

  return (
    <FederationDiscover initialHolons={allHolons} total={allHolons.length} enterprises={enterprises} marketName={marketName} />
  )
}
