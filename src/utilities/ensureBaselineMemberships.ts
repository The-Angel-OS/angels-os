import type { Payload, PayloadRequest } from 'payload'

/**
 * ensureBaselineMemberships — THE one door every new user walks through.
 *
 * Ken's 260723 rule: every user, however they arrive, ends up with three things:
 *   1. Membership in **The Angel OS root portal** (the platform tenant) — the
 *      commons everyone belongs to.
 *   2. Their **own Guardian Angel portal** — personal tenant, their spaces/config,
 *      and the LEO channel that becomes their Life Log corpus.
 *   3. Membership in **the portal they actually logged into / were invited to**
 *      (passed as `joiningTenantId`).
 *
 * Before this existed the three doors disagreed: Google login and OTP login each
 * called ensureGuardianAngel, the email-invite accept path called neither, and
 * NOTHING ever granted the platform membership. Same intent, three behaviours.
 *
 * Fail-soft by design and idempotent — a login or an invite-accept must never
 * fail because a baseline grant hiccuped. Callers do not need a try/catch.
 *
 * @see ensureGuardianAngel — provisions the personal tenant
 * @see ensureTenantMembership — idempotent tenant-membership upsert
 * @see project_lifelog_portal_corpus — why the Guardian Angel portal matters
 */

/** Slug of the root portal. Matches the container's DEFAULT_TENANT_SLUG. */
const PLATFORM_SLUG = process.env.DEFAULT_TENANT_SLUG || 'platform'

export interface BaselineResult {
  platformJoined: boolean
  guardianProvisioned: boolean
  joiningTenantJoined: boolean
}

export async function ensureBaselineMemberships(
  payload: Payload,
  user: { id: number | string; email?: string | null; name?: string | null },
  opts: { joiningTenantId?: number | string | null; req?: PayloadRequest } = {},
): Promise<BaselineResult> {
  const result: BaselineResult = {
    platformJoined: false,
    guardianProvisioned: false,
    joiningTenantJoined: false,
  }
  if (!user?.id) return result

  const { ensureTenantMembership } = await import('@/utilities/ensureTenantMembership')

  // 1. The Angel OS root portal — the commons.
  try {
    const platform = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: PLATFORM_SLUG } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const platformId = (platform.docs[0] as { id: number | string } | undefined)?.id
    if (platformId != null) {
      await ensureTenantMembership(user.id, platformId, opts.req)
      result.platformJoined = true
    }
  } catch (err) {
    payload.logger?.warn?.(
      `[baseline] platform membership failed for user ${user.id}: ${err instanceof Error ? err.message : err}`,
    )
  }

  // 2. Their own Guardian Angel portal. Needs an email — a phone-only user gets
  //    one on their first login that carries an email.
  if (user.email) {
    try {
      const { ensureGuardianAngel } = await import('@/utilities/ensureGuardianAngel')
      const ga = await ensureGuardianAngel(payload, user, { req: opts.req })
      result.guardianProvisioned = Boolean(ga?.provisioned)
    } catch (err) {
      payload.logger?.warn?.(
        `[baseline] guardian angel failed for user ${user.id}: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  // 3. The portal they're actually joining (skip if it IS the platform — step 1).
  if (opts.joiningTenantId != null) {
    try {
      await ensureTenantMembership(user.id, opts.joiningTenantId, opts.req)
      result.joiningTenantJoined = true
    } catch (err) {
      payload.logger?.warn?.(
        `[baseline] joining-tenant membership failed for user ${user.id}: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  return result
}
