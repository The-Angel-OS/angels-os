/**
 * notifyUserRegistered — Users afterChange escalation (fires on real new users only).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utilities/gotifyEscalation', () => ({
  dispatchToGotify: vi.fn().mockResolvedValue({ matched: 0, sent: 0, suppressed: 0, failed: 0 }),
}))

import { notifyUserRegistered } from '@/collections/Users/hooks/notifyUserRegistered'
import { dispatchToGotify } from '@/utilities/gotifyEscalation'

const run = (doc: Record<string, unknown>, operation: 'create' | 'update' = 'create') =>
  (notifyUserRegistered as unknown as (a: unknown) => Promise<unknown>)({
    doc,
    operation,
    req: { payload: {} },
  })

describe('notifyUserRegistered', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dispatches user_registered on create with name, roles, tenant', async () => {
    await run({ id: 42, name: 'Ada', email: 'ada@x.com', roles: ['customer'], tenant: { id: 5 } })
    expect(dispatchToGotify).toHaveBeenCalledTimes(1)
    const [, event] = (dispatchToGotify as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(event).toMatchObject({ tenantId: 5, eventType: 'user_registered', dedupeKey: '42' })
    expect(event.message).toContain('Ada')
    expect(event.message).toContain('customer')
  })

  it('accepts an id-only tenant ref', async () => {
    await run({ id: 7, email: 'b@x.com', tenant: 9 })
    expect((dispatchToGotify as ReturnType<typeof vi.fn>).mock.calls[0][1].tenantId).toBe(9)
  })

  it('skips updates', async () => {
    await run({ id: 1, email: 'a@x.com', tenant: 5 }, 'update')
    expect(dispatchToGotify).not.toHaveBeenCalled()
  })

  it('skips system users', async () => {
    await run({ id: 1, email: 'leo@x.com', tenant: 5, isSystemUser: true })
    expect(dispatchToGotify).not.toHaveBeenCalled()
  })

  it('skips synthetic guest accounts', async () => {
    await run({ id: 1, email: 'whatsapp-155@guests.angel-os.local', tenant: 5 })
    expect(dispatchToGotify).not.toHaveBeenCalled()
  })

  it('skips when no tenant', async () => {
    await run({ id: 1, email: 'a@x.com' })
    expect(dispatchToGotify).not.toHaveBeenCalled()
  })

  it('never throws if dispatch fails', async () => {
    ;(dispatchToGotify as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    await expect(run({ id: 1, email: 'a@x.com', tenant: 5 })).resolves.toBeDefined()
  })
})
