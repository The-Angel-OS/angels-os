import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { HolonRegistration } from './HolonRegistration'

/**
 * Holon Node Registration Page — /dashboard/holon
 *
 * Server component that loads existing registration (if any)
 * and renders the client-side registration form.
 */
export default async function DashboardHolonPage({
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
  let tenantId: number | undefined

  if (tenantSlug) {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = tenants.docs?.[0]?.id
  }
  if (!tenantId) {
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = defaults.docs?.[0]?.id
  }

  // Check for existing registration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existingRegistration: any = null
  if (tenantId) {
    const existing = await payload.find({
      collection: 'holon-capabilities',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = existing.docs[0] as any
      existingRegistration = {
        id: doc.id,
        nodeType: doc.nodeType,
        capabilities: doc.capabilities || [],
        serviceRadius: doc.serviceRadius,
        location: doc.location || {},
        rating: doc.rating || 0,
        constitutionalCompliance: doc.constitutionalCompliance ?? true,
      }
    }
  }

  return (
    <HolonRegistration
      tenantId={tenantId}
      existingRegistration={existingRegistration}
    />
  )
}
