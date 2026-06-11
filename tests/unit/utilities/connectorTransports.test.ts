/**
 * connectorTransports — medium-agnostic escalation send layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utilities/gotifyNotify', () => ({
  gotifyNotify: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
}))

import { getTransport, ESCALATION_TRANSPORT_TYPES } from '@/utilities/connectorTransports'
import { gotifyNotify } from '@/utilities/gotifyNotify'

const msg = { title: 'T', message: 'M', priority: 8 }

describe('connectorTransports', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registers gotify, telegram, and webhook', () => {
    expect(ESCALATION_TRANSPORT_TYPES.sort()).toEqual(['gotify', 'telegram', 'webhook'])
    expect(getTransport('whatsapp')).toBeUndefined()
  })

  it('gotify: ready needs server+token, send delegates to gotifyNotify', async () => {
    const t = getTransport('gotify')!
    expect(t.ready({})).toBe(false)
    expect(t.ready({ serverUrl: 'https://g', appToken: 'A' })).toBe(true)
    const r = await t.send({ serverUrl: 'https://g', appToken: 'A' }, msg)
    expect(r.ok).toBe(true)
    expect(gotifyNotify).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'T', message: 'M', priority: 8 }),
      { serverUrl: 'https://g', appToken: 'A' },
    )
  })

  it('telegram: ready needs botToken+chatId, send posts to the Bot API', async () => {
    const t = getTransport('telegram')!
    expect(t.ready({ botToken: 'b' })).toBe(false)
    expect(t.ready({ botToken: 'b', chatId: '1' })).toBe(true)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const r = await t.send({ botToken: 'b', chatId: '1' }, msg)
    expect(r.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/botb/sendMessage',
      expect.objectContaining({ method: 'POST' }),
    )
    vi.unstubAllGlobals()
  })

  it('webhook: ready needs url, non-2xx → ok:false with status', async () => {
    const t = getTransport('webhook')!
    expect(t.ready({})).toBe(false)
    expect(t.ready({ url: 'https://hook' })).toBe(true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    const r = await t.send({ url: 'https://hook' }, msg)
    expect(r).toEqual({ ok: false, error: 'webhook 503' })
    vi.unstubAllGlobals()
  })

  it('transports are fail-soft — a thrown fetch becomes ok:false', async () => {
    const t = getTransport('webhook')!
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const r = await t.send({ url: 'https://hook' }, msg)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('network')
    vi.unstubAllGlobals()
  })
})
