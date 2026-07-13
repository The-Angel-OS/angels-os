/**
 * ensureTenantDefaults — guarantees all three system spaces exist.
 * We mock the three underlying ensures to verify all are called and
 * errors from one don't abort the others.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the three space utilities before importing the module under test.
vi.mock('@/utilities/ensureSystemSpace', () => ({
  ensureSystemSpace: vi.fn(async () => 'ai-bus-id'),
  ensureDMSpace: vi.fn(async () => 'dm-id'),
}))
vi.mock('@/utilities/ensureMainSpace', () => ({
  ensureMainSpace: vi.fn(async () => ({ spaceId: 'main-id', channelIds: [], created: false })),
}))

import { ensureTenantDefaults } from '@/utilities/ensureTenantDefaults'
import { ensureSystemSpace, ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { ensureMainSpace } from '@/utilities/ensureMainSpace'

const fakePayload = {} as any

describe('ensureTenantDefaults', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls all three ensures and returns their space IDs', async () => {
    const r = await ensureTenantDefaults(fakePayload, 42)
    expect(ensureSystemSpace).toHaveBeenCalledWith(42)
    // req threads through as the 5th arg (undefined here — no HTTP req in this test).
    expect(ensureMainSpace).toHaveBeenCalledWith(fakePayload, 42, undefined, undefined, undefined)
    expect(ensureDMSpace).toHaveBeenCalledWith(42)
    expect(r.aiBusSpaceId).toBe('ai-bus-id')
    expect(r.mainSpaceId).toBe('main-id')
    expect(r.dmSpaceId).toBe('dm-id')
    expect(r.errors).toEqual([])
  })

  it('continues and collects errors when one ensure fails', async () => {
    vi.mocked(ensureSystemSpace).mockRejectedValueOnce(new Error('DB timeout'))
    const r = await ensureTenantDefaults(fakePayload, 7)
    expect(r.aiBusSpaceId).toBeUndefined()
    expect(r.mainSpaceId).toBe('main-id') // still ran
    expect(r.dmSpaceId).toBe('dm-id')     // still ran
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toContain('DB timeout')
  })

  it('is idempotent — calling twice does not throw', async () => {
    await ensureTenantDefaults(fakePayload, 1)
    await expect(ensureTenantDefaults(fakePayload, 1)).resolves.not.toThrow()
  })
})
