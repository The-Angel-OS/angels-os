/**
 * notifications-poll — inbound poll: auth, fetch+filter, dedupe, persist, high-water mark.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/utilities/resolveConnector', () => ({ findAllConnectors: vi.fn() }))
vi.mock('@/utilities/ensureSystemSpace', () => ({ ensureSystemSpace: vi.fn().mockResolvedValue('77') }))
vi.mock('@/utilities/bridgeHelpers', () => ({
  markConnectorActive: vi.fn().mockResolvedValue(undefined),
  markConnectorError: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/utilities/logError', () => ({ logCaughtError: vi.fn().mockResolvedValue(undefined) }))

import { notificationsPollHandler } from '@/endpoints/notifications-poll'
import { findAllConnectors } from '@/utilities/resolveConnector'
import { markConnectorActive } from '@/utilities/bridgeHelpers'

const realFetch = global.fetch

function makeReq(payload: Record<string, unknown>, auth = 'Bearer test-secret') {
  const req = new Request('http://localhost/api/notifications/poll', { headers: { authorization: auth } })
  return Object.assign(req, { payload }) as never
}

function makePayload(over: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [] }), // dedupe: nothing seen
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    findByID: vi.fn(),
    ...over,
  }
}

describe('notificationsPollHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })
  afterEach(() => {
    global.fetch = realFetch
  })

  it('401s on bad cron secret', async () => {
    const res = await notificationsPollHandler(makeReq(makePayload(), 'Bearer wrong'))
    expect(res.status).toBe(401)
  })

  it('no connectors → message, no fetch', async () => {
    ;(findAllConnectors as ReturnType<typeof vi.fn>).mockResolvedValue([])
    const res = await notificationsPollHandler(makeReq(makePayload()))
    const body = await res.json()
    expect(body.results).toEqual([])
  })

  it('persists only messages newer than lastSeenMessageId and advances the mark', async () => {
    ;(findAllConnectors as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', tenantId: '5', config: { serverUrl: 'https://g', clientToken: 'C1', lastSeenMessageId: 10 } },
    ])
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [
          { id: 12, title: 'Up', message: 'service up', appid: 1, priority: 5, date: '2026-06-07T00:00:00Z' },
          { id: 11, title: 'Down', message: 'service down', appid: 1 },
          { id: 9, title: 'old', message: 'ignore' }, // <= lastSeen, skipped
        ],
      }),
    }) as never

    const payload = makePayload()
    const res = await notificationsPollHandler(makeReq(payload))
    const body = await res.json()

    expect(body.totalCreated).toBe(2)
    expect(payload.create).toHaveBeenCalledTimes(2)
    // chronological insert: id 11 before 12
    const firstCreate = (payload.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(firstCreate.data.metadata.gotifyMessageId).toBe(11)
    expect(firstCreate.data.channel).toBe('gotify')
    expect(firstCreate.data.space).toBe(77)
    expect(firstCreate.data.messageType).toBe('system')
    // high-water mark persisted = 12
    const updateCall = (payload.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateCall.data.config.lastSeenMessageId).toBe(12)
    expect(markConnectorActive).toHaveBeenCalledWith(payload, 'c1')
  })

  it('skips a message already mirrored (dedupe by gotifyMessageId)', async () => {
    ;(findAllConnectors as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', tenantId: '5', config: { serverUrl: 'https://g', clientToken: 'C1', lastSeenMessageId: 0 } },
    ])
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 5, title: 'dup', message: 'x' }] }),
    }) as never
    // Batch dedup matches on metadata.gotifyMessageId — return an existing doc for id 5.
    const payload = makePayload({ find: vi.fn().mockResolvedValue({ docs: [{ id: 999, metadata: { gotifyMessageId: 5 } }] }) })
    const res = await notificationsPollHandler(makeReq(payload))
    const body = await res.json()
    expect(body.totalCreated).toBe(0)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('reports config error when clientToken missing', async () => {
    ;(findAllConnectors as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', tenantId: '5', config: { serverUrl: 'https://g' } },
    ])
    const res = await notificationsPollHandler(makeReq(makePayload()))
    const body = await res.json()
    expect(body.results[0].error).toMatch(/clientToken/i)
  })
})
