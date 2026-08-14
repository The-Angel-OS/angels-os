import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Stamp the affiliate snapshot onto an order as it is created.
 *
 * Attach point is a `beforeChange` on the order rather than any one checkout
 * route because the ecommerce plugin owns order creation and there is more than
 * one way in (card, saved method, the plugin's own initiate endpoint). All of
 * them are browser-originated requests, so all of them carry the cookie; a hook
 * here catches every one and can't be bypassed by adding a payment method later.
 *
 * Create only. An order that has already been placed must never have its
 * attribution rewritten by a later edit — that's someone's commission.
 *
 * Fail-soft throughout: a referral that can't be resolved must never stop a
 * payment. The worst case is an unattributed order, which is recoverable by
 * hand; a failed checkout is not.
 */
export const REFERRAL_COOKIE = 'aos_ref'

type ReferralCookie = {
  /** partner code, lowercased */
  c?: string
  /** ISO timestamp of the click */
  t?: string
  /** path they landed on */
  p?: string
}

/** Parse our own cookie. Anything unexpected in it is treated as no cookie. */
export function parseReferralCookie(header: string | null | undefined): ReferralCookie | null {
  if (!header) return null
  const raw = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${REFERRAL_COOKIE}=`))
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(REFERRAL_COOKIE.length + 1))) as ReferralCookie
    if (!parsed?.c || typeof parsed.c !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export const attachReferral: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  // Already stamped (an import, a replay, a test fixture) — leave it alone.
  if ((data as { referral?: { code?: string } })?.referral?.code) return data

  try {
    const cookie = parseReferralCookie(req.headers?.get('cookie'))
    if (!cookie?.c) return data

    const partners = await req.payload.find({
      collection: 'partners',
      where: {
        and: [
          { code: { equals: cookie.c.toLowerCase() } },
          // A paused partner's links still resolve — they just stop earning.
          { partnerStatus: { equals: 'active' } },
          ...(data.tenant ? [{ tenant: { equals: data.tenant } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })

    const partner = partners.docs?.[0] as { id: number; rate?: number } | undefined

    // Total is in the order's own units; commission follows it, so the two are
    // always comparable without knowing whether that's dollars or cents.
    const total = Number((data as { total?: number; amount?: number }).total ?? (data as { amount?: number }).amount ?? 0)
    const rate = typeof partner?.rate === 'number' ? partner.rate : undefined

    ;(data as Record<string, unknown>).referral = {
      // An unmatched code is recorded anyway: it means a partner's link has a
      // typo in it, and the only way to find those is to keep them.
      partner: partner?.id ?? null,
      code: cookie.c.toLowerCase(),
      rate: rate ?? null,
      commission: rate && total ? Math.round(total * rate) / 100 : null,
      landedAt: cookie.t ?? null,
      landingPath: cookie.p ?? null,
      payoutStatus: 'pending',
    }
  } catch {
    /* Attribution is never worth a failed checkout. */
  }

  return data
}
