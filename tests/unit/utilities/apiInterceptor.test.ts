/**
 * apiInterceptor — Unit Tests
 *
 * Tests the createApiInterceptor function which wraps window.fetch
 * to log API calls. Runs in jsdom environment (window is defined).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/services/SystemMonitorService', () => ({
  logApi: vi.fn(),
  logError: vi.fn(),
}))

import { createApiInterceptor } from '@/utilities/apiInterceptor'
import { logApi, logError } from '@/services/SystemMonitorService'

// ── createApiInterceptor ────────────────────────────────────────────────────────

describe('createApiInterceptor', () => {
  let originalFetch: typeof window.fetch

  beforeEach(() => {
    originalFetch = window.fetch
    vi.clearAllMocks()
    // createApiInterceptor is deliberately idempotent — it latches
    // window.__apiInterceptorInstalled so strict-mode double-effects and HMR
    // can't stack interceptors. The latch survives between tests, so every
    // test after the first was silently exercising a no-op.
    delete (window as unknown as { __apiInterceptorInstalled?: boolean }).__apiInterceptorInstalled
  })

  afterEach(() => {
    window.fetch = originalFetch
    delete (window as unknown as { __apiInterceptorInstalled?: boolean }).__apiInterceptorInstalled
  })

  it('does not throw when called in window environment', () => {
    expect(() => createApiInterceptor()).not.toThrow()
  })

  it('replaces window.fetch with a wrapped version', () => {
    const before = window.fetch
    createApiInterceptor()
    // window.fetch should now be the interceptor wrapper
    expect(window.fetch).not.toBe(before)
  })

  it('calls through to the original fetch on success', async () => {
    const mockResponse = new Response('ok', { status: 200 })
    const mockFetch = vi.fn().mockResolvedValue(mockResponse)
    window.fetch = mockFetch

    createApiInterceptor()
    await window.fetch('https://example.com/api/data')

    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('calls logApi with method, url, status after a successful fetch', async () => {
    const mockResponse = new Response('ok', { status: 200 })
    window.fetch = vi.fn().mockResolvedValue(mockResponse)

    createApiInterceptor()
    await window.fetch('https://example.com/api/data', { method: 'POST' })

    expect(logApi).toHaveBeenCalledWith('POST', 'https://example.com/api/data', 200, expect.any(Number))
  })

  it('defaults method to GET when not provided in init', async () => {
    const mockResponse = new Response('ok', { status: 200 })
    window.fetch = vi.fn().mockResolvedValue(mockResponse)

    createApiInterceptor()
    await window.fetch('https://example.com/api/list')

    expect(logApi).toHaveBeenCalledWith('GET', 'https://example.com/api/list', 200, expect.any(Number))
  })

  it('calls logError when response status >= 400', async () => {
    const mockResponse = new Response('not found', { status: 404, statusText: 'Not Found' })
    window.fetch = vi.fn().mockResolvedValue(mockResponse)

    createApiInterceptor()
    await window.fetch('https://example.com/api/missing')

    expect(logError).toHaveBeenCalled()
  })

  it('does not call logError for successful (2xx) responses', async () => {
    const mockResponse = new Response('ok', { status: 201 })
    window.fetch = vi.fn().mockResolvedValue(mockResponse)

    createApiInterceptor()
    await window.fetch('https://example.com/api/create', { method: 'POST' })

    expect(logError).not.toHaveBeenCalled()
  })

  it('rethrows network errors and calls logError', async () => {
    const networkError = new Error('Network failure')
    window.fetch = vi.fn().mockRejectedValue(networkError)

    createApiInterceptor()

    await expect(window.fetch('https://example.com/api/fail')).rejects.toThrow('Network failure')
    expect(logError).toHaveBeenCalled()
  })

  it('accepts URL object as first argument', async () => {
    const mockResponse = new Response('ok', { status: 200 })
    window.fetch = vi.fn().mockResolvedValue(mockResponse)

    createApiInterceptor()
    await window.fetch(new URL('https://example.com/api/url-obj'))

    expect(logApi).toHaveBeenCalledWith('GET', 'https://example.com/api/url-obj', 200, expect.any(Number))
  })

  it('accepts Request object as first argument', async () => {
    const mockResponse = new Response('ok', { status: 200 })
    window.fetch = vi.fn().mockResolvedValue(mockResponse)

    createApiInterceptor()
    const req = new Request('https://example.com/api/req-obj', { method: 'PUT' })
    await window.fetch(req)

    expect(logApi).toHaveBeenCalledWith('GET', 'https://example.com/api/req-obj', 200, expect.any(Number))
  })
})
