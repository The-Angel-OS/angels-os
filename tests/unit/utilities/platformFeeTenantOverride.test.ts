import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  getPlatformFeeBps,
  feeCents,
  normalizeFeeBps,
  DEFAULT_PLATFORM_FEE_BPS,
  MAX_PLATFORM_FEE_BPS,
  MAX_PLATFORM_FEE_CENTS,
} from '@/utilities/platformFee'

/**
 * The per-tenant override exists so one node can charge 10% on Kessela (where
 * Kenneth's commission and the platform fee are the same pocket) and 5%
 * everywhere else, without a deploy and without touching Clearwater.
 *
 * These assert INVARIANTS, not the current numbers — the rate is data and is
 * meant to change. A test that pinned "500" would be wrong the first time
 * someone used the feature it is guarding.
 */

const settings = new Map<string, unknown>()
const key = (tenantId: unknown) => `t:${tenantId}`

vi.mock('@/services/SettingService', () => ({
  getJsonSetting: vi.fn(async (_p: unknown, scope: { tenantId?: number }) =>
    settings.has(key(scope?.tenantId)) ? settings.get(key(scope?.tenantId)) : null,
  ),
  setJsonSetting: vi.fn(async (_p: unknown, scope: { tenantId?: number }, _s: string, v: unknown) => {
    settings.set(key(scope?.tenantId), v)
  }),
}))

const PLATFORM_TENANT = 1
const KESSELA = 30
const CLEARWATER = 5

const payload = {
  find: async () => ({ docs: [{ id: PLATFORM_TENANT }] }),
} as never

beforeEach(() => settings.clear())

describe('getPlatformFeeBps — per-tenant override', () => {
  it('falls back to the node rate when a tenant has no override', async () => {
    settings.set(key(PLATFORM_TENANT), 500)
    await expect(getPlatformFeeBps(payload, CLEARWATER)).resolves.toBe(500)
  })

  it('honours a tenant override without touching other tenants', async () => {
    settings.set(key(PLATFORM_TENANT), 500)
    settings.set(key(KESSELA), 1000)

    await expect(getPlatformFeeBps(payload, KESSELA)).resolves.toBe(1000)
    // The whole point: one tenant's negotiated rate must not leak to the others.
    await expect(getPlatformFeeBps(payload, CLEARWATER)).resolves.toBe(500)
    await expect(getPlatformFeeBps(payload)).resolves.toBe(500)
  })

  it('treats an ABSENT override as "no opinion", never as free', async () => {
    settings.set(key(PLATFORM_TENANT), 500)
    // No row for Kessela at all — must not resolve to 0.
    const bps = await getPlatformFeeBps(payload, KESSELA)
    expect(bps).toBe(500)
    expect(bps).not.toBe(0)
  })

  it('allows an EXPLICIT zero — a genuinely free tenant is a real decision', async () => {
    settings.set(key(PLATFORM_TENANT), 500)
    settings.set(key(KESSELA), 0)
    await expect(getPlatformFeeBps(payload, KESSELA)).resolves.toBe(0)
  })

  it('never exceeds the guard rail, however the value got stored', async () => {
    settings.set(key(KESSELA), 99_999)
    await expect(getPlatformFeeBps(payload, KESSELA)).resolves.toBe(MAX_PLATFORM_FEE_BPS)
  })

  it('falls back to the default when everything is unset', async () => {
    await expect(getPlatformFeeBps(payload, KESSELA)).resolves.toBe(DEFAULT_PLATFORM_FEE_BPS)
  })
})

describe('feeCents — the invariant that would have caught the 40% fee', () => {
  it('is exactly the basis-point share of the gross, rounded to a cent, up to the cap', () => {
    for (const gross of [1, 99, 7500, 59900, 123_456]) {
      for (const bps of [0, 250, 500, 1000, 2000]) {
        const uncapped = Math.round((gross * bps) / 10000)
        expect(feeCents(gross, bps)).toBe(Math.min(uncapped, MAX_PLATFORM_FEE_CENTS))
      }
    }
  })

  it('never takes more than $9.99 from one booking', () => {
    // A mover's $600 job at 5% is $30 — the number a one-van operation notices
    // every time and does arithmetic on before deciding whether to keep us.
    expect(feeCents(60_000, 500)).toBe(MAX_PLATFORM_FEE_CENTS)
    // The $599 belt: $59.90 uncapped, $9.99 with the ceiling.
    expect(feeCents(59_900, 1000)).toBe(MAX_PLATFORM_FEE_CENTS)
  })

  it('still charges the honest percentage below the cap', () => {
    expect(feeCents(10_000, 500)).toBe(500) // $100 job -> $5.00
    expect(feeCents(4_000, 500)).toBe(200) // $40 job  -> $2.00
    // The cap binds from roughly $200 of charge upward.
    expect(feeCents(19_980, 500)).toBe(999)
  })

  it('is zero for a non-positive gross rather than NaN', () => {
    expect(feeCents(0, 1000)).toBe(0)
    expect(feeCents(-100, 1000)).toBe(0)
    expect(feeCents(Number.NaN, 1000)).toBe(0)
  })

  it('normalizes junk to the default instead of to zero', () => {
    // Number(null) and Number('') are both 0 — that is how a platform runs free
    // forever with nothing to notice.
    expect(normalizeFeeBps(null)).toBe(DEFAULT_PLATFORM_FEE_BPS)
    expect(normalizeFeeBps('')).toBe(DEFAULT_PLATFORM_FEE_BPS)
    expect(normalizeFeeBps('nonsense')).toBe(DEFAULT_PLATFORM_FEE_BPS)
    expect(normalizeFeeBps(-1)).toBe(DEFAULT_PLATFORM_FEE_BPS)
    expect(normalizeFeeBps(0)).toBe(0)
  })
})
