/**
 * Decommission Portal — POST /api/provision-ops/decommission
 *
 * The deprovision half of the provision↔deprovision pair. Wraps the shared
 * decommissionTenant() utility (already mounted as the decommission_tenant LEO
 * tool + CLI) behind the same CRON_SECRET/super_admin gate provision-ops uses,
 * so the factory can tear a portal down the same way it stands one up.
 *
 * DESTRUCTIVE — guarded accordingly:
 *   - super_admin session OR ?key=CRON_SECRET (never a tenant admin).
 *   - DRY-RUN by default. Deletion happens only when execute === true.
 *   - Executing additionally requires confirmSlug === slug — belt-and-suspenders
 *     so a stray execute:true can't nuke the wrong portal.
 *
 * Body: { slug, execute?: boolean, confirmSlug?: string }
 */
import type { PayloadHandler } from 'payload'
import { decommissionTenant } from '@/utilities/decommissionTenant'
import { logError } from '@/utilities/logError'

export const decommissionPortalHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  const url = new URL(req.url || 'http://localhost', 'http://localhost')
  const key = url.searchParams.get('key')
  const isSuperAdmin = Boolean(((user as { roles?: string[] } | undefined)?.roles)?.includes('super_admin'))
  const keyValid = Boolean(key && process.env.CRON_SECRET && key === process.env.CRON_SECRET)
  if (!isSuperAdmin && !keyValid) {
    return Response.json({ error: 'super_admin or ?key=CRON_SECRET required' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* allow empty body */
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  if (!slug) {
    return Response.json({ error: 'slug is required' }, { status: 400 })
  }

  const wantsExecute = body.execute === true
  const confirmSlug = typeof body.confirmSlug === 'string' ? body.confirmSlug.trim() : ''

  // Guard: to actually delete, the caller must echo the slug back. A dry-run
  // (execute omitted/false) always proceeds so it's easy to preview the blast radius.
  if (wantsExecute && confirmSlug !== slug) {
    return Response.json(
      {
        error: 'To execute a deletion, pass confirmSlug matching slug. Omit execute for a dry-run.',
        hint: `{ "slug": "${slug}", "execute": true, "confirmSlug": "${slug}" }`,
      },
      { status: 400 },
    )
  }

  try {
    const result = await decommissionTenant(payload, { slug, execute: wantsExecute })
    if (!result.found) {
      return Response.json({ ...result, message: `No tenant with slug "${slug}" on this node.` }, { status: 404 })
    }
    return Response.json({
      ...result,
      message: wantsExecute
        ? `Decommissioned "${slug}" — ${result.totalRows} rows removed across ${result.steps.length} collections.`
        : `Dry-run for "${slug}" — ${result.totalRows} rows across ${result.steps.length} collections WOULD be removed. Re-send with execute:true + confirmSlug to proceed.`,
    })
  } catch (e) {
    await logError({
      source: 'decommission-portal',
      message: e instanceof Error ? e.message : String(e),
      details: e instanceof Error ? e.stack : undefined,
    }).catch(() => {})
    return Response.json({ error: e instanceof Error ? e.message : 'decommission failed' }, { status: 500 })
  }
}
