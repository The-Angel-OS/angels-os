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
 * claimed when it has an ACTIVE membership held by a non-system human who is
 * neither PLATFORM STAFF nor a TEST ACCOUNT.
 *
 * ⚠️ That last clause is the whole thing. Ken holds a membership on all 22
 * portals because he builds them, so the original rule answered "claimed" for
 * every single one — and every prospect portal was being indexed under a real
 * business's name, which is precisely the 260818 consent takedown this was
 * written to prevent. The builder is not the owner. A portal is claimed when
 * somebody OUTSIDE the platform is standing in it.
 *
 * Cached per tenant: robots.txt and page metadata both ask, and neither is worth
 * a query per request.
 */
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

/** Platform staff build portals for other people; holding one is not owning it. */
function isPlatformStaff(roles: unknown): boolean {
  return checkRole(ADMIN_ROLES, { roles } as never)
}

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
      const u = (m as {
        user?: { id?: unknown; isSystemUser?: boolean; roles?: unknown } | number
      }).user
      if (u == null) return false
      // A bare id means we could not populate the user, so we cannot tell whether
      // they are staff. Fail CLOSED — an unknown does not claim a portal.
      if (typeof u !== 'object') return false
      // A system account holding a membership is plumbing, not an owner.
      if (u.isSystemUser) return false
      // Neither is a test account. Ken signs in as one to check a portal — that
      // is us looking at our own work, not a business owner arriving.
      if ((u as { isTestAccount?: boolean }).isTestAccount) return false
      // Neither is the person who BUILT it. @see the warning above.
      return !isPlatformStaff(u.roles)
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
