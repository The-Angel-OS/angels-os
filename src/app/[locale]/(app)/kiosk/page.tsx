import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Metadata } from 'next'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { KioskView } from './KioskView'

export const dynamic = 'force-dynamic'

/**
 * Kiosk / Quick-Shop — /kiosk
 *
 * A full-screen, big-tap product grid for in-person selling: a tablet at the
 * stand, or a QR a customer scans to shop + self-checkout on their own phone
 * (so the stand's bad signal doesn't matter — the customer's connection carries
 * the payment). Reuses the ecommerce cart + /checkout Payment Element entirely;
 * availability is gated by product.inventory (kept truthful by the order-paid
 * decrement), so it can't oversell.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { tenant } = await resolveTenantFromHeaders()
  const siteName = tenant?.branding?.siteName || tenant?.name || 'Shop'
  return { title: `${siteName} — Quick Shop`, description: `Tap to buy from ${siteName}.` }
}

export default async function KioskPage() {
  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()

  const products = await payload.find({
    collection: 'products',
    draft: false,
    overrideAccess: true,
    limit: 200,
    sort: 'title',
    select: {
      title: true,
      slug: true,
      gallery: true,
      priceInUSD: true,
      inventory: true,
    },
    where: {
      and: [
        { _status: { equals: 'published' } } as never,
        tenantFilter,
      ],
    },
  })

  return <KioskView products={products.docs as never} />
}
