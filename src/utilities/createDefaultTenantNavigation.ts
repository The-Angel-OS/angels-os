import type { Payload, PayloadRequest } from 'payload'
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
  req?: PayloadRequest,
): Promise<void> {
  // Join the caller's transaction when given one. Called from the tenants
  // afterChange hook, these inserts FK-reference a tenant row that has NOT
  // committed yet; on a separate connection the FK check BLOCKS on that row's
  // lock while the tx that holds it sits idle awaiting this very call —
  // a distributed deadlock that hung provisioning for exactly
  // idle_in_transaction_session_timeout (300s). Same root cause as a862570.
  const tx = req ? { req } : {}
  const [existingHeader, existingFooter] = await Promise.all([
    payload.find({
      collection: 'header',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      ...tx,
    }),
    payload.find({
      collection: 'footer',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      ...tx,
    }),
  ])

  // Thunks, not promises: payload.create() starts immediately when called, so
  // pushing promises here would run them concurrently no matter how we await.
  const creates: Array<() => Promise<unknown>> = []

  if (existingHeader.docs.length === 0) {
    creates.push(() =>
      payload.create({
        collection: 'header',
        depth: 0,
        overrideAccess: true,
        ...tx,
        data: {
          tenant: tenantId,
          label: 'Main Header',
          navItems: DEFAULT_HEADER_NAV,
        } as any,
      }),
    )
  }

  if (existingFooter.docs.length === 0) {
    creates.push(() =>
      payload.create({
        collection: 'footer',
        depth: 0,
        overrideAccess: true,
        ...tx,
        data: {
          tenant: tenantId,
          label: 'Main Footer',
          navItems: DEFAULT_FOOTER_NAV,
        } as any,
      }),
    )
  }

  // Sequential, not Promise.all: with `req` these share ONE transaction
  // connection, and the tenants afterChange hook's rule is "never parallelize
  // creates" (260709 guardian incident). Two inserts don't need concurrency.
  for (const c of creates) await c()
}
