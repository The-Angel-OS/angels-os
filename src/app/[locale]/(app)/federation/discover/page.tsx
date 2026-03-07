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

  const holons = endeavors.docs.map((doc: any) => {
    // Resolve tenant branding (multiTenantPlugin injects 'tenant' relation)
    const tenant = typeof doc.tenant === 'object' ? doc.tenant : null
    const siteName = tenant?.branding?.siteName || null
    const tenantSlug = tenant?.slug || null
    const tenantDomain = tenant?.domain || null

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
      // Tenant branding context — lets the card link to the storefront
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
