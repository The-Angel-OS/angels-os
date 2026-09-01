import { describe, expect, it } from 'vitest'
import { PORTAL_QUOTA, portalQuotaFor } from '@/utilities/portalPlan'
import { assertPortalQuota, getOwnedPortals, getPortalQuota } from '@/utilities/portalQuota'

/** Minimal payload stub: one find() answering the tenant-memberships query. */
const payloadWith = (
  tenants: Array<{ portalPlan?: string; isGuardianAngel?: boolean; slug?: string; name?: string } | null>,
) =>
  ({
    find: async () => ({ docs: tenants.map((t) => ({ tenant: t })) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

describe('portalQuotaFor', () => {
  it('is the most generous plan held, free by default', () => {
    expect(portalQuotaFor([])).toBe(PORTAL_QUOTA.free)
    expect(portalQuotaFor(['free', 'business', 'site'])).toBe(PORTAL_QUOTA.business)
  })
})

describe('assertPortalQuota', () => {
  it('lets a first-time user through and stops the second free portal', async () => {
    await expect(assertPortalQuota(payloadWith([]), { id: 7 })).resolves.toBeUndefined()
    await expect(assertPortalQuota(payloadWith([{ portalPlan: 'free' }]), { id: 7 })).rejects.toThrow(
      /1 of 1 portal/,
    )
  })

  it('counts a paid portal as room for more', async () => {
    await expect(
      assertPortalQuota(payloadWith([{ portalPlan: 'business' }]), { id: 7 }),
    ).resolves.toBeUndefined()
  })

  // super_admin never sees this fire — which is the whole reason it needs a test.
  it('bypasses for platform admins and for unattributed provisioning', async () => {
    const full = payloadWith([{ portalPlan: 'free' }])
    await expect(assertPortalQuota(full, { id: 7, roles: ['super_admin'] })).resolves.toBeUndefined()
    await expect(assertPortalQuota(full, null)).resolves.toBeUndefined()
  })

  it('treats an unhydrated tenant as free rather than as unlimited', async () => {
    const state = await getPortalQuota(payloadWith([null, null]), 7)
    expect(state).toMatchObject({ used: 2, quota: PORTAL_QUOTA.free, overQuota: true, plan: 'free' })
  })
})

describe('getOwnedPortals', () => {
  it('names a portal the way its owner would, and survives an unhydrated relation', async () => {
    const portals = await getOwnedPortals(
      payloadWith([
        { slug: 'wdeg', name: 'Where Did Everyone Go', portalPlan: 'site' },
        null,
      ]),
      7,
    )
    expect(portals).toHaveLength(2)
    expect(portals[0]).toMatchObject({ slug: 'wdeg', name: 'Where Did Everyone Go', plan: 'site' })
    // An id we cannot resolve is still a portal they own — it must not vanish
    // from the count just because depth-1 hydration came back empty.
    expect(portals[1]).toMatchObject({ plan: 'free', slug: '' })
  })
})

describe('a guardian angel is the person, not a site they run', () => {
  const guardian = { portalPlan: 'free', isGuardianAngel: true, slug: 'k7f2a' }

  it('does not spend the free allowance, so the first business portal is allowed', async () => {
    // The bug this closes: the auto-provisioned personal angel filled the free
    // quota of 1, and the NEXT portal — the actual business — was refused.
    const state = await getPortalQuota(payloadWith([guardian]), 7)
    expect(state).toMatchObject({ used: 0, quota: PORTAL_QUOTA.free, overQuota: false })
    await expect(assertPortalQuota(payloadWith([guardian]), { id: 7 })).resolves.toBeUndefined()
  })

  it('still stops the second BUSINESS portal on a free plan', async () => {
    await expect(
      assertPortalQuota(payloadWith([guardian, { portalPlan: 'free', slug: 'shop' }]), { id: 7 }),
    ).rejects.toThrow(/1 of 1 portal/)
  })

  it('a PAID angel still raises the allowance', async () => {
    const state = await getPortalQuota(
      payloadWith([{ portalPlan: 'business', isGuardianAngel: true }]),
      7,
    )
    expect(state.quota).toBe(PORTAL_QUOTA.business)
    expect(state.used).toBe(0)
  })
})
