/**
 * Training entitlement is DERIVED. Three ways in — free, membership, purchase —
 * and a refusal always hands back the product so the caller can offer checkout.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/utilities/memberStanding', () => ({
  getMemberStanding: vi.fn(async () => standing),
}))

let standing = { isMember: false, inGoodStanding: false }

const { resolveTrainingAccess } = await import('@/utilities/trainingAccess')

/** A payload double. `paidProductIds` are the products this user has bought. */
function fakePayload(opts: { paidProductIds?: number[]; managerOf?: string } = {}) {
  const queries: string[] = []
  return {
    queries,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    find: async (args: any) => {
      queries.push(args.collection)
      if (args.collection === 'orders') {
        const want = args.where.and.find((c: Record<string, unknown>) => 'items.product' in c)['items.product'].equals
        return { docs: (opts.paidProductIds ?? []).includes(want) ? [{ id: 1 }] : [] }
      }
      if (args.collection === 'tenants') {
        return { docs: opts.managerOf ? [{ id: 99 }] : [] }
      }
      if (args.collection === 'tenant-memberships') {
        return { docs: opts.managerOf ? [{ role: 'tenant_admin' }] : [] }
      }
      return { docs: [] }
    },
  }
}

const user = { id: 5, roles: ['user'] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (p: any, u: unknown, work: Record<string, unknown>) =>
  resolveTrainingAccess(p, u as never, work as never, null)

describe('resolveTrainingAccess', () => {
  it('lets anyone into a public Work without touching the database', async () => {
    const p = fakePayload()
    expect(await run(p, null, { id: 1, access: 'public' })).toEqual({ allowed: true, reason: 'open' })
    expect(p.queries).toEqual([])
  })

  it('asks a signed-out visitor to sign in, and names the product', async () => {
    const res = await run(fakePayload(), null, { id: 1, access: 'purchase', product: 42 })
    expect(res).toEqual({ allowed: false, reason: 'sign_in_required', productId: 42 })
  })

  it('lets a signed-in person into an authenticated Work', async () => {
    const res = await run(fakePayload(), user, { id: 1, access: 'authenticated' })
    expect(res.allowed).toBe(true)
    expect(res.reason).toBe('membership')
  })

  it('lets someone in on a PAID order for the bound product', async () => {
    const res = await run(fakePayload({ paidProductIds: [42] }), user, { id: 1, access: 'purchase', product: 42 })
    expect(res).toEqual({ allowed: true, reason: 'purchased' })
  })

  it('refuses when the order is for a different product, and offers checkout', async () => {
    const res = await run(fakePayload({ paidProductIds: [7] }), user, { id: 1, access: 'purchase', product: 42 })
    expect(res).toEqual({ allowed: false, reason: 'purchase_required', productId: 42 })
  })

  it('refuses a purchase Work with no product bound — a mistake is not an open door', async () => {
    const res = await run(fakePayload(), user, { id: 1, access: 'purchase' })
    expect(res.allowed).toBe(false)
  })

  it('lets a member in on standing alone', async () => {
    standing = { isMember: true, inGoodStanding: true }
    const res = await run(fakePayload(), user, { id: 1, access: 'members' })
    expect(res).toEqual({ allowed: true, reason: 'membership' })
    standing = { isMember: false, inGoodStanding: false }
  })

  it('still lets a non-member in if they bought the membership-gated Work', async () => {
    const res = await run(fakePayload({ paidProductIds: [42] }), user, { id: 1, access: 'members', product: 42 })
    expect(res).toEqual({ allowed: true, reason: 'purchased' })
  })

  it('lets the Work owner manage it without paying for it', async () => {
    const res = await run(fakePayload({ managerOf: 'wdeg' }), user, { id: 1, access: 'purchase', product: 42, owner: 'wdeg' })
    expect(res).toEqual({ allowed: true, reason: 'manager' })
  })

  it('accepts a populated product relationship, not just an id', async () => {
    const res = await run(fakePayload({ paidProductIds: [42] }), user, { id: 1, access: 'purchase', product: { id: 42 } })
    expect(res.allowed).toBe(true)
  })
})
