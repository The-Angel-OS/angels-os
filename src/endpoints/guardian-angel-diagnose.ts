/**
 * Guardian Angel Diagnose — GET /api/provision-ops/guardian-angel-diagnose
 *
 * "Why don't I have a guardian angel?" answered as a checklist. Self-scoped +
 * auth-required, so any signed-in user can see the exact standing of their own
 * backstore and the first blocker — instead of guessing across Payload Admin,
 * the chooser, and env vars.
 *
 * Checks, in the order they block provisioning:
 *   1. selfProvisionEnabled — GUARDIAN_ANGEL_SELF_PROVISION === 'true'. If false,
 *      claim-guardian-angel 403s and NOTHING is ever created (shipped dark).
 *   2. isGuardianAngelColumn — the tenants.is_guardian_angel column exists. If the
 *      migration didn't land on this DB, the marker can't be written/read, so a
 *      provisioned angel still reads as "not a guardian".
 *   3. guardianTenant — the resolved personal guardian tenant (isGuardianAngel), if any.
 *
 * @see src/endpoints/claim-guardian-angel.ts  @see src/endpoints/ensure-guardian-angel-column.ts
 */
import type { PayloadHandler } from 'payload'
import { resolveGuardianTenant } from '@/utilities/guardianEntitlement'

export const guardianAngelDiagnoseHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'sign-in required' }, { status: 401 })
  const u = user as { id: number | string; email?: string }

  // Probe the column by filtering on it — a missing column throws (drift).
  let isGuardianAngelColumn = false
  try {
    await payload.find({
      collection: 'tenants',
      where: { isGuardianAngel: { equals: true } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    isGuardianAngelColumn = true
  } catch {
    isGuardianAngelColumn = false
  }

  // How many tenants does the caller admin? (context — a business admin who has
  // never opened Nimue would show adminTenants>0 but no guardian.)
  let adminTenants = 0
  try {
    const m = await payload.count({
      collection: 'tenant-memberships',
      where: { and: [{ user: { equals: u.id } }, { role: { equals: 'tenant_admin' } }] },
      overrideAccess: true,
    })
    adminTenants = m.totalDocs
  } catch {
    /* non-fatal */
  }

  const guardian = isGuardianAngelColumn ? await resolveGuardianTenant(payload, u.id).catch(() => null) : null
  const hasGuardianAngel = Boolean(guardian)

  let nextAction: string
  if (!isGuardianAngelColumn) {
    nextAction =
      'The is_guardian_angel column is missing on this DB — run GET /api/provision-ops/ensure-guardian-angel-column, confirm ok:true, then claim again.'
  } else if (!hasGuardianAngel) {
    nextAction =
      'No guardian angel yet — POST /api/provision-ops/claim-guardian-angel (or re-open Nimue, which calls it on sign-in). Self-provisioning is always on now.'
  } else {
    nextAction = `You have a guardian angel: ${guardian?.slug} (${guardian?.domain || 'no domain'}). It should appear in the chooser + Payload Admin.`
  }

  return Response.json({
    ok: true,
    hasGuardianAngel,
    checks: { isGuardianAngelColumn, adminTenants },
    guardian: guardian ? { id: guardian.id, slug: guardian.slug, domain: guardian.domain } : null,
    nextAction,
  })
}
