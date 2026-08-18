/**
 * seedDemoServices — turn a trade pack's service list into real bookable rows.
 *
 * demo-site wrote the services into PAGE COPY only, so a prospect saw "Residential
 * Cleaning / Commercial & Offices" on /services and then found nothing to book:
 * `resolveServices` reads the `services` collection, and with no rows it fell
 * through to the static seed, which is a pressure-washing catalog belonging to a
 * different business. The booking engine was never broken — it had nothing of
 * theirs to offer.
 *
 * Deliberately no prices. We do not know what a stranger charges, and a wrong
 * number on their own website is worse than an honest "quoted before any work
 * starts" — which is what every trade pack's copy already promises. A flat
 * deposit holds the slot instead, which is the one number that does not depend on
 * knowing the job (see Services.depositFlatUsd).
 *
 * Idempotent on (tenant, serviceId): re-running a demo site does not duplicate
 * the catalog, and never overwrites a price an owner has since set by hand.
 *
 * @see src/collections/Services  @see src/utilities/resolveServices.ts
 */
import type { Payload, PayloadRequest } from 'payload'
import type { TradePack } from './demoSiteTemplates'

/** Service name → stable id. Must stay stable: bookings store it. */
export function serviceIdFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export interface SeedDemoServicesResult {
  created: number
  skipped: number
}

export async function seedDemoServices(
  payload: Payload,
  tenantId: number | string,
  pack: TradePack,
  req?: PayloadRequest,
): Promise<SeedDemoServicesResult> {
  let created = 0
  let skipped = 0

  for (const svc of pack.services) {
    const serviceId = serviceIdFromName(svc.name)

    const existing = await payload.find({
      collection: 'services',
      where: { and: [{ tenant: { equals: tenantId } }, { serviceId: { equals: serviceId } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs?.length) {
      skipped++
      continue
    }

    await payload.create({
      collection: 'services',
      data: {
        tenant: tenantId,
        serviceId,
        label: svc.name,
        description: svc.blurb,
        bookingType: 'service',
        // Quote-first. `fixed` with a zero price would advertise "free" on their
        // booking page; hourly with a made-up rate would misquote them to a real
        // customer. Both are worse than asking.
        pricingModel: 'fixed',
        allowsExtraCosts: true,
        // A percentage of an unknown total is always zero, so a quote-only
        // service could never hold a slot with a deposit. A flat $25 can.
        depositFlatUsd: 25,
        durationMinutes: 60,
        enabled: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
      req,
    })
    created++
  }

  return { created, skipped }
}
