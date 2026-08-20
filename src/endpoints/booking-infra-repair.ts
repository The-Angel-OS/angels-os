/**
 * Booking Infra Repair — GET /api/provision-ops/booking-infra-repair
 *
 * Backfills the two things a service business needs before /book can take a
 * booking: bookable services and hours. Provisioning does both now, but every
 * portal created before that shipped has a booking page that finds a provider,
 * finds no hours, and says "no open times" forever — which the owner discovers
 * by showing it to a customer.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Optional ?tenant=<slug> to scope.
 * Idempotent — never overwrites an owner's edited schedule or services.
 *
 * @see src/utilities/ensureDefaultAvailability.ts  @see src/utilities/seedDemoServices.ts
 */
import type { PayloadHandler } from 'payload'
import { ensureTenantDefaultAvailability } from '@/utilities/ensureDefaultAvailability'
import { logError } from '@/utilities/logError'

export const bookingInfraRepairHandler: PayloadHandler = async (req) => {
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

  const tenantSlug = url.searchParams.get('tenant')

  try {
    const tenantsRes = await payload.find({
      collection: 'tenants',
      where: tenantSlug ? { slug: { equals: tenantSlug } } : {},
      limit: tenantSlug ? 1 : 1000,
      depth: 0,
      overrideAccess: true,
    })
    const tenants = tenantsRes.docs as Array<{ id: number | string; slug?: string }>
    if (tenants.length === 0) {
      return Response.json(
        { error: tenantSlug ? `No tenant "${tenantSlug}"` : 'No tenants' },
        { status: 404 },
      )
    }

    const results: Array<Record<string, unknown>> = []
    for (const t of tenants) {
      try {
        // Only tenants that actually sell something bookable. Creating hours for a
        // blog or a ministry would put a working booking page on a site whose
        // owner never asked for one.
        const services = await payload.find({
          collection: 'services',
          where: { and: [{ tenant: { equals: t.id } }, { enabled: { equals: true } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (!services.docs?.length) {
          results.push({ tenant: t.slug || t.id, skipped: 'no bookable services' })
          continue
        }

        const avail = await ensureTenantDefaultAvailability(payload, t.id)
        results.push({
          tenant: t.slug || t.id,
          services: services.totalDocs,
          hoursCreated: avail.created,
          note: avail.note,
        })
      } catch (e) {
        results.push({
          tenant: t.slug || t.id,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }

    const changed = results.filter((r) => Number(r.hoursCreated || 0) > 0)
    return Response.json({
      ok: true,
      tenantsScanned: results.length,
      tenantsChanged: changed.length,
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await logError({
      source: 'provision-ops/booking-infra-repair',
      message: msg,
      details: e instanceof Error ? e.stack : undefined,
      statusCode: 500,
    })
    return Response.json({ error: msg }, { status: 500 })
  }
}
