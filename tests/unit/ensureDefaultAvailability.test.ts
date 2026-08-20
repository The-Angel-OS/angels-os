import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ensureDefaultAvailability } from '@/utilities/ensureDefaultAvailability'

const mockResolve = vi.hoisted(() => vi.fn())
vi.mock('@/utilities/resolveBookingProvider', () => ({
  resolveBookingProvider: mockResolve,
}))

function fakePayload(existing: unknown[] = []) {
  const created: Array<Record<string, unknown>> = []
  const payload = {
    find: vi.fn(async () => ({ docs: existing })),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data)
      return { id: created.length }
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { payload, created }
}

beforeEach(() => mockResolve.mockReset())

describe('ensureDefaultAvailability', () => {
  it('creates a full working week so /book can actually be booked', async () => {
    // Services + a provider without hours yields "no open times" forever — the
    // owner finds out by showing the page to a customer.
    mockResolve.mockResolvedValue(7)
    const { payload, created } = fakePayload()
    const res = await ensureDefaultAvailability(payload, 33)

    expect(res.created).toBe(5)
    expect(created.map((c) => (c.weeklySchedule as { dayOfWeek: string }).dayOfWeek)).toEqual([
      '1', '2', '3', '4', '5',
    ])
    expect(created.every((c) => c.provider === 7 && c.isActive === true)).toBe(true)
  })

  it('never overwrites an owner who already set their hours', async () => {
    mockResolve.mockResolvedValue(7)
    const { payload, created } = fakePayload([{ id: 1 }])
    const res = await ensureDefaultAvailability(payload, 33)

    expect(res.created).toBe(0)
    expect(created).toHaveLength(0)
  })

  it('writes nothing when there is no provider to pin hours to', async () => {
    // Hours belonging to nobody resolve to an empty calendar anyway, so rows
    // would only make a broken page look configured.
    mockResolve.mockResolvedValue(null)
    const { payload, created } = fakePayload()
    const res = await ensureDefaultAvailability(payload, 33)

    expect(res.created).toBe(0)
    expect(created).toHaveLength(0)
    expect(res.note).toContain('no provider')
  })
})
