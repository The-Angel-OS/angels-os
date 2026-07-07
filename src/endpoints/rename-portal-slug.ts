/**
 * Rename Portal Slug — POST /api/provision-ops/rename-portal-slug
 *
 * The mutable-address path: a signed-in user (or LEO/Nimue acting for them)
 * changes their guardian angel's public handle as the endeavor takes shape —
 * `{opaque}.kendev.co` → `sparkle-pressure-washing.kendev.co`. Old links keep
 * working (the previous subdomain is preserved as an alias). Self-scoped: renames
 * the CALLER's own portal (the tenant they admin); a super_admin may target any
 * tenant via `tenantId`.
 *
 * Body: { newSlug: string, tenantId?: number|string (super_admin only) }
 *
 * @see src/utilities/renamePortalSlug.ts — the safe, alias-preserving rename
 */
import type { PayloadHandler } from 'payload'
import { renamePortalSlug, RenameSlugError } from '@/utilities/renamePortalSlug'

export const renamePortalSlugHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'sign-in required' }, { status: 401 })

  const u = user as { id: number | string; roles?: string[] }
  const isSuperAdmin = Array.isArray(u.roles) && u.roles.includes('super_admin')

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* body required below */
  }

  const newSlug = typeof body.newSlug === 'string' ? body.newSlug.trim() : ''
  if (!newSlug) return Response.json({ error: 'newSlug is required' }, { status: 400 })

  try {
    // Resolve which tenant to rename. super_admin may target any via tenantId;
    // everyone else renames the portal they administer.
    let tenantId: number | string | undefined
    if (isSuperAdmin && body.tenantId != null) {
      tenantId = body.tenantId as number | string
    } else {
      const membership = await payload.find({
        collection: 'tenant-memberships',
        where: {
          and: [
            { user: { equals: u.id } },
            { role: { equals: 'tenant_admin' } },
            { status: { in: ['active', 'pending'] } },
          ],
        },
        depth: 0,
        limit: 1,
        sort: 'createdAt',
        overrideAccess: true,
      })
      const m = membership.docs?.[0] as { tenant?: number | string | { id: number | string } } | undefined
      tenantId = m ? (typeof m.tenant === 'object' ? m.tenant?.id : m.tenant) : undefined
    }

    if (tenantId == null) {
      return Response.json({ error: 'no portal found to rename' }, { status: 404 })
    }

    const result = await renamePortalSlug(payload, { tenantId, newSlug }, { req })
    return Response.json(result)
  } catch (e) {
    if (e instanceof RenameSlugError) {
      const status = e.code === 'not_found' ? 404 : e.code === 'taken' ? 409 : 400
      return Response.json({ error: e.message, code: e.code }, { status })
    }
    return Response.json(
      { error: e instanceof Error ? e.message : 'rename failed' },
      { status: 500 },
    )
  }
}
