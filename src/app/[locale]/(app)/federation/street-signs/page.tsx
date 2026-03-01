import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { StreetSignsBrowse } from './StreetSignsBrowse'

export const metadata = {
  title: 'Federation Street Signs',
  description: 'Discover products, events, services, and content from across the Angel OS federation.',
}

export default async function StreetSignsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Fetch active street signs
  const streetSigns = await payload.find({
    collection: 'street-signs',
    where: {
      status: { equals: 'active' },
    },
    limit: 100,
    depth: 1,
    overrideAccess: true,
    sort: '-createdAt',
  })

  const serialized = streetSigns.docs.map((doc: any) => ({
    id: doc.id,
    title: doc.title || 'Untitled',
    description: doc.description || '',
    contentType: doc.contentType || 'product',
    source: {
      dioceseName: doc.source?.dioceseName || 'Unknown',
      dioceseDomain: doc.source?.dioceseDomain || '',
      federationId: doc.source?.federationId || '',
      contentId: doc.source?.contentId || '',
      contentUrl: doc.source?.contentUrl || '',
      creatorName: doc.source?.creatorName || '',
    },
    tags: (doc.tags || []).map((t: any) => t.tag).filter(Boolean),
    holonTypes: doc.holonTypes || [],
    region: doc.region || '',
    thumbnail: doc.thumbnail?.url || doc.thumbnail?.filename || null,
    price: doc.price || null,
    currency: doc.currency || 'usd',
    impressions: doc.impressions || 0,
    clickThroughs: doc.clickThroughs || 0,
  }))

  return <StreetSignsBrowse initialSigns={serialized} total={streetSigns.totalDocs} />
}
