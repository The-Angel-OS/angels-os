import { describe, it, expect, vi } from 'vitest'

vi.mock('@/utilities/logError', () => ({ logError: vi.fn() }))

import { eventsCompleteCronHandler } from '@/endpoints/events-complete-cron'

/** A payload double that answers each find from a queue and records updates. */
const makePayload = (results: Array<{ docs: Array<{ id: number }> }>) => {
  const finds: Array<Record<string, unknown>> = []
  const updates: Array<{ id: number; status: unknown }> = []
  let call = 0
  return {
    finds,
    updates,
    payload: {
      logger: { info: vi.fn(), warn: vi.fn() },
      find: vi.fn(async (args: Record<string, unknown>) => {
        finds.push(args)
        return results[call++] ?? { docs: [] }
      }),
      update: vi.fn(async ({ id, data }: { id: number; data: { status: unknown } }) => {
        updates.push({ id, status: data.status })
      }),
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (payload: any) => (eventsCompleteCronHandler as any)({ payload })

describe('events-complete sweep', () => {
  it('closes events that are past, and reports how many', async () => {
    const { payload, updates } = makePayload([{ docs: [{ id: 1 }, { id: 2 }] }, { docs: [{ id: 3 }] }])
    const body = await (await run(payload)).json()
    expect(updates).toEqual([
      { id: 1, status: 'completed' },
      { id: 2, status: 'completed' },
      { id: 3, status: 'completed' },
    ])
    expect(body).toMatchObject({ ok: true, examined: 3, completed: 3 })
  })

  it('only ever touches upcoming and live — cancelled did not happen, draft was never published', async () => {
    const { payload, finds } = makePayload([{ docs: [] }, { docs: [] }])
    await run(payload)
    for (const f of finds) {
      const and = (f.where as { and: Array<Record<string, unknown>> }).and
      expect(and[0]).toEqual({ status: { in: ['upcoming', 'live'] } })
    }
  })

  it('judges an event with no end date on its start date instead', async () => {
    const { payload, finds } = makePayload([{ docs: [] }, { docs: [] }])
    await run(payload)
    const second = (finds[1].where as { and: Array<Record<string, unknown>> }).and
    expect(second).toContainEqual({ endDateTime: { exists: false } })
    expect(second.some((c) => 'startDateTime' in c)).toBe(true)
  })

  it('leaves a two-hour grace so an event running over is not closed under it', async () => {
    const { payload, finds } = makePayload([{ docs: [] }, { docs: [] }])
    const before = Date.now()
    await run(payload)
    const and = (finds[0].where as { and: Array<Record<string, unknown>> }).and
    const cutoff = Date.parse(
      (and.find((c) => 'endDateTime' in c) as { endDateTime: { less_than: string } }).endDateTime
        .less_than,
    )
    expect(before - cutoff).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000 - 5000)
    expect(before - cutoff).toBeLessThan(2 * 60 * 60 * 1000 + 5000)
  })

  it('one bad row does not stop the sweep', async () => {
    const { payload, updates } = makePayload([{ docs: [{ id: 1 }, { id: 2 }] }, { docs: [] }])
    payload.update = vi.fn(async ({ id, data }: { id: number; data: { status: unknown } }) => {
      if (id === 1) throw new Error('nope')
      updates.push({ id, status: data.status })
    })
    const body = await (await run(payload)).json()
    expect(updates).toEqual([{ id: 2, status: 'completed' }])
    expect(body).toMatchObject({ examined: 2, completed: 1 })
  })
})
