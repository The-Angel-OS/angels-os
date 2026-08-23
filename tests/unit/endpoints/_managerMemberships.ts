import { vi } from 'vitest'

/**
 * A `payload.find` that answers tenant-memberships from the fixture user.
 *
 * Order and product authorization resolves the ROLE from tenant-memberships now,
 * not from `user.tenants` — that array is membership with no role, and
 * enrol-on-arrival made every signed-in visitor a member of any portal they
 * looked at (see access/portalManager). These fixtures already say
 * `tenants: [{ tenant: { id: 1 } }]` to mean "this user's tenant", so read it as
 * the tenants they MANAGE and the existing assertions keep their meaning.
 */
export const membershipFindFor = (user: unknown) =>
  vi.fn().mockImplementation(({ collection }: { collection?: string } = {}) => {
    if (collection !== 'tenant-memberships') return Promise.resolve({ docs: [], totalDocs: 0 })
    const tenants = ((user as { tenants?: Array<{ tenant?: unknown }> } | null)?.tenants ?? []).map(
      (t) => ({ tenant: t?.tenant, role: 'tenant_admin', status: 'active' }),
    )
    return Promise.resolve({ docs: tenants, totalDocs: tenants.length })
  })
