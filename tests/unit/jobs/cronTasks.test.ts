import type { PayloadHandler, PayloadRequest } from 'payload'

import { afterEach, describe, expect, it } from 'vitest'

import { callHandler, cronTasks } from '@/jobs/cronTasks'

const fakeReq = { payload: { id: 'sentinel' } } as unknown as PayloadRequest

afterEach(() => {
  delete process.env.CRON_SECRET
})

describe('cron tasks', () => {
  it('schedules every job exactly once, on a six-field cron', () => {
    const slugs = cronTasks.map((t) => t.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs).toHaveLength(9)
    for (const task of cronTasks) {
      const schedule = task.schedule || []
      expect(schedule).toHaveLength(1)
      // Five fields silently means something else — '0 */5 * * *' is 5am, not
      // every 5 minutes.
      expect(schedule[0]!.cron.split(' ')).toHaveLength(6)
      expect(schedule[0]!.queue).toBe('cron')
    }
  })

  it('passes the cron bearer and the real req through to the handler', async () => {
    process.env.CRON_SECRET = 's3cret'
    let seen: PayloadRequest | undefined
    const handler: PayloadHandler = async (req) => {
      seen = req
      return Response.json({ ok: true, healed: 2 })
    }

    const result = await callHandler(handler, fakeReq, '/api/thing?all=1')

    expect(result.output).toEqual({ ok: true, healed: 2 })
    expect(seen!.headers.get('authorization')).toBe('Bearer s3cret')
    expect(new URL(seen!.url!).searchParams.get('all')).toBe('1')
    expect(seen!.payload).toBe(fakeReq.payload)
  })

  it('throws — so the job row records a failure — when the handler is not ok', async () => {
    process.env.CRON_SECRET = 's3cret'
    const handler: PayloadHandler = async () =>
      Response.json({ error: 'nope' }, { status: 403 })

    await expect(callHandler(handler, fakeReq, '/api/thing')).rejects.toThrow(/403/)
  })

  it('throws when CRON_SECRET is missing rather than 403ing four times', async () => {
    const handler: PayloadHandler = async () => Response.json({ ok: true })
    await expect(callHandler(handler, fakeReq, '/api/thing')).rejects.toThrow(/CRON_SECRET/)
  })
})
