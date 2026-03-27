import type { Payload } from 'payload'
import { DEFAULT_HEADER_NAV, DEFAULT_FOOTER_NAV } from '@/utilities/defaultNavItems'

/**
 * Creates default header and footer docs for a newly provisioned tenant.
 *
 * Without these docs, the Header component logs
 * `[Header] No header doc found for tenant ...` on every page load
 * and falls back to hard-coded nav items. Having actual CMS docs lets
 * tenant admins customise their navigation.
 *
 * Idempotent: skips creation if a header or footer already exists
 * for the given tenant.
 */
export async function createDefaultTenantNavigation(
  payload: Payload,
  tenantId: number | string,
): Promise<void> {
  const [existingHeader, existingFooter] = await Promise.all([
    payload.find({
      collection: 'header',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'footer',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const creates: Promise<unknown>[] = []

  if (existingHeader.docs.length === 0) {
    creates.push(
      payload.create({
        collection: 'header',
        depth: 0,
        overrideAccess: true,
        data: {
          tenant: tenantId,
          label: 'Main Header',
          navItems: DEFAULT_HEADER_NAV,
        } as any,
      }),
    )
  }

  if (existingFooter.docs.length === 0) {
    creates.push(
      payload.create({
        collection: 'footer',
        depth: 0,
        overrideAccess: true,
        data: {
          tenant: tenantId,
          label: 'Main Footer',
          navItems: DEFAULT_FOOTER_NAV,
        } as any,
      }),
    )
  }

  await Promise.all(creates)
}
