import { describe, it, expect } from 'vitest'
import { buildSubscriptionMetadata } from '@/endpoints/membership-checkout'

describe('buildSubscriptionMetadata', () => {
  const base = {
    tenantId: 1,
    tenantSlug: 'platform',
    planId: 'site',
    planName: 'Site',
  }

  it('carries the member identity onto the SUBSCRIPTION', () => {
    // The regression this pins: `customer.subscription.*` is what syncs the
    // Memberships row, and it only ever sees subscription.metadata — Stripe does
    // not copy session metadata across. Without these fields the webhook still
    // created a Membership (tenantId + planId were present) but with `member`
    // empty, so the row belonged to nobody and memberStanding — which matches on
    // `{ tenant, member: userId }` — never found it. The customer pays every
    // month and stays locked out, with a healthy-looking row sitting right there.
    const meta = buildSubscriptionMetadata({
      ...base,
      memberEmail: 'buyer@example.com',
      memberName: 'A Buyer',
      memberUserId: 42,
    })
    expect(meta.memberUserId).toBe('42')
    expect(meta.memberEmail).toBe('buyer@example.com')
    expect(meta.memberName).toBe('A Buyer')
  })

  it('keeps the routing fields the webhook gates on', () => {
    // upsertMembershipFromSubscription early-returns unless BOTH of these are
    // present, and it returns silently.
    const meta = buildSubscriptionMetadata(base)
    expect(meta.angelOs_type).toBe('membership')
    expect(meta.tenantId).toBe('1')
  })

  it('stringifies every value — Stripe metadata is string-only', () => {
    const meta = buildSubscriptionMetadata({ ...base, tenantId: 7, memberUserId: 9 })
    for (const v of Object.values(meta)) expect(typeof v).toBe('string')
  })

  it('omits member fields rather than sending empty strings', () => {
    // An anonymous buyer has no user id. Sending '' would write a blank
    // memberEmail over a real one on a later subscription update.
    const meta = buildSubscriptionMetadata({ ...base, memberEmail: '', memberUserId: null })
    expect('memberEmail' in meta).toBe(false)
    expect('memberUserId' in meta).toBe(false)
  })
})
