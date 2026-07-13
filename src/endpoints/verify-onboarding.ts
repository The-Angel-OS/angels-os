/**
 * Verify Endeavor Onboarding — GET /api/provision-ops/verify-onboarding
 *
 * Runs the idempotent onboarding invariant check (verifyEndeavorOnboarding):
 * ensures AI Bus + Main + DM spaces, re-homes page-comment channels onto the
 * AI Bus, and backfills space-memberships for every active tenant member.
 *
 * super_admin or ?key=CRON_SECRET.
 *   ?tenant=<slug>  heal one tenant
 *   ?all=1          heal every tenant
 */
import type { PayloadHandler } from 'payload'
import { verifyEndeavorOnboarding } from '@/utilities/verifyEndeavorOnboarding'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'

export const verifyOnboardingHandler: PayloadHandler = async (req) => {
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

  const slug = url.searchParams.get('tenant')?.trim()
  const all = ['1', 'true'].includes(url.searchParams.get('all') || '')

  let tenantIds: Array<number | string> = []
  if (slug) {
    const t = await fetchTenantBySlug(slug)
    if (!t) return Response.json({ error: `tenant '${slug}' not found` }, { status: 404 })
    tenantIds = [t.id]
  } else if (all) {
    const res = await payload.find({ collection: 'tenants', limit: 500, depth: 0, overrideAccess: true })
    tenantIds = (res.docs as { id: number | string }[]).map((t) => t.id)
  } else {
    return Response.json({ error: 'pass ?tenant=<slug> or ?all=1' }, { status: 400 })
  }

  const reports = []
  for (const tenantId of tenantIds) {
    reports.push(await verifyEndeavorOnboarding(payload, tenantId, req))
  }

  const ok = reports.every((r) => r.errors.length === 0)
  return Response.json({ ok, reports })
}
