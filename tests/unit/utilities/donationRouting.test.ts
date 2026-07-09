/**
 * donationRouting — Unit Tests
 *
 * The transparency layer: what the donate form SHOWS must match what the
 * charge DOES. resolveDonationRecipient decides destination vs platform;
 * donationBreakdownText renders the honest line per model.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  resolveDonationRecipient,
  donationBreakdownText,
  DONATION_JUSTICE_FUND_PERCENT,
  type DonationRecipient,
} from '@/utilities/donationRouting'

function payloadWithTenant(tenant: Record<string, unknown> | null) {
  return {
    find: vi.fn(async () => ({ docs: tenant ? [tenant] : [] })),
  } as never
}

describe('resolveDonationRecipient', () => {
  it('falls to platform / Justice Fund when no slug', async () => {
    const r = await resolveDonationRecipient(payloadWithTenant(null), '')
    expect(r.chargeModel).toBe('platform')
    expect(r.recipientName).toBe('the Justice Fund')
    expect(r.connectedAccountId).toBeNull()
  })

  it('treats default/platform slugs as the platform', async () => {
    for (const slug of ['default', 'platform']) {
      const payload = payloadWithTenant({ id: 1, type: 'platform', name: 'Angel OS' })
      const r = await resolveDonationRecipient(payload, slug)
      expect(r.chargeModel).toBe('platform')
      expect(r.recipientName).toBe('the Justice Fund')
    }
  })

  it('routes a Connect-enabled endeavor as a destination charge', async () => {
    const payload = payloadWithTenant({
      id: 5,
      type: 'tenant',
      name: 'Clearwater Cruisin Ministries',
      branding: { siteName: "Clearwater Cruisin' Ministries" },
      stripeConnect: { stripeAccountId: 'acct_123', stripeChargesEnabled: true },
    })
    const r = await resolveDonationRecipient(payload, 'clearwater-cruisin')
    expect(r.chargeModel).toBe('destination')
    expect(r.connectedAccountId).toBe('acct_123')
    expect(r.recipientName).toBe("Clearwater Cruisin' Ministries")
    expect(r.tenantId).toBe(5)
  })

  it('keeps the endeavor NAME for a non-Connect endeavor (platform-stewarded)', async () => {
    const payload = payloadWithTenant({ id: 8, type: 'tenant', name: 'HelpDNA' })
    const r = await resolveDonationRecipient(payload, 'helpdna')
    expect(r.chargeModel).toBe('platform')
    expect(r.connectedAccountId).toBeNull()
    expect(r.recipientName).toBe('HelpDNA')
  })

  it('does NOT destination-route when charges are disabled', async () => {
    const payload = payloadWithTenant({
      id: 9,
      type: 'tenant',
      name: 'Pending Endeavor',
      stripeConnect: { stripeAccountId: 'acct_999', stripeChargesEnabled: false },
    })
    const r = await resolveDonationRecipient(payload, 'pending')
    expect(r.chargeModel).toBe('platform')
    expect(r.connectedAccountId).toBeNull()
  })

  it('never destination-routes the platform tenant itself', async () => {
    const payload = payloadWithTenant({
      id: 1,
      type: 'platform',
      name: 'Angel OS Platform',
      stripeConnect: { stripeAccountId: 'acct_platform', stripeChargesEnabled: true },
    })
    const r = await resolveDonationRecipient(payload, 'some-alias')
    expect(r.chargeModel).toBe('platform')
    expect(r.connectedAccountId).toBeNull()
  })

  it('unknown slug falls back to the Justice Fund', async () => {
    const r = await resolveDonationRecipient(payloadWithTenant(null), 'ghost-portal')
    expect(r.chargeModel).toBe('platform')
    expect(r.recipientName).toBe('the Justice Fund')
  })
})

describe('donationBreakdownText', () => {
  const dest: DonationRecipient = {
    connectedAccountId: 'acct_1',
    recipientName: 'Grace Chapel',
    chargeModel: 'destination',
  }
  const stewarded: DonationRecipient = {
    connectedAccountId: null,
    recipientName: 'HelpDNA',
    chargeModel: 'platform',
  }
  const platform: DonationRecipient = {
    connectedAccountId: null,
    recipientName: 'the Justice Fund',
    chargeModel: 'platform',
  }

  it('destination: names the endeavor and the 95/5 split', () => {
    const t = donationBreakdownText(dest)
    expect(t).toContain('95%')
    expect(t).toContain('Grace Chapel')
    expect(t).toContain('5%')
  })

  it('stewarded endeavor: names the endeavor and the Justice Fund stewardship', () => {
    const t = donationBreakdownText(stewarded)
    expect(t).toContain('HelpDNA')
    expect(t).toContain('stewarded')
    expect(t).not.toContain('95%')
  })

  it('platform: the 100% Justice Fund line', () => {
    const t = donationBreakdownText(platform)
    expect(t).toContain('100%')
    expect(t).toContain('Justice Fund')
  })

  it('the split constant matches the copy', () => {
    expect(DONATION_JUSTICE_FUND_PERCENT).toBe(5)
    expect(donationBreakdownText(dest)).toContain(`${100 - DONATION_JUSTICE_FUND_PERCENT}%`)
  })
})
