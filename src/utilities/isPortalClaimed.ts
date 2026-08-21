/**
 * Has a real person taken ownership of this portal yet?
 *
 * We build sites FOR prospects and hand them the keys afterwards. Between those
 * two moments a portal carries a real business's name, prices and services while
 * nobody has agreed to any of it — which is exactly how the 260818 consent
 * takedown happened. An unclaimed portal should not be indexed under that
 * business's name; the moment someone accepts their invite, it should.
 *
 * Derived, not configured — no flag to set and none to forget. A portal is
 * claimed when it has an ACTIVE membership held by a non-system human.
 *
 * Cached per tenant: robots.txt and page metadata both ask, and neither is worth
 * a query per request.
 */
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'

async function computeClaimed(tenantId: number | string): Promise<boolean> {
  try {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'tenant-memberships',
      where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: 'active' } }] },
      limit: 20,
      depth: 1,
      overrideAccess: true,
    })
    return res.docs.some((m) => {
      const u = (m as { user?: { id?: unknown; isSystemUser?: boolean } | number }).user
      if (u == null) return false
      // A system account holding a membership is plumbing, not an owner.
      return typeof u === 'object' ? !u.isSystemUser : true
    })
  } catch {
    // Fail CLOSED: if we cannot tell, treat it as unclaimed and stay out of the
    // index. A missed indexing opportunity is cheaper than an unwanted listing.
    return false
  }
}

export function isPortalClaimed(tenantId: number | string): Promise<boolean> {
  return unstable_cache(() => computeClaimed(tenantId), ['portal-claimed', String(tenantId)], {
    revalidate: 300,
    tags: [`portal-claimed-${tenantId}`],
  })()
}
