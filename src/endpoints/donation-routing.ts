/**
 * Donation Routing Readout — GET /api/donation-ops/routing
 *
 * Public, read-only transparency: "where does a gift on THIS page go?" The
 * DonationBlock fetches this on mount and renders the breakdown line, so the
 * form always states the ACTUAL split for the portal it's standing on —
 * destination charge to the endeavor's own account, platform-stewarded for a
 * not-yet-Connected endeavor, or pure Justice Fund on the platform itself.
 * Shares resolveDonationRecipient with create-intent: shown = charged.
 */
import type { PayloadHandler } from 'payload'
import {
  resolveDonationRecipient,
  donationBreakdownText,
  DONATION_JUSTICE_FUND_PERCENT,
} from '@/utilities/donationRouting'

export const donationRoutingHandler: PayloadHandler = async (req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const headerTenant = req.headers?.get('x-tenant-id') || ''
  const querySlug = url.searchParams.get('tenant') || ''
  const slug = headerTenant || querySlug

  try {
    const recipient = await resolveDonationRecipient(req.payload, slug)
    return Response.json({
      ok: true,
      recipientName: recipient.recipientName,
      chargeModel: recipient.chargeModel,
      endeavorPercent: recipient.chargeModel === 'destination' ? 100 - DONATION_JUSTICE_FUND_PERCENT : 0,
      justiceFundPercent: recipient.chargeModel === 'destination' ? DONATION_JUSTICE_FUND_PERCENT : 100,
      breakdown: donationBreakdownText(recipient),
    })
  } catch {
    // Fail-soft: the form falls back to a neutral processing line.
    return Response.json({ ok: false }, { status: 200 })
  }
}
