import { describe, expect, it } from 'vitest'
import { PORTAL_QUOTA, portalQuotaFor } from '@/utilities/portalPlan'
import { assertPortalQuota, getPortalQuota } from '@/utilities/portalQuota'

/** Minimal payload stub: one find() answering the tenant-memberships query. */
const payloadWith = (tenants: Array<{ portalPlan?: string } | null>) =>
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
