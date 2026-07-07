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
 * domain is GUARDIAN_ANGEL_BASE_DOMAIN (default spacesangels.com — these are The
 * Angel OS's citizens, NOT kendev.co which is Ken's own consultancy + backup
 * federation). Point it at a dedicated Enterprise/domain later via one env var.
 *
 * SAFEGUARDS (we're monetizing, not spamming tenants into existence):
 *   - Shipped DARK: does nothing unless GUARDIAN_ANGEL_SELF_PROVISION === 'true'.
 *     Keeps the door shut until the paywall is wired.
 *   - Authenticated users only. The mapping is gmail ⇔ guardian angel: 1:1 by
 *     default and IDEMPOTENT (open the app → get your primary back, never a
 *     duplicate), but a person may create a few more with `createAdditional:true`
 *     up to GUARDIAN_ANGEL_MAX_PER_USER (default 3) + a light per-user rate limit.
 *     Not abuse-policing — three isn't abuse if they need three.
 *   - PROVISION-FREE-FIRST: no paywall at the door — every angel is born free. The
 *     platform meters usage (guardianUsage) and only passes cost through past the
 *     free-tier allowance; the paid subscription (guardian-angel-checkout) is a
 *     usage-time upsell, never an entry gate.
 *
 * Guardian Angel tier funds philanthropy + platform upkeep + living expenses — the
 * revenue engine. @see provisionPortal, [[project_token_economy]].
 */
import type { PayloadHandler } from 'payload'
import { provisionPortal } from '@/utilities/provisionPortal'
import { logError } from '@/utilities/logError'
import { slugify, opaqueSlug, vanitySlugRejection, guardianBaseDomain } from '@/utilities/guardianSlug'

/**
 * The mapping is gmail ⇔ guardian angel: 1:1 by default (auto-provisioned the
 * instant the app opens), but a person CAN have a few — three isn't abuse if
 * they genuinely need three. So we don't hard-cap at one; we set a generous soft
 * ceiling and a light rate limit that only catches runaway loops / scripted
 * abuse. The system is meant to absorb honest cost and adapt, not to police.
 */
const MAX_PER_USER = (() => {
  const n = Number(process.env.GUARDIAN_ANGEL_MAX_PER_USER)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3
})()

// Best-effort in-memory throttle (per lambda instance): cap fresh provisions per
// user in a short window so an errant retry loop can't mint dozens. Honest use
// (open app, claim, occasionally add one) never trips it.
const PROVISION_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_PROVISIONS_PER_WINDOW = 3
const provisionHistory = new Map<string, number[]>() // userId → recent provision ms

/** Reset the provision throttle — TESTS ONLY. */
export function __resetGuardianClaimState(): void {
  provisionHistory.clear()
}

function tooManyRecentProvisions(userId: number | string, now: number = Date.now()): boolean {
  const key = String(userId)
  const recent = (provisionHistory.get(key) || []).filter((t) => now - t < PROVISION_WINDOW_MS)
  provisionHistory.set(key, recent)
  return recent.length >= MAX_PROVISIONS_PER_WINDOW
}

function recordProvision(userId: number | string, now: number = Date.now()): void {
  const key = String(userId)
  const recent = (provisionHistory.get(key) || []).filter((t) => now - t < PROVISION_WINDOW_MS)
  recent.push(now)
  provisionHistory.set(key, recent)
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

  // Explicit intent to create ANOTHER angel (beyond the auto-provisioned primary).
  const createAdditional = body.createAdditional === true

  try {
    // How many angels does this user already admin? The FIRST call (app open) is
    // idempotent: no flag + already have one → hand back the primary, so opening
    // the app repeatedly never mints duplicates.
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
      sort: 'createdAt',
      limit: MAX_PER_USER + 1,
      overrideAccess: true,
    })
    const angelCount = existing.totalDocs

    if (angelCount > 0 && !createAdditional) {
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

    // Additional-angel request: honor the generous soft cap. Not abuse-policing —
    // just a ceiling so the mapping stays sane. Overridable via env.
    if (createAdditional && angelCount >= MAX_PER_USER) {
      return Response.json(
        {
          ok: false,
          limitReached: true,
          angelCount,
          max: MAX_PER_USER,
          message: `You already have ${angelCount} guardian angels (max ${MAX_PER_USER}). Reach out if you genuinely need more.`,
        },
        { status: 409 },
      )
    }

    // Light rate limit: stop a runaway retry loop from minting a burst. Honest
    // use never trips this.
    if (tooManyRecentProvisions(u.id)) {
      return Response.json(
        {
          ok: false,
          rateLimited: true,
          message: 'Too many new angels created just now — give it a few minutes and try again.',
        },
        { status: 429 },
      )
    }

    // PROVISION-FREE-FIRST: no paywall at the door. Every angel is born free; the
    // platform absorbs honest cost and only passes it through once a user crosses
    // their free-tier allowance (see guardianUsage / guardian-angel-status → the
    // Nimue banner → guardian-angel-checkout). Payment is a usage-time upsell, not
    // an entry gate. This is the Play-Store magic: open the app, get your angel.

    const baseDomain = guardianBaseDomain()

    // Helper: is this slug free?
    const isFree = async (candidate: string): Promise<boolean> => {
      const clash = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: candidate } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      return clash.totalDocs === 0
    }

    // OPT-IN vanity handle: only when the caller explicitly asks and it's a
    // legal, non-reserved slug. Otherwise the slug is opaque (privacy default).
    const requestedVanity =
      typeof body.vanitySlug === 'string' ? slugify(body.vanitySlug) : ''
    let slug = ''
    if (requestedVanity && vanitySlugRejection(requestedVanity) === null) {
      for (let i = 0; i < 50; i++) {
        const candidate = i === 0 ? requestedVanity : `${requestedVanity}-${i + 1}`
        if (await isFree(candidate)) {
          slug = candidate
          break
        }
      }
    }
    // Default (or vanity exhausted): an opaque, unguessable id — regenerate on
    // the astronomically-rare collision.
    if (!slug) {
      for (let i = 0; i < 10; i++) {
        const candidate = opaqueSlug()
        if (await isFree(candidate)) {
          slug = candidate
          break
        }
      }
    }
    if (!slug) throw new Error('could not allocate a unique slug')

    // Display name is their concern, not routing: use what they pass, else their
    // account name, else a neutral label — never derived from the opaque slug.
    const displayName =
      (typeof body.name === 'string' && body.name.trim()) || u.name || 'My Guardian Angel'

    const result = await provisionPortal(
      payload,
      {
        name: displayName,
        slug,
        domain: `${slug}.${baseDomain}`,
        tagline: 'A guardian angel in the Angel OS network',
        endeavorType: 'creator-content',
        networkVisible: false, // personal angels don't appear in Discovery (still reachable)
      },
      { req, actingUserId: u.id }, // the claimant becomes tenant_admin directly
    )

    recordProvision(u.id) // count this fresh mint against the rate-limit window
    return Response.json({ ...result, alreadyExisted: false, angelCount: angelCount + 1 })
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
