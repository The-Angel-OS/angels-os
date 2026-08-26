import { describe, it, expect, vi } from 'vitest'

/**
 * The bug: Ken holds a membership on all 22 portals because he BUILDS them, so
 * "has an active human member" answered yes for every prospect portal — and
 * robots.txt let Google index each one under a real business's name. That is
 * exactly the 260818 consent takedown this flag exists to prevent.
 */
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))

const docs: Array<{ user: unknown }> = []
vi.mock('payload', () => ({
  getPayload: async () => ({ find: async () => ({ docs }) }),
}))
vi.mock('@payload-config', () => ({ default: {} }))

const { isPortalClaimed } = await import('@/utilities/isPortalClaimed')

const set = (...users: unknown[]) => {
  docs.length = 0
  for (const user of users) docs.push({ user })
}

describe('a portal is claimed when someone outside the platform holds it', () => {
  it('the builder does not claim it — this was the whole bug', async () => {
    set({ id: 3, roles: ['customer', 'super_admin'] })
    expect(await isPortalClaimed(23)).toBe(false)
  })

  it('a real owner does', async () => {
    set({ id: 3, roles: ['super_admin'] }, { id: 161, roles: ['customer'] })
    expect(await isPortalClaimed(17)).toBe(true)
  })

  it('a system account is plumbing, not an owner', async () => {
    set({ id: 2, isSystemUser: true, roles: ['customer'] })
    expect(await isPortalClaimed(1)).toBe(false)
  })

  it('fails closed on an unpopulated member — an unknown must not claim a portal', async () => {
    set(161)
    expect(await isPortalClaimed(17)).toBe(false)
  })

  it('a portal with no members at all is unclaimed', async () => {
    set()
    expect(await isPortalClaimed(99)).toBe(false)
  })
})
