/**
 * fetchWithRetry — federation client resilience. A single transient blip must
 * NOT skip a heartbeat (which was leaving the mesh cold).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchWithRetry } from '@/utilities/federationClient'

const ok = () => new Response('{"ok":true}', { status: 200 })
const fail500 = () => new Response('err', { status: 500 })

afterEach(() => vi.unstubAllGlobals())

describe('fetchWithRetry', () => {
  it('retries a transient failure and then succeeds', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++
      if (calls < 3) throw new Error('network blip')
      return ok()
    }))
    const res = await fetchWithRetry('https://peer/x', { method: 'GET' }, { timeout: 1000, retries: 2 })
    expect(res?.ok).toBe(true)
    expect(calls).toBe(3) // failed, failed, succeeded
  })

  it('retries 5xx but returns the response once it is ok', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => (++calls < 2 ? fail500() : ok())))
    const res = await fetchWithRetry('https://peer/x', { method: 'POST' }, { timeout: 1000, retries: 2 })
    expect(res?.status).toBe(200)
    expect(calls).toBe(2)
  })

  it('does NOT retry a 4xx — hands it straight back', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++
      return new Response('nope', { status: 403 })
    }))
    const res = await fetchWithRetry('https://peer/x', { method: 'GET' }, { timeout: 1000, retries: 3 })
    expect(res?.status).toBe(403)
    expect(calls).toBe(1)
  })

  it('returns null when every attempt fails', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++
      throw new Error('down')
    }))
    const res = await fetchWithRetry('https://peer/x', { method: 'GET' }, { timeout: 500, retries: 2 })
    expect(res).toBeNull()
    expect(calls).toBe(3) // initial + 2 retries
  })
})
