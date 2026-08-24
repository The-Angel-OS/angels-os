import { describe, it, expect, vi, beforeEach } from 'vitest'

const ensure = vi.fn()
vi.mock('@/utilities/ensureTenantMembership', () => ({ ensureTenantMembership: ensure }))

import { joinTenantOnMembership } from '@/collections/Memberships/hooks/joinTenantOnMembership'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (doc: any) => (joinTenantOnMembership as any)({ doc, req: { fake: true } })

describe('joinTenantOnMembership', () => {
  beforeEach(() => ensure.mockClear())

  it('enrolls an active member in the tenant, which is what gets them into the spaces', async () => {
    await run({ status: 'active', member: 143, tenant: 11 })
    expect(ensure).toHaveBeenCalledWith(143, 11, { fake: true })
  })

  it('accepts populated relationships, not just ids', async () => {
    await run({ status: 'trialing', member: { id: 7 }, tenant: { id: 5 } })
    expect(ensure).toHaveBeenCalledWith(7, 5, { fake: true })
  })

  it('does not enroll on a lapsed or unpaid membership', async () => {
    for (const status of ['canceled', 'past_due', 'incomplete']) {
      await run({ status, member: 143, tenant: 11 })
    }
    expect(ensure).not.toHaveBeenCalled()
  })

  it('skips an email-only member — there is no account to put in a room', async () => {
    await run({ status: 'active', member: null, tenant: 11, memberEmail: 'a@b.c' })
    expect(ensure).not.toHaveBeenCalled()
  })
})
