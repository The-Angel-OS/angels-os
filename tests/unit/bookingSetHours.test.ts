import { describe, it, expect, vi } from 'vitest'
import { parseDays } from '@/endpoints/booking-set-hours'

describe('parseDays — the weekly hours editor payload', () => {
  it('accepts a normal week', () => {
    const out = parseDays([
      { day: 1, start: '09:00', end: '17:00' },
      { day: 5, start: '08:30', end: '12:00' },
    ])
    expect(Array.isArray(out)).toBe(true)
    expect(out).toHaveLength(2)
  })

  it('accepts an empty week (owner closes every day)', () => {
    expect(parseDays([])).toEqual([])
  })

  it.each([
    [[{ day: 7, start: '09:00', end: '17:00' }], 'day must be 0–6'],
    [[{ day: 1, start: '9am', end: '17:00' }], 'start and end must be HH:MM'],
    [[{ day: 1, start: '17:00', end: '09:00' }], 'start must be before end'],
    [[{ day: 1, start: '09:00', end: '09:00' }], 'start must be before end'],
    [
      [
        { day: 1, start: '09:00', end: '10:00' },
        { day: 1, start: '11:00', end: '12:00' },
      ],
      'duplicate day',
    ],
  ])('rejects %j', (input, message) => {
    expect(parseDays(input)).toBe(message)
  })

  it('rejects a non-array', () => {
    expect(parseDays({ day: 1 })).toBe('days must be an array')
  })
})

describe('house hours', () => {
  it('asks for rows with no provider when there is no named one', async () => {
    const { providerWhere } = await import('@/utilities/resolveBookingProvider')
    // A one-person business, and every unclaimed prospect demo, live here.
    expect(providerWhere(null)).toEqual({})
  })

  it('still scopes to the named provider when there is one', async () => {
    const { providerWhere } = await import('@/utilities/resolveBookingProvider')
    expect(providerWhere(7)).toEqual({ provider: { equals: 7 } })
  })

  it('never matches everyone — the two forms are mutually exclusive', async () => {
    const { providerWhere } = await import('@/utilities/resolveBookingProvider')
    // A clause that matched every row would let one portal's hours leak into
    // another's booking page, which is worse than an empty calendar.
    expect(JSON.stringify(providerWhere(null))).not.toEqual(JSON.stringify(providerWhere(7)))
    expect(providerWhere(0)).toEqual({ provider: { equals: 0 } })
  })
})

describe('matchesProvider — the narrowing the query cannot do', () => {
  it('house rows belong to the house, and only to the house', async () => {
    const { matchesProvider } = await import('@/utilities/resolveBookingProvider')
    expect(matchesProvider({}, null)).toBe(true)
    expect(matchesProvider({ provider: null }, null)).toBe(true)
    // The leak this guards: a named provider's hours must never be served as
    // the house calendar, because providerWhere(null) no longer constrains SQL.
    expect(matchesProvider({ provider: 7 }, null)).toBe(false)
    expect(matchesProvider({ provider: { id: 7 } }, null)).toBe(false)
  })

  it('a named provider gets their own rows, depth 0 or depth 1', async () => {
    const { matchesProvider } = await import('@/utilities/resolveBookingProvider')
    expect(matchesProvider({ provider: 7 }, 7)).toBe(true)
    expect(matchesProvider({ provider: { id: 7 } }, 7)).toBe(true)
    expect(matchesProvider({ provider: '7' }, 7)).toBe(true)
    expect(matchesProvider({ provider: 8 }, 7)).toBe(false)
    expect(matchesProvider({}, 7)).toBe(false)
  })
})

describe('who may be the booking provider', () => {
  it('a plain member is never the provider', async () => {
    vi.resetModules()
    const { resolveBookingProvider } = await import('@/utilities/resolveBookingProvider')
    const payload = {
      find: vi.fn(async ({ collection, where }: never) => {
        const c = collection as unknown as string
        if (c === 'availability') return { docs: [{ provider: null }], totalDocs: 1 }
        // Only plain members on this portal — the shape enrol-on-arrival creates
        // for every signed-in visitor. Resolving one of them as the provider
        // would book a stranger's calendar for the business's customers.
        const clauses = (where as unknown as { and?: { role?: { equals?: string } }[] })?.and || []
        const role = clauses.find((x) => x?.role)?.role?.equals
        if (role === 'tenant_admin' || role === 'tenant_manager') return { docs: [], totalDocs: 0 }
        return { docs: [{ user: 3, role: 'tenant_member' }], totalDocs: 1 }
      }),
    }
    expect(await resolveBookingProvider(payload as never, 40)).toBeNull()
  })

  it('a tenant_manager is', async () => {
    vi.resetModules()
    const { resolveBookingProvider } = await import('@/utilities/resolveBookingProvider')
    const payload = {
      find: vi.fn(async ({ collection, where }: never) => {
        const c = collection as unknown as string
        if (c === 'availability') return { docs: [{ provider: null }], totalDocs: 1 }
        const clauses = (where as unknown as { and?: { role?: { equals?: string } }[] })?.and || []
        const role = clauses.find((x) => x?.role)?.role?.equals
        if (role === 'tenant_manager') return { docs: [{ user: 21 }], totalDocs: 1 }
        return { docs: [], totalDocs: 0 }
      }),
    }
    expect(await resolveBookingProvider(payload as never, 40)).toBe(21)
  })
})
