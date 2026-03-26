import type { Payload } from 'payload'

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
  // Check for existing header to ensure idempotency
  const existingHeader = await payload.find({
    collection: 'header',
    where: {
      tenant: { equals: tenantId },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existingHeader.docs.length === 0) {
    await payload.create({
      collection: 'header',
      depth: 0,
      overrideAccess: true,
      data: {
        tenant: tenantId,
        label: 'Main Header',
        navItems: [
          { link: { type: 'custom' as const, label: 'Home', url: '/' } },
          { link: { type: 'custom' as const, label: 'Shop', url: '/shop' } },
          { link: { type: 'custom' as const, label: 'Posts', url: '/posts' } },
          { link: { type: 'custom' as const, label: 'Donate', url: '/donate' } },
          { link: { type: 'custom' as const, label: 'Dashboard', url: '/dashboard' } },
        ],
      } as any,
    })
  }

  // Check for existing footer to ensure idempotency
  const existingFooter = await payload.find({
    collection: 'footer',
    where: {
      tenant: { equals: tenantId },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existingFooter.docs.length === 0) {
    await payload.create({
      collection: 'footer',
      depth: 0,
      overrideAccess: true,
      data: {
        tenant: tenantId,
        label: 'Main Footer',
        navItems: [
          { link: { type: 'custom' as const, label: 'Home', url: '/' } },
          { link: { type: 'custom' as const, label: 'Shop', url: '/shop' } },
          { link: { type: 'custom' as const, label: 'Posts', url: '/posts' } },
          { link: { type: 'custom' as const, label: 'Donate', url: '/donate' } },
          { link: { type: 'custom' as const, label: 'Dashboard', url: '/dashboard' } },
        ],
      } as any,
    })
  }
}
