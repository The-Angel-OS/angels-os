/**
 * ensureGuardianAngel — the onboarding floor: every person gets their personal
 * guardian-angel portal, minted the first time they authenticate (Nimue login via
 * /api/auth/federated). Idempotent by gmail⇔angel 1:1 — repeat logins find the
 * existing angel and return it, never a duplicate.
 *
 * This is the auto-provision counterpart to the self-serve
 * /api/provision-ops/claim-guardian-angel endpoint: same provisioning config
 * (opaque {slug}.spacesangels.com, isGuardianAngel, born free), minus the
 * self-serve extras (vanity slug, createAdditional, rate limit) that only the
 * explicit user-initiated claim needs. @see claim-guardian-angel.ts,
 * [[project_guardian_angel_monetization]].
 */
import type { Payload, PayloadRequest } from 'payload'
import { provisionPortal } from '@/utilities/provisionPortal'
import { opaqueSlug, guardianBaseDomain } from '@/utilities/guardianSlug'
import { ensureDefaultAvailability } from '@/utilities/ensureDefaultAvailability'
import { activatePendingInvitesForUser } from '@/utilities/activatePendingInvites'

export interface EnsureGuardianAngelResult {
  /** true when a NEW angel was minted this call; false when one already existed. */
  provisioned: boolean
  tenant?: { id: number | string; slug?: string; domain?: string }
  url?: string
}

/**
 * Find the user's personal guardian angel, or mint one if they have none.
 * A business owner (e.g. runs Clearwater-Cruisin) still gets a PERSONAL angel —
 * we only count tenants marked `isGuardianAngel`, never their businesses.
 */
export async function ensureGuardianAngel(
  payload: Payload,
  user: { id: number | string; email?: string | null; name?: string | null },
  opts: { req?: PayloadRequest } = {},
): Promise<EnsureGuardianAngelResult> {
  const email = (user.email || '').trim().toLowerCase()
  if (!email) return { provisioned: false }

  // Existing personal angel? (tenant_admin membership → isGuardianAngel tenant)
  const adminMemberships = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { user: { equals: user.id } },
        { role: { equals: 'tenant_admin' } },
        { status: { in: ['active', 'pending'] } },
      ],
    },
    depth: 1,
    sort: 'createdAt',
    limit: 100,
    overrideAccess: true,
  })
  type TenantRef = { id?: number | string; slug?: string; domain?: string; isGuardianAngel?: boolean }
  const existing = adminMemberships.docs
    .map((m) => (m as { tenant?: TenantRef | number | string }).tenant)
    .find((t): t is TenantRef => t != null && typeof t === 'object' && t.isGuardianAngel === true)

  if (existing) {
    return {
      provisioned: false,
      tenant: { id: existing.id!, slug: existing.slug, domain: existing.domain },
      url: existing.domain ? `https://${existing.domain}` : undefined,
    }
  }

  // Getting your angel IS accepting your invites — light up any pending ones.
  await activatePendingInvitesForUser(payload, user.id, email).catch(() => {})

  // Allocate an opaque, unguessable slug (privacy default).
  const baseDomain = guardianBaseDomain()
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
  let slug = ''
  for (let i = 0; i < 10; i++) {
    const candidate = opaqueSlug()
    if (await isFree(candidate)) {
      slug = candidate
      break
    }
  }
  if (!slug) throw new Error('could not allocate a unique guardian-angel slug')

  // Privacy-first display name: first name only — never auto-expose a surname
  // pulled from the Google account.
  const firstName = (user.name || '').trim().split(/\s+/)[0] || 'Guardian'

  const result = await provisionPortal(
    payload,
    {
      name: firstName,
      slug,
      domain: `${slug}.${baseDomain}`,
      tagline: 'A guardian angel in the Angel OS network',
      endeavorType: 'creator-content',
      networkVisible: false, // personal angels aren't in Discovery (still reachable)
      isGuardianAngel: true,
    },
    { req: opts.req, actingUserId: user.id },
  )

  const tenant = (result as { tenant?: { id?: number | string; slug?: string; domain?: string } }).tenant
  if (tenant?.id != null) {
    // Turnkey scheduler so their "book time with me" link works immediately.
    await ensureDefaultAvailability(payload, tenant.id, user.id).catch(() => {})
  }

  return {
    provisioned: true,
    tenant: tenant ? { id: tenant.id!, slug: tenant.slug, domain: tenant.domain } : undefined,
    url: tenant?.domain ? `https://${tenant.domain}` : undefined,
  }
}
