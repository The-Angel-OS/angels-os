/**
 * Ensure Spaces — GET /api/provision-ops/ensure-spaces
 *
 * Self-heal a tenant's baseline Spaces/Channels (the "Community" space + default
 * channels). Idempotent — safe to re-run. Use to backfill tenants that were
 * provisioned before the space step existed (e.g. WDEG, WDEG.net).
 *
 *   ?tenant=<slug>   heal one tenant by slug
 *   ?all=1           heal every tenant (bounded scan)
 *
 * Guard: super_admin OR ?key=CRON_SECRET (so it can run from a cron/browser).
 */
import type { PayloadHandler } from 'payload'
import { ensureTenantSpaces } from '@/utilities/ensureTenantSpaces'

export const ensureSpacesHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  // Accept ?key=CRON_SECRET OR the `Authorization: Bearer <CRON_SECRET>` header
  // that Vercel sends on scheduled cron invocations.
  const secret = process.env.CRON_SECRET
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid ?key=/Bearer required' }, { status: 403 })
  }

  const slug = url.searchParams.get('tenant')?.trim()
  const all = ['1', 'true'].includes(url.searchParams.get('all') || '')

  // Resolve target tenants.
  type T = { id: number | string; slug?: string; name?: string }
  let tenants: T[] = []
  if (slug) {
    const res = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenants = res.docs as T[]
    if (!tenants.length) {
      return Response.json({ error: `tenant '${slug}' not found` }, { status: 404 })
    }
  } else if (all) {
    const res = await payload.find({
      collection: 'tenants',
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    tenants = res.docs as T[]
  } else {
    return Response.json({ error: 'pass ?tenant=<slug> or ?all=1' }, { status: 400 })
  }

  const results: Array<Record<string, unknown>> = []
  for (const t of tenants) {
    try {
      const r = await ensureTenantSpaces(payload, t.id)
      results.push({ tenant: t.slug || t.id, ...r })
    } catch (e) {
      results.push({ tenant: t.slug || t.id, error: e instanceof Error ? e.message : 'failed' })
    }
  }

  return Response.json({ ok: true, healed: results.length, results })
}
