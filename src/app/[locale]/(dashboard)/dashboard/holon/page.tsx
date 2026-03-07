import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { buildTenantFilter } from '@/utilities/buildTenantFilter'
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
  const { tenantId } = await resolveTenantFromHeaders()

  // Check for existing registration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existingRegistration: any = null
  if (tenantId) {
    const existing = await payload.find({
      collection: 'holon-capabilities',
      where: buildTenantFilter(tenantId),
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
