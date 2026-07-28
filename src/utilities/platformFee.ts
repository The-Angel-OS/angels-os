/**
 * The platform's cut — as DATA, not a constant in a webhook.
 *
 * Two incompatible economic models had accumulated in the codebase:
 *   • ULTIMATE_FAIR_SPLIT declares 60/20/15/5 — a 40% platform take.
 *   • The Stripe webhook only ever RECORDS the 5% Justice Fund slice.
 * The 40% was never applied, but it sat in the source as a stated intention.
 * 40% of an electrician's panel upgrade would end that relationship in one
 * invoice; 5% of money the platform actually helped move is defensible out loud.
 *
 * So the applied rate lives here, in basis points, changeable at runtime. You
 * cannot run a pricing experiment against a hardcoded 0.05, and the day the rate
 * needs to differ (a launch partner, a nonprofit, a vertical that can't bear 5%)
 * a code deploy is the wrong mechanism.
 *
 * Basis points, not a float: 250 bps is exactly 2.5% and stays exact through
 * integer math, so a fee can never drift a cent from rounding.
 *
 * Scoped to the PLATFORM tenant — this is one number for the whole node, not a
 * per-tenant setting. A per-tenant override is a deliberate future decision, not
 * something to fall into by accident.
 */
import type { Payload } from 'payload'
import { getJsonSetting, setJsonSetting } from '@/services/SettingService'

const ENTITY = 'platform-fee'
const ENTITY_ID = 'fee'
const SETTING = 'basisPoints'

/** 5% — what the webhook recorded before this was configurable. */
export const DEFAULT_PLATFORM_FEE_BPS = 500
/** Refuse anything above this without a code change: a guard against a fat finger. */
export const MAX_PLATFORM_FEE_BPS = 2000

async function platformTenantId(payload: Payload): Promise<number | undefined> {
  const r = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: process.env.DEFAULT_TENANT_SLUG || 'platform' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const t = r.docs?.[0] as { id?: number } | undefined
  return t?.id != null ? Number(t.id) : undefined
}

export function normalizeFeeBps(raw: unknown): number {
  // ABSENT is not ZERO. Number(null) and Number('') are both 0, so a null in the
  // settings bag would have set the fee to 0% and run the platform free forever
  // with nothing to notice. Only an explicit number means free.
  if (raw == null || raw === '') return DEFAULT_PLATFORM_FEE_BPS
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_PLATFORM_FEE_BPS
  return Math.min(Math.round(n), MAX_PLATFORM_FEE_BPS)
}

/**
 * The applied rate in basis points. Falls back to the default, never to zero.
 *
 * Pass `forTenantId` to honour a PER-TENANT override. This was called out in the
 * header as "a deliberate future decision, not something to fall into" — this is
 * that decision, made for a concrete reason rather than a hypothetical one:
 *
 * Kenneth's arrangement with Kessela is 10% of everything sold, and he is the
 * platform, so his cut and the platform fee are one pocket. Collecting it as
 * `application_fee_amount` means Stripe deducts it at checkout and the money
 * arrives without an invoice or a monthly conversation. But the node-wide rate
 * cannot express "10% here, 5% everywhere else" — raising it would silently
 * charge Clearwater and every other tenant 10% as well.
 *
 * Resolution is deliberately narrow: a tenant override if one exists, otherwise
 * the node rate, otherwise the default. An override is never inherited and never
 * partially applied.
 */
export async function getPlatformFeeBps(
  payload: Payload,
  forTenantId?: number | string | null,
): Promise<number> {
  try {
    if (forTenantId != null) {
      const own = await getJsonSetting<number>(
        payload,
        { entityName: ENTITY, entityId: ENTITY_ID, tenantId: Number(forTenantId) },
        SETTING,
      )
      // Only an explicitly stored value counts. Absent means "no opinion, use the
      // node rate" — NOT zero, or a tenant with no row would ride free.
      if (own != null) return normalizeFeeBps(own)
    }

    const tenantId = await platformTenantId(payload)
    const raw = await getJsonSetting<number>(
      payload,
      { entityName: ENTITY, entityId: ENTITY_ID, tenantId },
      SETTING,
    )
    // Unset is different from zero: a node that has never configured a fee
    // should charge the default, not silently run free forever.
    return raw == null ? DEFAULT_PLATFORM_FEE_BPS : normalizeFeeBps(raw)
  } catch {
    return DEFAULT_PLATFORM_FEE_BPS
  }
}

/**
 * Store a per-tenant override. Pass `null` to remove it and fall back to the
 * node rate — which is why this cannot simply write 0.
 */
export async function setTenantPlatformFeeBps(
  payload: Payload,
  tenantId: number | string,
  bps: number | null,
): Promise<number | null> {
  const value = bps == null ? null : normalizeFeeBps(bps)
  await setJsonSetting(
    payload,
    { entityName: ENTITY, entityId: ENTITY_ID, tenantId: Number(tenantId) },
    SETTING,
    value,
  )
  return value
}

export async function setPlatformFeeBps(payload: Payload, bps: number): Promise<number> {
  const value = normalizeFeeBps(bps)
  const tenantId = await platformTenantId(payload)
  if (tenantId == null) throw new Error('platform tenant not found — cannot store the fee')
  await setJsonSetting(payload, { entityName: ENTITY, entityId: ENTITY_ID, tenantId }, SETTING, value)
  return value
}

/** Fee on a gross charge, in whole cents. Integer math throughout. */
export function feeCents(grossCents: number, bps: number): number {
  if (!Number.isFinite(grossCents) || grossCents <= 0) return 0
  return Math.round((grossCents * normalizeFeeBps(bps)) / 10000)
}

export const bpsToPercent = (bps: number): string => (normalizeFeeBps(bps) / 100).toFixed(2)
