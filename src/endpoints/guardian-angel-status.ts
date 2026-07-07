/**
 * Guardian Angel Status — GET /api/provision-ops/guardian-angel-status
 *
 * The read companion to claim-guardian-angel. A signed-in Nimue user asks
 * "what's the standing of my backstore?" and gets back: do they have a guardian
 * angel yet, and if so are they within the free tier or over it (and by how
 * much). This is the data behind the Nimue usage banner and the Stripe upsell —
 * the moment we pass costs through is a UI nudge, never a locked door.
 *
 * Self-scoped: always reports on the CALLER's own guardian tenant (the tenant
 * they admin), so it's safe to expose to any authenticated user. Fail-soft — a
 * missing cost ledger yields a within-free answer, never a 500.
 *
 * @see src/utilities/guardianUsage.ts — the free-tier decision layer
 * @see src/endpoints/claim-guardian-angel.ts — provisions the backstore
 */
import type { PayloadHandler } from 'payload'
import { getGuardianUsage, describeGuardianUsage } from '@/utilities/guardianUsage'
import { hasGuardianAngelEntitlement } from '@/utilities/guardianEntitlement'

export const guardianAngelStatusHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) {
    return Response.json({ error: 'sign-in required' }, { status: 401 })
  }

  const u = user as { id: number | string }

  try {
    // Find the tenant this user administers — their guardian angel.
    const membership = await payload.find({
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
      sort: 'createdAt', // oldest admin membership = their original backstore
      overrideAccess: true,
    })

    if (membership.totalDocs === 0) {
      return Response.json({
        ok: true,
        hasGuardianAngel: false,
        message: 'No guardian angel yet — claim one to get your own backstore.',
      })
    }

    const m = membership.docs[0] as {
      tenant?: { id?: number | string; slug?: string; domain?: string } | number | string
    }
    const t = typeof m.tenant === 'object' ? m.tenant : null
    const tenantId = t?.id ?? (m.tenant as number | string)
    const tenantSlug = t?.slug

    const usage = await getGuardianUsage(payload, tenantId, { tenantSlug })
    const subscribed = await hasGuardianAngelEntitlement(payload, u.id)

    // Offer the upgrade only when it's actually warranted: over the free tier and
    // not already subscribed. The banner reads `usage.message`; `upgrade` drives
    // the CTA. Provisioning was free — this is the honest usage-time nudge.
    const shouldUpgrade = usage.status === 'over_free' && !subscribed

    return Response.json({
      ok: true,
      hasGuardianAngel: true,
      tenant: { id: tenantId, slug: tenantSlug, domain: t?.domain },
      url: t?.domain ? `https://${t.domain}` : undefined,
      usage,
      subscribed,
      upgrade: shouldUpgrade
        ? { available: true, endpoint: '/api/provision-ops/guardian-angel-checkout' }
        : { available: false },
      message: describeGuardianUsage(usage),
    })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'status lookup failed' },
      { status: 500 },
    )
  }
}
