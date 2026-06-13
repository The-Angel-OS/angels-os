/**
 * workAttribution — Unit Tests
 *
 * Resolves a Work's attribution (endeavor + creditedTo author) as:
 *   runtime Setting-bag override  ??  manifest canonical default.
 * Manifest stays the version-controlled source of truth; the bag lets an admin
 * reconfigure attribution at runtime via the Works control panel (no redeploy).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/SettingService', () => ({ getSettings: vi.fn(), setSetting: vi.fn() }))
vi.mock('@/souls', () => ({
  getSoul: vi.fn((id: string) =>
    id === 'wdeg'
      ? { id: 'wdeg', title: 'WDEG', canonical: { endeavor: 'wheredideveryonego', creditedTo: 'billthecat1022@gmail.com' } }
      : id === 'orphan'
        ? { id: 'orphan', title: 'Orphan' } // no canonical
        : null,
  ),
}))

import { resolveWorkAttribution, setWorkAttribution, WORK_ENTITY } from '@/utilities/workAttribution'
import { getSettings, setSetting } from '@/services/SettingService'

const mockGetSettings = vi.mocked(getSettings)
const mockSet = vi.mocked(setSetting)
const payload = {} as any

describe('workAttribution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({}) // no overrides by default
  })

  it('returns the manifest default when there is no override', async () => {
    const a = await resolveWorkAttribution(payload, 'wdeg', { tenantId: 1 })
    expect(a).toEqual({ workId: 'wdeg', endeavor: 'wheredideveryonego', creditedTo: 'billthecat1022@gmail.com', source: 'manifest' })
  })

  it('lets a Setting-bag override win over the manifest', async () => {
    mockGetSettings.mockResolvedValue({ creditedTo: 'someone-else@example.com', endeavor: 'clearwater-cruisin' })
    const a = (await resolveWorkAttribution(payload, 'wdeg', { tenantId: 1 }))!
    expect(a.creditedTo).toBe('someone-else@example.com')
    expect(a.endeavor).toBe('clearwater-cruisin')
    expect(a.source).toBe('override')
  })

  it('merges a partial override onto the manifest default', async () => {
    mockGetSettings.mockResolvedValue({ creditedTo: 'new@example.com' }) // endeavor not overridden
    const a = (await resolveWorkAttribution(payload, 'wdeg', { tenantId: 1 }))!
    expect(a.creditedTo).toBe('new@example.com')
    expect(a.endeavor).toBe('wheredideveryonego') // falls back to manifest
  })

  it('returns null for an unknown work', async () => {
    expect(await resolveWorkAttribution(payload, 'nope', { tenantId: 1 })).toBeNull()
  })

  it('handles a work with no canonical block', async () => {
    const a = await resolveWorkAttribution(payload, 'orphan', { tenantId: 1 })
    expect(a).toEqual({ workId: 'orphan', endeavor: undefined, creditedTo: undefined, source: 'manifest' })
  })

  it('writes an override through the bag, scoped to the work + tenant', async () => {
    await setWorkAttribution(payload, 'wdeg', { creditedTo: 'x@y.com' }, { tenantId: 1 })
    const [, scope, name, value] = mockSet.mock.calls[0]
    expect(scope).toMatchObject({ entityName: WORK_ENTITY, entityId: 'wdeg', tenantId: 1 })
    expect(name).toBe('creditedTo')
    expect(value).toBe('x@y.com')
  })
})
