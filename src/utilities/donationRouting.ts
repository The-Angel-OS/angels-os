/**
 * donationRouting — the single answer to "where does a gift on THIS page go?"
 *
 * Shared by donation-create-intent (money movement) and donation-routing
 * (the public transparency readout the DonationBlock renders BEFORE anyone
 * pays). One resolver = the breakdown shown always matches the charge made.
 *
 * The HOST is authoritative: middleware sets x-tenant-id from the hostname,
 * correct even when the payload-tenant cookie is absent/stale. A body/query
 * slug is only a fallback.
 */
import type { Payload } from 'payload'

/** Justice Fund share (constitutional floor) taken from endeavor donations. */
export const DONATION_JUSTICE_FUND_PERCENT = 5

export interface DonationRecipient {
  /** Stripe Connect account to receive a destination charge, when routable. */
  connectedAccountId: string | null
  /** Resolved tenant id (for logging), when the slug matched a tenant. */
  tenantId?: number
  /** Display name of who the gift supports. */
  recipientName: string
  /** destination = endeavor's own Stripe account; platform = Justice Fund stewardship. */
  chargeModel: 'destination' | 'platform'
}

export async function resolveDonationRecipient(
  payload: Payload,
  slug: string | null | undefined,
): Promise<DonationRecipient> {
  const result: DonationRecipient = {
    connectedAccountId: null,
    recipientName: 'the Justice Fund',
    chargeModel: 'platform',
  }
  if (!slug || slug === 'default' || slug === 'platform') return result

  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = tenants.docs?.[0] as any
  if (!tenant) return result
  if (tenant.id != null) result.tenantId = Number(tenant.id)

  const name = tenant.branding?.siteName || tenant.name
  const connect = tenant.stripeConnect as Record<string, unknown> | undefined
  if (
    tenant.type !== 'platform' &&
    connect?.stripeAccountId &&
    connect?.stripeChargesEnabled
  ) {
    result.connectedAccountId = connect.stripeAccountId as string
    result.recipientName = name || 'this enterprise'
    result.chargeModel = 'destination'
  } else if (tenant.type !== 'platform' && name) {
    // Not yet Connect-enabled: the gift is stewarded by the platform FOR this
    // endeavor — keep the endeavor's name so the transparency line is honest.
    result.recipientName = name
  }
  return result
}

/**
 * The human-readable breakdown for a recipient — rendered on the form before
 * payment. Truthful per charge model:
 *  - destination: 95% straight to the endeavor's own Stripe account; the 5%
 *    Justice Fund share also absorbs Stripe's processing fee.
 *  - platform (an endeavor without Connect): stewarded via the Justice Fund
 *    for that endeavor until they connect their own account.
 *  - platform (the platform itself): 100% Justice Fund, less card processing.
 */
export function donationBreakdownText(r: DonationRecipient): string {
  if (r.chargeModel === 'destination') {
    return `95% of your gift goes directly to ${r.recipientName}; the remaining 5% sustains the Angel OS Justice Fund and covers card processing. All on the record.`
  }
  if (r.recipientName !== 'the Justice Fund') {
    return `Your gift supports ${r.recipientName}, stewarded through the Angel OS Justice Fund until this endeavor connects its own account. Card processing is the only other cost.`
  }
  return `100% of your gift goes to the Angel OS Justice Fund — community support, advocacy, and infrastructure — less card processing. No platform fees.`
}
