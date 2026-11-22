import { describe, it, expect, vi, beforeEach } from 'vitest'

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
})

describe('resolveSubscriptionMember — attaches subscription payer to a person', () => {
  it('keeps the signed-in user without calling findOrCreateInvitedUser', async () => {
    const out = await resolveSubscriptionMember(payload, {
      subscriptionId: 'sub_1',
      memberUserId: 42,
      memberEmail: 'a@b.com',
    })
    expect(out).toEqual({ memberUserId: 42, memberEmail: 'a@b.com' })
    expect(findOrCreateInvitedUser).not.toHaveBeenCalled()
  })

  it('resolves an anonymous payer from the checkout email', async () => {
    findOrCreateInvitedUser.mockResolvedValue({ userId: 7, created: true, email: 'anon@b.com' })
    const out = await resolveSubscriptionMember(payload, {
      subscriptionId: 'sub_2',
      memberEmail: 'anon@b.com',
    })
    expect(out.memberUserId).toBe(7)
    expect(logError).not.toHaveBeenCalled()
  })

  it('warns instead of throwing when nobody can be resolved', async () => {
    const out = await resolveSubscriptionMember(payload, {
      subscriptionId: 'sub_4',
      tenantId: '5',
    })
    expect(out.memberUserId).toBeUndefined()
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'stripe-webhooks/attachMember', level: 'warning' }),
    )
  })
})
