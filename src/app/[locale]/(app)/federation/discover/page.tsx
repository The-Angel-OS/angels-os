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

  // Fetch network-visible Endeavors
  const endeavors = await payload.find({
    collection: 'endeavors',
    where: {
      'federation.networkVisible': { equals: true },
    },
    limit: 100,
    depth: 1,
    overrideAccess: true,
    sort: '-updatedAt',
  })

  const holons = endeavors.docs.map((doc: any) => ({
    id: doc.id,
    name: doc.name || 'Unnamed Enterprise',
    tagline: doc.tagline || '',
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
  }))

  return <FederationDiscover initialHolons={holons} total={endeavors.totalDocs} />
}
