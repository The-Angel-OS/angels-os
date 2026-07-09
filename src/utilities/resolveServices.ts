/**
 * resolveServices — DB-first bookable-service resolution with static fallback.
 *
 * Reads the `services` collection for a tenant; when empty (not yet migrated),
 * falls back to the static `bookableServices` seed so the promotion to a DB
 * collection is non-breaking. Returns the same `BookableService` shape the
 * booking flow already consumes, so callers adopt it by awaiting one function.
 *
 * @see src/collections/Services  @see src/config/bookableServices.ts
 */
import type { Payload } from 'payload'
import { getBookableServices, type BookableService } from '@/config/bookableServices'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBookableService(doc: any): BookableService {
  return {
    id: String(doc.serviceId),
    label: doc.label,
    description: doc.description ?? '',
    bookingType: doc.bookingType ?? 'service',
    priceUSD: Number(doc.priceUsd ?? 0),
    depositPercent: Number(doc.depositPercent ?? 0),
    durationMinutes: Number(doc.durationMinutes ?? 0),
    pricingModel: doc.pricingModel ?? 'fixed',
    hourlyRateUSD: doc.hourlyRateUsd != null ? Number(doc.hourlyRateUsd) : undefined,
    billingIncrementMinutes: doc.billingIncrementMinutes != null ? Number(doc.billingIncrementMinutes) : undefined,
    minimumMinutes: doc.minimumMinutes != null ? Number(doc.minimumMinutes) : undefined,
    unitLabel: doc.unitLabel ?? undefined,
    unitRateUSD: doc.unitRateUsd != null ? Number(doc.unitRateUsd) : undefined,
    allowsExtraCosts: doc.allowsExtraCosts ?? undefined,
    serviceAgreement: doc.serviceAgreement ?? undefined,
    // image is a media relationship — populated at depth 1 (see the find below).
    imageUrl: doc.image && typeof doc.image === 'object' ? (doc.image.url ?? undefined) : undefined,
  }
}

async function tenantIdFromSlug(payload: Payload, slug: string): Promise<number | string | null> {
  const res = await payload.find({
    collection: 'tenants' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true,
  })
  return (res.docs?.[0]?.id as number | string) ?? null
}

export async function resolveServices(
  payload: Payload,
  opts: { tenantSlug?: string | null; tenantId?: number | string | null },
): Promise<BookableService[]> {
  let tenantId = opts.tenantId ?? null
  if (tenantId == null && opts.tenantSlug) {
    try { tenantId = await tenantIdFromSlug(payload, opts.tenantSlug) } catch { /* fall through */ }
  }

  if (tenantId != null) {
    try {
      const res = await payload.find({
        collection: 'services' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        where: { and: [{ tenant: { equals: tenantId } }, { enabled: { equals: true } }] },
        limit: 100, depth: 1, overrideAccess: true, sort: 'label', // depth 1 → populate the image media

      })
      if (res.totalDocs > 0) return (res.docs as any[]).map(toBookableService) // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch {
      /* table missing / query failed — fall back to the static seed */
    }
  }

  return opts.tenantSlug ? getBookableServices(opts.tenantSlug) : []
}

/**
 * Import the static seed catalog into the `services` collection for a tenant.
 * Idempotent (find-or-create by tenant + serviceId). Used by the seed/migration
 * step so the configurator starts populated.
 */
export async function seedServicesFromStatic(
  payload: Payload,
  tenantSlug: string,
  tenantId: number | string,
): Promise<{ created: number; existing: number }> {
  const seed = getBookableServices(tenantSlug)
  let created = 0
  let existing = 0
  for (const s of seed) {
    const found = await payload.find({
      collection: 'services' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      where: { and: [{ tenant: { equals: tenantId } }, { serviceId: { equals: s.id } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (found.totalDocs > 0) { existing++; continue }
    await payload.create({
      collection: 'services' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      data: {
        tenant: tenantId, serviceId: s.id, label: s.label, description: s.description,
        bookingType: s.bookingType, priceUsd: s.priceUSD, depositPercent: s.depositPercent,
        durationMinutes: s.durationMinutes, enabled: true,
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      overrideAccess: true,
    })
    created++
  }
  return { created, existing }
}
