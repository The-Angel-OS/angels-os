/**
 * DB Repair: guardian-angel marker column —
 * GET /api/provision-ops/ensure-guardian-angel-column
 *
 * Phase 1 of marking personal guardian-angel portals distinctly from business
 * portals. The claim flow must be able to answer "which of the tenants this user
 * admins is their PERSONAL guardian angel?" — otherwise a user who already admins
 * a business (e.g. Ken → Clearwater-Cruisin) would get that business handed back
 * on Nimue load instead of a fresh personal angel.
 *
 * Per the schema-field-deploy rule, the `is_guardian_angel` column MUST exist on
 * every production DB BEFORE the Tenants.isGuardianAngel field deploys — else
 * every tenant read references a missing column and the site falls back to the
 * platform home (outage). Run this against EACH prod URL (spacesangels + kendev)
 * before shipping the field. Uses the deployment's OWN pool. Safe to run repeatedly.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>.
 *
 * @see src/endpoints/ensure-tenant-hero-columns.ts — the pattern this mirrors
 */
import type { PayloadHandler } from 'payload'

const TABLE = 'tenants'
const COLUMN = 'is_guardian_angel' // Payload flattens top-level checkbox `isGuardianAngel`

export const ensureGuardianAngelColumnHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload.db as any)?.pool
  if (!pool?.query) {
    return Response.json({ error: 'no pg pool on payload.db' }, { status: 500 })
  }

  let alreadyExisted = false
  try {
    const res = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      [TABLE, COLUMN],
    )
    alreadyExisted = res.rows.length > 0
  } catch {
    /* introspection optional — ADD IF NOT EXISTS is still safe */
  }

  try {
    // IF NOT EXISTS → idempotent. Boolean default false so existing rows are valid
    // and reads never see null. Fixed literal — no user input.
    await pool.query(
      `ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "${COLUMN}" boolean DEFAULT false;`,
    )
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, column: COLUMN, created: !alreadyExisted })
}
