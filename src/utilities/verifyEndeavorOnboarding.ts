/**
 * verifyEndeavorOnboarding — the repeatable onboarding invariant check.
 *
 * Asserts (and HEALS) everything a freshly-provisioned endeavor portal should
 * have. Idempotent: safe to run on any tenant, any number of times. This is the
 * provisioning analog of the site-replication tool — a single call you (or LEO)
 * run against a portal to bring it to a known-good baseline:
 *
 *   ✓ AI Bus space (slug: ai-bus, private) + its system/integration channels
 *   ✓ Main Community space (isMain: true) + human channels
 *   ✓ DM space (slug: direct-messages)
 *   ✓ ALL page-comment channels homed on the AI Bus (re-parent any that drifted)
 *   ✓ Every ACTIVE tenant-member has a space-membership in each space
 *
 * Returns a structured report of what existed vs. what was healed.
 */
import type { Payload } from 'payload'
import { ensureTenantDefaults } from './ensureTenantDefaults'
import { resolveAiBusSpaceId } from './ensureSystemSpace'
import { reparentPageChannelsToAiBus } from './ensurePageChannel'

export interface OnboardingReport {
  tenantId: number | string
  aiBusSpaceId?: string
  mainSpaceId?: string
  dmSpaceId?: string
  mainChannelsCreated: number
  pageChannelsReparented: number
  membersBackfilled: number
  spacesCount: number
  membersCount: number
  errors: string[]
}

export async function verifyEndeavorOnboarding(
  payload: Payload,
  tenantId: number | string,
  // The request — threaded to ensureTenantDefaults so baseline-channel writes
  // reuse the request connection (prod pool starvation fix). Optional so
  // non-HTTP callers still work (they get autonomous writes).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req?: any,
): Promise<OnboardingReport> {
  const errors: string[] = []

  // 1. Baseline spaces + channels (idempotent create-if-missing).
  const defaults = await ensureTenantDefaults(payload, tenantId, req)
  errors.push(...defaults.errors)

  const aiBusSpaceId = defaults.aiBusSpaceId ?? (await resolveAiBusSpaceId(payload, tenantId))

  // 2. Re-home any page-comment channels that drifted off the AI Bus.
  let pageChannelsReparented = 0
  if (aiBusSpaceId) {
    try {
      pageChannelsReparented = await reparentPageChannelsToAiBus(payload, tenantId, aiBusSpaceId)
    } catch (e) {
      errors.push(`reparent page channels: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 3. Backfill space-memberships: every ACTIVE tenant member should belong to
  //    every space in the tenant. (Closes the new-member-sees-nothing gap.)
  let membersBackfilled = 0
  let spacesCount = 0
  let membersCount = 0
  try {
    const [spaces, members] = await Promise.all([
      payload.find({
        collection: 'spaces',
        where: { tenant: { equals: tenantId } },
        limit: 200,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'tenant-memberships',
        where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: 'active' } }] },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    spacesCount = spaces.docs.length
    membersCount = members.docs.length

    const spaceIds = spaces.docs.map((s) => s.id)

    // SEQUENTIAL only — never parallelize creates on the max=3 pool (deadlock).
    for (const m of members.docs as Array<{ user: unknown }>) {
      const userId = typeof m.user === 'object' && m.user ? (m.user as { id: number | string }).id : m.user
      if (userId == null) continue

      const existing = await payload.find({
        collection: 'space-memberships',
        where: { and: [{ user: { equals: userId } }, { space: { in: spaceIds } }] },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      })
      const joined = new Set(
        existing.docs.map((d: { space: unknown }) =>
          String(typeof d.space === 'object' && d.space ? (d.space as { id: number | string }).id : d.space),
        ),
      )
      for (const space of spaces.docs) {
        if (joined.has(String(space.id))) continue
        try {
          await payload.create({
            collection: 'space-memberships',
            data: {
              user: userId as number,
              space: space.id as number,
              role: 'member',
              status: 'active',
              joinedAt: new Date().toISOString(),
              tenant: tenantId as number,
            } as never,
            overrideAccess: true,
          })
          membersBackfilled++
        } catch {
          /* duplicate/constraint → treat as already-joined */
        }
      }
    }
  } catch (e) {
    errors.push(`member backfill: ${e instanceof Error ? e.message : String(e)}`)
  }

  return {
    tenantId,
    aiBusSpaceId,
    mainSpaceId: defaults.mainSpaceId,
    dmSpaceId: defaults.dmSpaceId,
    mainChannelsCreated: defaults.mainChannelsCreated,
    pageChannelsReparented,
    membersBackfilled,
    spacesCount,
    membersCount,
    errors,
  }
}
