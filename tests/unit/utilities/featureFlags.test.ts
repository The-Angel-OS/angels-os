/**
 * featureFlags — Unit Tests
 *
 * Thin typed feature-flag layer over the generic SettingService bag. Flags are
 * tenant-scoped (entityName 'feature-flags'); absence falls back to the code
 * default. This is the wiring of the Oqtane Setting bag's first real consumer —
 * config that must NOT become a schema column lives here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/SettingService', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}))

import { getFlag, getBoolFlag, getJsonFlag, setFlag, FLAG_ENTITY } from '@/utilities/featureFlags'
import { getSetting, setSetting } from '@/services/SettingService'

const mockGet = vi.mocked(getSetting)
const mockSet = vi.mocked(setSetting)
const payload = {} as any

describe('featureFlags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the tenant-scoped value when set', async () => {
    mockGet.mockResolvedValue('bypass')
    const v = await getFlag(payload, 'payments.mode', { tenantId: 5, defaultValue: 'live' })
    expect(v).toBe('bypass')
    // reads from the feature-flags bag, scoped to the tenant
    const [, scope, name] = mockGet.mock.calls[0]
    expect(scope).toMatchObject({ entityName: FLAG_ENTITY, tenantId: 5 })
    expect(name).toBe('payments.mode')
  })

  it('falls back to the code default when the flag is unset', async () => {
    mockGet.mockResolvedValue(undefined)
    const v = await getFlag(payload, 'payments.mode', { tenantId: 5, defaultValue: 'live' })
    expect(v).toBe('live')
  })

  it('falls back to default when no tenantId is given (no global read without scope)', async () => {
    const v = await getFlag(payload, 'payments.mode', { defaultValue: 'live' })
    expect(v).toBe('live')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('coerces booleans', async () => {
    mockGet.mockResolvedValueOnce('true')
    expect(await getBoolFlag(payload, 'feature.x', { tenantId: 1 })).toBe(true)
    mockGet.mockResolvedValueOnce('0')
    expect(await getBoolFlag(payload, 'feature.x', { tenantId: 1 })).toBe(false)
    mockGet.mockResolvedValueOnce(undefined)
    expect(await getBoolFlag(payload, 'feature.x', { tenantId: 1, defaultValue: true })).toBe(true)
  })

  it('parses JSON flags with a default on absence', async () => {
    mockGet.mockResolvedValueOnce('{"ramp":0.25}')
    expect(await getJsonFlag(payload, 'rollout', { tenantId: 1 })).toEqual({ ramp: 0.25 })
    mockGet.mockResolvedValueOnce(undefined)
    expect(await getJsonFlag(payload, 'rollout', { tenantId: 1, defaultValue: { ramp: 0 } })).toEqual({ ramp: 0 })
  })

  it('writes a flag through the bag, tenant-scoped', async () => {
    await setFlag(payload, 'payments.mode', 'test', { tenantId: 5 })
    const [, scope, name, value] = mockSet.mock.calls[0]
    expect(scope).toMatchObject({ entityName: FLAG_ENTITY, tenantId: 5 })
    expect(name).toBe('payments.mode')
    expect(value).toBe('test')
  })
})
