import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnsure = vi.fn().mockResolvedValue({})
vi.mock('@/utilities/ensureBaselineMemberships', () => ({ ensureBaselineMemberships: mockEnsure }))

import { baselineMemberships } from '@/collections/Users/hooks/baselineMemberships'

const run = (doc: Record<string, unknown>, operation: 'create' | 'update') =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (baselineMemberships as any)({ doc, operation, req: { payload: {} } })

describe('baselineMemberships hook', () => {
  beforeEach(() => mockEnsure.mockClear())

  it('runs for a new human user', async () => {
    await run({ id: 1, email: 'a@b.c', name: 'A' }, 'create')
    expect(mockEnsure).toHaveBeenCalledOnce()
  })

  it('skips system users — a tenant LEO must not get its own guardian portal', async () => {
    await run({ id: 2, email: 'leo@x', isSystemUser: true }, 'create')
    expect(mockEnsure).not.toHaveBeenCalled()
  })

  it('skips updates — no re-provision on every user save', async () => {
    await run({ id: 3, email: 'a@b.c' }, 'update')
    expect(mockEnsure).not.toHaveBeenCalled()
  })
})
