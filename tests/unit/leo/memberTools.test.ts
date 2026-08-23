/**
 * The two member tools that can do something irreversible: posting into a
 * channel, and signing someone up twice.
 *
 * @see src/utilities/leoMemberTools.ts
 */
import { describe, it, expect, vi } from 'vitest'
import { handleAskTheRoom, handleRegisterForEvent } from '@/utilities/leoMemberTools'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const payloadWith = (over: Record<string, any> = {}) =>
  ({
    find: vi.fn(async () => ({ docs: [] })),
    create: vi.fn(async () => ({ id: 1 })),
    update: vi.fn(async () => ({ id: 1 })),
    count: vi.fn(async () => ({ totalDocs: 0 })),
    findByID: vi.fn(async () => ({ id: 7, name: 'Sam', email: 'sam@example.com' })),
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

describe('ask_the_room is gated', () => {
  it('posts NOTHING without confirm, and says so', async () => {
    const payload = payloadWith()
    const out = await handleAskTheRoom(
      payload,
      { question: 'When does the hall open?' },
      { payload, tenantId: 5, spaceId: 6, userId: 7 },
    )
    expect(payload.create).not.toHaveBeenCalled()
    expect(out).toContain('NOT POSTED YET')
    expect(out).toContain('When does the hall open?')
  })

  it('posts as the USER once confirmed — never as LEO', async () => {
    const payload = payloadWith()
    await handleAskTheRoom(
      payload,
      { question: 'When does the hall open?', channel: 'general', confirm: true },
      { payload, tenantId: 5, spaceId: 6, userId: 7 },
    )
    expect(payload.create).toHaveBeenCalledTimes(1)
    const arg = payload.create.mock.calls[0]![0]
    expect(arg.collection).toBe('messages')
    expect(arg.data.author).toBe(7)
    expect(arg.data.messageType).toBe('user')
    expect(arg.data.channel).toBe('general')
  })

  it('refuses when nobody is signed in', async () => {
    const payload = payloadWith()
    const out = await handleAskTheRoom(payload, { question: 'hi', confirm: true }, { payload, tenantId: 5 })
    expect(payload.create).not.toHaveBeenCalled()
    expect(out).toContain('signed in')
  })
})

describe('register_for_event', () => {
  const event = { id: 3, title: 'Potluck', slug: 'potluck', status: 'upcoming', startDateTime: '2099-01-01T18:00:00Z', capacity: 0 }

  it('does not double-register — it reports what already exists', async () => {
    const payload = payloadWith({
      find: vi.fn(async ({ collection }: { collection: string }) =>
        collection === 'events'
          ? { docs: [event] }
          : { docs: [{ id: 99, status: 'registered' }] },
      ),
    })
    const out = await handleRegisterForEvent(payload, { event: 'potluck' }, { payload, tenantId: 5, userId: 7 })
    expect(payload.create).not.toHaveBeenCalled()
    expect(out).toContain('Already registered')
  })

  it('waitlists rather than overfilling a capped event', async () => {
    const payload = payloadWith({
      find: vi.fn(async ({ collection }: { collection: string }) =>
        collection === 'events' ? { docs: [{ ...event, capacity: 2 }] } : { docs: [] },
      ),
      count: vi.fn(async () => ({ totalDocs: 2 })),
    })
    const out = await handleRegisterForEvent(payload, { event: 'potluck' }, { payload, tenantId: 5, userId: 7 })
    expect(payload.create).toHaveBeenCalledTimes(1)
    expect(payload.create.mock.calls[0]![0].data.status).toBe('waitlisted')
    expect(out).toContain('WAITLIST')
  })

  it('asks which one when the title matches several', async () => {
    const payload = payloadWith({
      find: vi.fn(async () => ({ docs: [event, { ...event, id: 4, title: 'Potluck (kids)' }] })),
    })
    const out = await handleRegisterForEvent(payload, { event: 'Potluck' }, { payload, tenantId: 5, userId: 7 })
    expect(payload.create).not.toHaveBeenCalled()
    expect(out).toContain('more than one')
  })
})
