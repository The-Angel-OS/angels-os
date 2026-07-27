/**
 * Enrolment and stop-on-purchase.
 *
 * The two failures that matter, in order of cost:
 *   1. Enrolling someone twice → they get every email twice → unsubscribe.
 *   2. Not stopping on purchase → a discount lands in a buyer's inbox after
 *      they paid full price.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enrollInSequences, stopSequencesForContact } from '@/utilities/enrollInSequences'

const SEQ = { id: 9, steps: [{ delayHours: 0 }, { delayHours: 72 }] }

function makePayload(opts: { sequences?: unknown[]; existing?: unknown[]; active?: unknown[] } = {}) {
  const find = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
    if (collection === 'sequences') return Promise.resolve({ docs: opts.sequences ?? [SEQ] })
    return Promise.resolve({ docs: opts.existing ?? opts.active ?? [] })
  })
  return { find, create: vi.fn().mockResolvedValue({ id: 1 }), update: vi.fn().mockResolvedValue({}) } as never
}

const calls = (p: unknown, k: 'create' | 'update' | 'find') =>
  (p as Record<string, { mock: { calls: unknown[][] } }>)[k]!.mock.calls

beforeEach(() => vi.clearAllMocks())

describe('enrollInSequences', () => {
  it('enrols the contact and schedules the first step', async () => {
    const payload = makePayload()
    const n = await enrollInSequences(payload, { tenantId: 42, contactId: 7 })

    expect(n).toBe(1)
    const data = (calls(payload, 'create')[0]![0] as { data: Record<string, unknown> }).data
    expect(data.sequence).toBe(9)
    expect(data.contact).toBe(7)
    expect(data.currentStep).toBe(0)
    expect(data.status).toBe('active')
    expect(data.nextSendAt).toBeTruthy()
  })

  it('only considers ACTIVE sequences with the matching trigger', async () => {
    const payload = makePayload()
    await enrollInSequences(payload, { tenantId: 42, contactId: 7 })
    const where = JSON.stringify((calls(payload, 'find')[0]![0] as { where: unknown }).where)
    expect(where).toContain('isActive')
    expect(where).toContain('captured')
  })

  it('does not enrol twice — a resubmitted form must not double every email', async () => {
    const payload = makePayload({ existing: [{ id: 5 }] })
    const n = await enrollInSequences(payload, { tenantId: 42, contactId: 7 })
    expect(n).toBe(0)
    expect(calls(payload, 'create')).toHaveLength(0)
  })

  it('skips a sequence with no steps rather than creating a stuck enrolment', async () => {
    const payload = makePayload({ sequences: [{ id: 9, steps: [] }] })
    expect(await enrollInSequences(payload, { tenantId: 42, contactId: 7 })).toBe(0)
  })

  it('never throws — a sequence problem must not cost the lead', async () => {
    const payload = { find: vi.fn().mockRejectedValue(new Error('DB down')), create: vi.fn() } as never
    await expect(enrollInSequences(payload, { tenantId: 42, contactId: 7 })).resolves.toBe(0)
  })
})

describe('stopSequencesForContact', () => {
  it('stops every active enrolment with a reason', async () => {
    const payload = makePayload({ active: [{ id: 1 }, { id: 2 }] })
    const n = await stopSequencesForContact(payload, { contactId: 7, reason: 'purchased' })

    expect(n).toBe(2)
    // Updated one id at a time: a bulk update by `where` on a RELATIONSHIP
    // matches nothing silently.
    expect(calls(payload, 'update')).toHaveLength(2)
    const data = (calls(payload, 'update')[0]![0] as { data: Record<string, unknown> }).data
    expect(data).toMatchObject({ status: 'stopped', stoppedReason: 'purchased', nextSendAt: null })
  })

  it('clears nextSendAt so a stopped enrolment can never come back due', async () => {
    const payload = makePayload({ active: [{ id: 1 }] })
    await stopSequencesForContact(payload, { contactId: 7, reason: 'unsubscribed' })
    const data = (calls(payload, 'update')[0]![0] as { data: Record<string, unknown> }).data
    expect(data.nextSendAt).toBeNull()
  })

  it('is a no-op when nothing is running', async () => {
    const payload = makePayload({ active: [] })
    expect(await stopSequencesForContact(payload, { contactId: 7, reason: 'manual' })).toBe(0)
  })
})
