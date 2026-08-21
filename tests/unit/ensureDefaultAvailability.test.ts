import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ensureDefaultAvailability,
  ensureTenantDefaultAvailability,
} from '@/utilities/ensureDefaultAvailability'

const mockResolve = vi.hoisted(() => vi.fn())
vi.mock('@/utilities/resolveBookingProvider', () => ({
  resolveBookingProvider: mockResolve,
  // The real one. Stubbing the module wholesale meant this came back undefined
  // and every seed threw into the fail-soft catch, reporting "0 created".
  providerWhere: (id: number | null) =>
    id == null ? { provider: { equals: null } } : { provider: { equals: id } },
}))

function fakePayload(existingCount = 0) {
  const created: Array<Record<string, unknown>> = []
  const payload = {
    find: vi.fn(async () => ({ totalDocs: existingCount, docs: [] })),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data)
      return { id: created.length }
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { payload, created }
}

beforeEach(() => mockResolve.mockReset())

describe('ensureDefaultAvailability (explicit provider — the guardian angel path)', () => {
  it('seeds a full working week against the provider it was given', async () => {
    const { payload, created } = fakePayload()
    const res = await ensureDefaultAvailability(payload, 33, 7)

    expect(res.created).toBe(5)
    expect(created.map((c) => (c.weeklySchedule as { dayOfWeek: string }).dayOfWeek)).toEqual([
      '1', '2', '3', '4', '5',
    ])
    expect(created.every((c) => c.provider === 7)).toBe(true)
  })

  it('keeps the scheduling defaults the booking grid depends on', () => {
    // slotDuration/buffer/advance windows shape the slot grid — dropping them
    // silently changes how every seeded calendar behaves.
    return ensureDefaultAvailability(fakePayload().payload, 33, 7).then(async () => {
      const { payload, created } = fakePayload()
      await ensureDefaultAvailability(payload, 33, 7)
      expect(created[0]!.slotDuration).toBe(30)
      expect(created[0]!.maxAdvanceBooking).toBe(30)
      expect(created[0]!.minAdvanceBooking).toBe(1)
    })
  })

  it('never overwrites an owner who already set their hours', async () => {
    const { payload, created } = fakePayload(1)
    const res = await ensureDefaultAvailability(payload, 33, 7)
    expect(res).toEqual({ created: 0, skipped: true })
    expect(created).toHaveLength(0)
  })
})

describe('ensureTenantDefaultAvailability (resolved provider — the business path)', () => {
  it('seeds the calendar /book will actually read', async () => {
    // Hours pinned to anyone other than the resolved provider leave /book
    // showing "no open times" even though rows exist.
    mockResolve.mockResolvedValue(7)
    const { payload, created } = fakePayload()
    const res = await ensureTenantDefaultAvailability(payload, 33)

    expect(res.providerId).toBe(7)
    expect(res.created).toBe(5)
    expect(created.every((c) => c.provider === 7)).toBe(true)
  })

  it('does not re-seed a calendar that already has hours', async () => {
    // The old assertion here was "writes nothing when no provider resolves",
    // which encoded the bug: an unclaimed portal got no hours at all. That case
    // now seeds house hours — see the house-hours block below. Idempotency is
    // the property actually worth pinning down.
    mockResolve.mockResolvedValue(null)
    const { payload, created } = fakePayload(5)
    const res = await ensureTenantDefaultAvailability(payload, 33)

    expect(res.created).toBe(0)
    expect(res.skipped).toBe(true)
    expect(created).toHaveLength(0)
  })
})

describe('house hours — a portal with no human on it yet', () => {
  it('seeds the business its own week instead of bailing', async () => {
    const { payload, created } = fakePayload()
    mockResolve.mockResolvedValue(null)

    const res = await ensureTenantDefaultAvailability(payload, 40)

    // Used to return { skipped: true, note: 'no provider' } and leave /book
    // empty on exactly the sites built to demonstrate booking.
    expect(res.created).toBe(5)
    expect(res.providerId).toBeNull()
    expect(res.note).toContain('house hours')
    // An absent relationship, not an explicit null — Payload treats them apart.
    for (const row of created) expect('provider' in row).toBe(false)
  })

  it('still prefers a named provider when the portal has one', async () => {
    const { payload, created } = fakePayload()
    mockResolve.mockResolvedValue(12)

    const res = await ensureTenantDefaultAvailability(payload, 40)

    expect(res.providerId).toBe(12)
    for (const row of created) expect(row.provider).toBe(12)
  })
})
