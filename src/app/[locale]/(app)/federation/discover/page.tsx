import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { FederationDiscover } from './FederationDiscover'

export const metadata = {
  title: 'Discover the Federation',
  description: 'Browse Enterprises in the Angel OS federation network.',
}

export default async function FederationDiscoverPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Fetch network-visible Endeavors (depth: 2 resolves tenant branding)
  const endeavors = await payload.find({
    collection: 'endeavors',
    where: {
      'federation.networkVisible': { equals: true },
    },
    limit: 100,
    depth: 2,
    overrideAccess: true,
    sort: '-updatedAt',
  })

  // Build base URL from server environment for storefront URL resolution
  // Sprint 43: Use VERCEL_PROJECT_PRODUCTION_URL as second fallback before localhost
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
    || 'http://localhost:3000'
  const serverHost = new URL(serverUrl).host // e.g. spacesangels.com or localhost:3000

  const holons = endeavors.docs.map((doc: any) => {
    // Resolve tenant branding (multiTenantPlugin injects 'tenant' relation)
    const tenant = typeof doc.tenant === 'object' ? doc.tenant : null
    const siteName = tenant?.branding?.siteName || null
    const tenantSlug = tenant?.slug || null
    const tenantDomain = tenant?.domain || null
    // Sprint 43: Use stored federation domain from heartbeat persistence
    const federationDomain = (doc.federation?.domain as string) || null

    // Build canonical storefront URL for this Endeavor's tenant
    let storefrontUrl: string | null = null
    if (tenantDomain && !tenantDomain.endsWith('.local')) {
      // Real domain (e.g. hays-cactus.spacesangels.com, or custom domain)
      storefrontUrl = `https://${tenantDomain}`
    } else if (federationDomain && !federationDomain.includes('localhost')) {
      // Federated peer with stored domain from heartbeat
      storefrontUrl = `https://${federationDomain}`
    } else if (tenantSlug && tenantSlug !== 'default' && tenantSlug !== 'platform') {
      // Dev/local: construct subdomain URL from slug + server host
      storefrontUrl = `https://${tenantSlug}.${serverHost.replace(/:\d+$/, '')}`
    }

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
      logo: doc.logo?.url || doc.logo?.filename || null,
      coverImage: doc.coverImage?.url || doc.coverImage?.filename || null,
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

  return <FederationDiscover initialHolons={holons} total={endeavors.totalDocs} />
}
