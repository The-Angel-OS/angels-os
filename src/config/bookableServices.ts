/**
 * Bookable service catalog.
 *
 * The set of services a tenant offers as time-slot bookings (as opposed to shop
 * products). Each service drives the /book flow: its duration shapes the slot
 * grid, its price + depositPercent drive the deposit charged to reserve, and the
 * balance is settled on completion.
 *
 * This is a code-level seed keyed by tenant slug — deliberately migration-free
 * for v1. Promote to an admin-editable collection (with a migration) when more
 * tenants need to manage their own catalogs.
 */

export interface BookableService {
  /** Stable id used in the booking flow + stored on the booking metadata. */
  id: string
  label: string
  description: string
  /** Maps to Bookings.bookingType. */
  bookingType: 'service' | 'consultation' | 'rental' | 'class' | 'event' | 'custom'
  /** Total price of the service, in USD (FIXED pricing model). */
  priceUSD: number
  /** Percentage charged up front to reserve the slot (balance due on completion). */
  depositPercent: number
  /**
   * Fixed deposit in USD, credited against the final invoice. Wins over
   * depositPercent when set. A trade that quotes on site has no priceUSD, so a
   * percentage deposit always computes to zero and the job could never hold a
   * slot with money down.
   */
  depositFlatUsd?: number
  /** How long the booking occupies the provider's calendar, in minutes. */
  durationMinutes: number
  // ── Pricing model (optional; static seed is all 'fixed') ──
  /** 'fixed' (priceUSD), 'hourly' (hourlyRateUSD), or 'per_unit' (unitRateUSD/unitLabel). */
  pricingModel?: 'fixed' | 'hourly' | 'per_unit'
  /** HOURLY: rate per hour; only time on the clock is billed. */
  hourlyRateUSD?: number
  billingIncrementMinutes?: number
  minimumMinutes?: number
  /** PER-UNIT: e.g. 'sq ft' @ unitRateUSD. */
  unitLabel?: string
  unitRateUSD?: number
  allowsExtraCosts?: boolean
  /** Optional service image URL — shown on the booking selection card like a product. */
  imageUrl?: string
  /** Optional rental/service agreement terms; when set, the customer must e-sign before the deposit. */
  serviceAgreement?: string
}

const CATALOG: Record<string, BookableService[]> = {
  'clearwater-cruisin': [
    {
      id: 'pressure-washing-driveway',
      label: 'Pressure Washing · Driveway',
      description: 'Driveway / walkway pressure washing.',
      bookingType: 'service',
      priceUSD: 119,
      depositPercent: 20,
      durationMinutes: 90,
    },
    {
      id: 'pressure-washing-house',
      label: 'Pressure Washing · House',
      description: 'Full house exterior soft/pressure wash.',
      bookingType: 'service',
      priceUSD: 249,
      depositPercent: 20,
      durationMinutes: 180,
    },
    {
      id: 'pet-sitting-visit',
      label: 'Pet Sitting Visit',
      description: 'In-home pet sitting / drop-in visit.',
      bookingType: 'service',
      priceUSD: 25,
      depositPercent: 20,
      durationMinutes: 30,
    },
    {
      id: 'soul-van-birthday-roadtrip',
      label: 'Soul Van Birthday Road Trip',
      description:
        'The Soul Van is your ride and your camera crew for the day — ~4 hours driving you and your crew around Florida while we film the whole thing (4K/8K), cut into a keepsake highlight video within the week. No set plan, down for wacky. Great for birthdays.',
      bookingType: 'event',
      priceUSD: 120,
      depositPercent: 20,
      durationMinutes: 240,
    },
  ],
}

export function getBookableServices(tenantSlug: string | undefined | null): BookableService[] {
  if (!tenantSlug) return []
  return CATALOG[tenantSlug] ?? []
}

export function getBookableService(
  tenantSlug: string | undefined | null,
  serviceId: string | undefined | null,
): BookableService | null {
  if (!tenantSlug || !serviceId) return null
  return getBookableServices(tenantSlug).find((s) => s.id === serviceId) ?? null
}

/** Deposit amount in whole cents for a given service. */
export function depositCents(service: BookableService): number {
  if (typeof service.depositFlatUsd === 'number' && service.depositFlatUsd > 0) {
    return Math.round(service.depositFlatUsd * 100)
  }
  return Math.round(service.priceUSD * (service.depositPercent / 100) * 100)
}

/** Total price in whole cents. */
export function totalCents(service: BookableService): number {
  return Math.round(service.priceUSD * 100)
}
