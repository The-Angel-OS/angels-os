/**
 * pushNotify — unit tests (fail-soft + payload mapping + resolution order).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pushNotify, resolveGotifyTarget } from '@/utilities/pushNotify'

describe('pushNotify', () => {
  const realFetch = global.fetch
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.GOTIFY_SERVER_URL
    delete process.env.GOTIFY_APP_TOKEN
  })
  afterEach(() => {
    global.fetch = realFetch
  })

  it('POSTs to {server}/message with X-Gotify-Key and clamped priority', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    global.fetch = fetchMock as never

    const res = await pushNotify(
      { title: 'Hi', message: 'body', priority: 99 },
      { serverUrl: 'https://gotify.example.com/', appToken: 'A-token' },
    )

    expect(res.ok).toBe(true)
    expect(res.via).toBe('opts')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://gotify.example.com/message') // trailing slash trimmed
    expect(init.method).toBe('POST')
    expect(init.headers['X-Gotify-Key']).toBe('A-token')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ title: 'Hi', message: 'body', priority: 10 }) // clamped 99→10
  })

  it('includes extras only when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    global.fetch = fetchMock as never
    await pushNotify(
      { title: 't', message: 'm', extras: { 'client::display': { contentType: 'text/markdown' } } },
      { serverUrl: 'https://g', appToken: 'A' },
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.extras).toBeDefined()
  })

  it('returns ok:false (not throw) on non-2xx', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'bad token' }) as never
    const res = await pushNotify({ title: 't', message: 'm' }, { serverUrl: 'https://g', appToken: 'A' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
    expect(res.error).toContain('401')
  })

  it('never throws on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET')) as never
    const res = await pushNotify({ title: 't', message: 'm' }, { serverUrl: 'https://g', appToken: 'A' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('ECONNRESET')
  })

  it('no-ops (ok:false) when nothing configured', async () => {
    const res = await pushNotify({ title: 't', message: 'm' }, {})
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/no gotify server/i)
  })

  it('empty notification is rejected', async () => {
    const res = await pushNotify({ title: '', message: '' }, { serverUrl: 'https://g', appToken: 'A' })
    expect(res.ok).toBe(false)
  })
})

describe('resolveGotifyTarget', () => {
  beforeEach(() => {
    delete process.env.GOTIFY_SERVER_URL
    delete process.env.GOTIFY_APP_TOKEN
  })

  it('opts win over connector + env', async () => {
    const t = await resolveGotifyTarget(null, { serverUrl: 'https://opts', appToken: 'OPTS' })
    expect(t).toEqual({ serverUrl: 'https://opts', appToken: 'OPTS', via: 'opts' })
  })

  it('resolves from connector config when no opts', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 1, config: { serverUrl: 'https://conn', appToken: 'CONN' } }],
      }),
    }
    const t = await resolveGotifyTarget(payload as never, { tenantId: 5 })
    expect(t).toEqual({ serverUrl: 'https://conn', appToken: 'CONN', via: 'connector' })
  })

  it('falls back to env when no connector', async () => {
    process.env.GOTIFY_SERVER_URL = 'https://env'
    process.env.GOTIFY_APP_TOKEN = 'ENV'
    const payload = { find: vi.fn().mockResolvedValue({ docs: [] }) }
    const t = await resolveGotifyTarget(payload as never, { tenantId: 5 })
    expect(t).toEqual({ serverUrl: 'https://env', appToken: 'ENV', via: 'env' })
  })

  it('returns null when nothing configured', async () => {
    const t = await resolveGotifyTarget(null, { tenantId: 5 })
    expect(t).toBeNull()
  })
})
