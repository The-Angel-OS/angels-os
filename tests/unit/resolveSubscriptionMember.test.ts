import { describe, it, expect, vi, beforeEach } from 'vitest'

const retrieve = vi.fn()
vi.mock('stripe', () => ({
  default: class {
    customers = { retrieve }
  },
}))

const findOrCreateInvitedUser = vi.fn()
vi.mock('@/utilities/findOrCreateInvitedUser', () => ({
  findOrCreateInvitedUser: (...args: unknown[]) => findOrCreateInvitedUser(...args),
}))

const logError = vi.fn()
vi.mock('@/utilities/logError', () => ({ logError: (...a: unknown[]) => logError(...a) }))

const { resolveSubscriptionMember } = await import('@/endpoints/stripe-webhooks')

const payload = {} as never

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'
})

describe('resolveSubscriptionMember — a payer must end up attached to a person', () => {
  it('keeps the signed-in user and never touches Stripe', async () => {
    const out = await resolveSubscriptionMember(payload, {
      subscriptionId: 'sub_1',
      memberUserId: 42,
      memberEmail: 'a@b.com',
    })
    expect(out).toEqual({ memberUserId: 42, memberEmail: 'a@b.com' })
    expect(retrieve).not.toHaveBeenCalled()
    expect(findOrCreateInvitedUser).not.toHaveBeenCalled()
  })

  it('resolves an anonymous payer from the checkout email', async () => {
    findOrCreateInvitedUser.mockResolvedValue({ userId: 7, created: true, email: 'anon@b.com' })
    const out = await resolveSubscriptionMember(payload, {
      subscriptionId: 'sub_2',
      memberEmail: 'anon@b.com',
    })
    expect(out.memberUserId).toBe(7)
    expect(retrieve).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })

  it("falls back to the Stripe customer's email when metadata has none", async () => {
    retrieve.mockResolvedValue({ email: 'payer@b.com' })
    findOrCreateInvitedUser.mockResolvedValue({ userId: 9, created: false, email: 'payer@b.com' })
    const out = await resolveSubscriptionMember(payload, {
      subscriptionId: 'sub_3',
      customerId: 'cus_1',
    })
    expect(out).toEqual({ memberUserId: 9, memberEmail: 'payer@b.com' })
  })

  it('warns instead of throwing when nobody can be resolved', async () => {
    retrieve.mockResolvedValue({ email: null })
    const out = await resolveSubscriptionMember(payload, {
      subscriptionId: 'sub_4',
      customerId: 'cus_2',
      tenantId: '5',
    })
    expect(out.memberUserId).toBeUndefined()
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'stripe-webhooks/attachMember', level: 'warning' }),
    )
  })

  it('survives a Stripe failure without throwing', async () => {
    retrieve.mockRejectedValue(new Error('stripe down'))
    const out = await resolveSubscriptionMember(payload, {
      subscriptionId: 'sub_5',
      customerId: 'cus_3',
    })
    expect(out.memberUserId).toBeUndefined()
    expect(logError).toHaveBeenCalled()
  })

  it('ignores a deleted Stripe customer', async () => {
    retrieve.mockResolvedValue({ deleted: true })
    const out = await resolveSubscriptionMember(payload, {
      subscriptionId: 'sub_6',
      customerId: 'cus_4',
    })
    expect(out.memberUserId).toBeUndefined()
  })
})
