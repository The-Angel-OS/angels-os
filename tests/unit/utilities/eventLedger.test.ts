import { describe, it, expect, vi } from 'vitest'
import { withEventLedger } from '@/utilities/eventLedger'

function fakeReq(body: string, create = vi.fn(), update = vi.fn()) {
  const req = {
    url: 'https://node/api/sms/webhook',
    payload: {
      create: create.mockResolvedValue({ id: 7 }),
      update,
      logger: { warn: vi.fn() },
    },
    clone: () => ({ text: async () => body }),
  }
  return { req, create, update }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('withEventLedger', () => {
  it('records the arrival before the handler runs, then closes it done', async () => {
    const { req, create, update } = fakeReq('{"type":"charge.succeeded","id":"evt_1"}')
    const handler = vi.fn(async () => {
      // The row must already exist by the time the handler is reached.
      expect(create).toHaveBeenCalledOnce()
      return new Response('ok', { status: 200 })
    })

    const res = await withEventLedger('stripe', handler)(req as never)
    await flush()

    expect(res.status).toBe(200)
    expect(create.mock.calls[0][0].data).toMatchObject({
      source: 'stripe',
      status: 'received',
      eventType: 'charge.succeeded',
      externalId: 'evt_1',
      path: '/api/sms/webhook',
    })
    expect(update.mock.calls[0][0]).toMatchObject({ id: 7, data: { status: 'done', statusCode: 200 } })
  })

  it('records a failure and re-throws, so wrapping changes no behaviour', async () => {
    const { req, update } = fakeReq('{}')
    const boom = new Error('twilio exploded')

    await expect(withEventLedger('twilio', async () => { throw boom })(req as never)).rejects.toThrow('twilio exploded')
    await flush()

    expect(update.mock.calls[0][0].data.status).toBe('failed')
    expect(update.mock.calls[0][0].data.error).toContain('twilio exploded')
  })

  it('never turns a good webhook into a 500 when the ledger itself fails', async () => {
    const { req } = fakeReq('{}', vi.fn().mockRejectedValue(new Error('db down')))
    const res = await withEventLedger('slack', async () => new Response('ok', { status: 200 }))(req as never)
    expect(res.status).toBe(200)
  })

  it('stores a non-JSON body rather than dropping it (Twilio posts form-encoded)', async () => {
    const { req, create } = fakeReq('MessageSid=SM1&Body=hello')
    await withEventLedger('twilio', async () => new Response('ok'))(req as never)
    expect(create.mock.calls[0][0].data.body).toBe('MessageSid=SM1&Body=hello')
    expect(create.mock.calls[0][0].data.eventType).toBeUndefined()
  })
})
