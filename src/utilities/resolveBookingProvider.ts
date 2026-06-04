import type { Payload } from 'payload'

/**
 * Resolve the provider (a user) a tenant's bookings are scheduled against.
 *
 * All of a tenant's bookable services share ONE provider calendar, so a booking
 * for any service blocks that time for every other — which is exactly the
 * overbooking guarantee we want for a small team that can't be two places at once.
 *
 * Resolution: the first active `tenant_admin` membership, falling back to any
 * active membership. Returns null if none exists.
 */
export async function resolveBookingProvider(
  payload: Payload,
  tenantId: number | string,
): Promise<number | null> {
  const tenantIdNum = typeof tenantId === 'number' ? tenantId : parseInt(String(tenantId), 10)
  if (Number.isNaN(tenantIdNum)) return null

  const userIdOf = (m: any): number | null => {
    const uId = typeof m?.user === 'object' ? m?.user?.id : m?.user
    if (uId == null) return null
    return typeof uId === 'number' ? uId : parseInt(String(uId), 10)
  }

  // 1. First active tenant_admin (the natural service provider / owner)
  try {
    const admins = await payload.find({
      collection: 'tenant-memberships' as any,
      where: {
        and: [
          { tenant: { equals: tenantIdNum } },
          { role: { equals: 'tenant_admin' } },
          { status: { equals: 'active' } },
        ],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const id = userIdOf(admins.docs?.[0])
    if (id != null) return id
  } catch {
    // fall through
  }

  // 2. Any active membership
  try {
    const any = await payload.find({
      collection: 'tenant-memberships' as any,
      where: {
        and: [{ tenant: { equals: tenantIdNum } }, { status: { equals: 'active' } }],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const id = userIdOf(any.docs?.[0])
    if (id != null) return id
  } catch {
    // no provider resolvable
  }

  return null
}
