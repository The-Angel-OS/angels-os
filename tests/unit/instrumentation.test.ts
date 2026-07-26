/**
 * Footgun 2.1: Node's `fetch` default is 300s. src/instrumentation.ts installs
 * a bounded default at server boot so ~240 existing call sites, and every one
 * written after this, cannot hang a request path waiting it out.
 *
 * The two things that must hold: an unsignalled fetch GETS a signal, and a
 * caller that brought its own signal KEEPS it.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { register } from '@/instrumentation'

const originalFetch = globalThis.fetch
const originalRuntime = process.env.NEXT_RUNTIME
const calls: Array<RequestInit | undefined> = []

beforeAll(async () => {
  process.env.NEXT_RUNTIME = 'nodejs'
  globalThis.fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
    calls.push(init)
    return new Response('ok')
  }) as unknown as typeof fetch
  await register()
})

afterAll(() => {
  globalThis.fetch = originalFetch
  process.env.NEXT_RUNTIME = originalRuntime
  delete (globalThis as { __fetchTimeoutInstalled?: boolean }).__fetchTimeoutInstalled
})

describe('bounded fetch default', () => {
  it('gives an unsignalled fetch a timeout signal', async () => {
    await fetch('https://example.test/a')
    expect(calls.at(-1)?.signal).toBeInstanceOf(AbortSignal)
  })

  it('leaves an explicit signal alone', async () => {
    const controller = new AbortController()
    await fetch('https://example.test/b', { signal: controller.signal })
    expect(calls.at(-1)?.signal).toBe(controller.signal)
  })

  it('preserves the rest of init', async () => {
    await fetch('https://example.test/c', { method: 'POST', body: 'x' })
    expect(calls.at(-1)?.method).toBe('POST')
    expect(calls.at(-1)?.body).toBe('x')
  })
})
