/**
 * Claim Guardian Angel — POST /api/provision-ops/claim-guardian-angel
 *
 * The monetization keystone: a SIGNED-IN user provisions their OWN guardian-angel
 * portal in one call — the "download Nimue → you get a {slug}.kendev.co guardian
 * angel" mechanic. Unlike provision-ops/portal (super_admin/CRON, provisions FOR
 * someone), this is self-serve: the caller becomes tenant_admin of their own portal
 * immediately (they're authenticated, so no email-invite round-trip).
 *
 * Parameterized so the "where do these live" decision isn't baked in: the base
 * domain is GUARDIAN_ANGEL_BASE_DOMAIN (default kendev.co). Point it at a dedicated
 * "Guardian Angels" Enterprise + domain later by changing one env var — no rebuild.
 *
 * SAFEGUARDS (we're monetizing, not spamming tenants into existence):
 *   - Shipped DARK: does nothing unless GUARDIAN_ANGEL_SELF_PROVISION === 'true'.
 *     Keeps the door shut until the paywall is wired.
 *   - Authenticated users only; one guardian angel per user (idempotent — a user
 *     who already admins a portal gets it back, never a second).
 *   - Paid tier: when GUARDIAN_ANGEL_REQUIRE_PAYMENT === 'true', a user without an
 *     entitlement gets 402 + a checkout hint instead of a portal. (Entitlement check
 *     is a stub today — see TODO — so the funnel shape exists before Stripe is wired.)
 *
 * Guardian Angel tier funds philanthropy + platform upkeep + living expenses — the
 * revenue engine. @see provisionPortal, [[project_token_economy]].
 */
import type { PayloadHandler } from 'payload'
import { provisionPortal } from '@/utilities/provisionPortal'
import { logError } from '@/utilities/logError'

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)

/** Derive a friendly slug base from the user's name, falling back to the email local part. */
function slugBase(name: string | undefined, email: string): string {
  const fromName = name ? slugify(name) : ''
  if (fromName && fromName.length >= 3) return fromName
  const local = email.split('@')[0] || 'angel'
  return slugify(local) || 'angel'
}

/** TODO(payment): replace with a real entitlement check (subscriptions/Stripe). */
async function hasGuardianAngelEntitlement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _user: any,
): Promise<boolean> {
  return false
}

export const claimGuardianAngelHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'sign-in required' }, { status: 401 })
  }
  // Shipped dark — the door stays shut until the paywall is ready.
  if (process.env.GUARDIAN_ANGEL_SELF_PROVISION !== 'true') {
    return Response.json({ error: 'guardian-angel self-provisioning is not enabled on this node' }, { status: 403 })
  }

  const u = user as { id: number | string; email?: string; name?: string; roles?: string[] }
  const email = (u.email || '').trim().toLowerCase()
  if (!email) {
    return Response.json({ error: 'a verified email is required to claim a guardian angel' }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* body optional */
  }

  try {
    // Idempotency: one guardian angel per user. If they already admin a portal,
    // hand it back rather than minting a second.
    const existing = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { user: { equals: u.id } },
          { role: { equals: 'tenant_admin' } },
          { status: { in: ['active', 'pending'] } },
        ],
      },
      depth: 1,
      limit: 1,
      overrideAccess: true,
    })
    if (existing.totalDocs > 0) {
      const m = existing.docs[0] as { tenant?: { id?: number | string; slug?: string; domain?: string } | number | string }
      const t = typeof m.tenant === 'object' ? m.tenant : null
      return Response.json({
        ok: true,
        alreadyExisted: true,
        tenant: t ? { id: t.id, slug: t.slug, domain: t.domain } : { id: m.tenant },
        url: t?.domain ? `https://${t.domain}` : undefined,
        message: 'You already have a guardian angel.',
      })
    }

    // Paid tier funnel — return a checkout hint instead of a portal when required.
    if (process.env.GUARDIAN_ANGEL_REQUIRE_PAYMENT === 'true') {
      const entitled = await hasGuardianAngelEntitlement(u)
      if (!entitled) {
        return Response.json(
          {
            ok: false,
            paymentRequired: true,
            message: 'The Guardian Angel tier is a paid subscription. Complete checkout to claim your portal.',
            // TODO(payment): mint a real Stripe Checkout session URL here.
            checkoutUrl: process.env.GUARDIAN_ANGEL_CHECKOUT_URL || null,
          },
          { status: 402 },
        )
      }
    }

    // Derive a unique slug: friendly base, collision-suffixed against existing tenants.
    const base = slugBase(u.name, email)
    const baseDomain = (process.env.GUARDIAN_ANGEL_BASE_DOMAIN || 'kendev.co').replace(/^\.+|\.+$/g, '')
    let slug = base
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`
      const clash = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: candidate } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (clash.totalDocs === 0) {
        slug = candidate
        break
      }
    }

    const displayName =
      (typeof body.name === 'string' && body.name.trim()) || u.name || `${base}'s Guardian Angel`

    const result = await provisionPortal(
      payload,
      {
        name: displayName,
        slug,
        domain: `${slug}.${baseDomain}`,
        tagline: 'A guardian angel in the Angel OS network',
        endeavorType: 'creator-content',
      },
      { req, actingUserId: u.id }, // the claimant becomes tenant_admin directly
    )

    return Response.json({ ...result, alreadyExisted: false })
  } catch (e) {
    await logError({
      source: 'claim-guardian-angel',
      message: e instanceof Error ? e.message : String(e),
      details: e instanceof Error ? e.stack : undefined,
      statusCode: 500,
      userId: u.id,
    }).catch(() => {})
    return Response.json({ error: e instanceof Error ? e.message : 'claim failed' }, { status: 500 })
  }
}
