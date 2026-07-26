/**
 * logError / logCaughtError — Unit Tests
 *
 * Tests the dual-write strategy: application-logs persistence + AI Bus routing.
 * Payload and @payload-config are mocked to avoid real DB calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/utilities/messageContent', () => ({
  createSystemActionContent: vi.fn((summary: string) => [{ type: 'paragraph', text: summary }]),
}))

vi.mock('@/utilities/ensureSystemSpace', () => ({
  AI_BUS_SPACE_SLUG: 'ai-bus',
}))

import { logError, logCaughtError } from '@/utilities/logError'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePayload(aiBusSpace?: { id: string }) {
  return {
    create: vi.fn().mockResolvedValue({}),
    find: vi.fn().mockResolvedValue({ docs: aiBusSpace ? [aiBusSpace] : [] }),
  } as any
}

// ── logError ──────────────────────────────────────────────────────────────────

describe('logError', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('persists to application-logs', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload)
    await logError({ source: 'TestModule', message: 'Something failed' })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'application-logs',
        data: expect.objectContaining({
          source: 'TestModule',
          message: 'Something failed',
        }),
      }),
    )
  })

  it('uses "error" as default level', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload)
    await logError({ source: 'Test', message: 'err' })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ level: 'error' }),
      }),
    )
  })

  it('respects explicit log level', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload)
    await logError({ source: 'Test', message: 'warn msg', level: 'warning' })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ level: 'warning' }),
      }),
    )
  })

  it('includes optional fields when provided', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload)
    await logError({
      source: 'Test',
      message: 'oops',
      statusCode: 500,
      url: '/api/test',
      userId: 42,
      tenantId: 1,
    })
    const createCall = payload.create.mock.calls.find(
      (c: any) => c[0].collection === 'application-logs',
    )
    expect(createCall[0].data.statusCode).toBe(500)
    expect(createCall[0].data.url).toBe('/api/test')
    expect(createCall[0].data.userId).toBe('42') // stringified
    expect(createCall[0].data.tenantId).toBe('1')
  })

  it('sets resolved=false on all new log entries', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload)
    // Distinct message per test: logError carries an in-process flood guard
    // (same level+source+message within 30s is DROPPED), so tests that reuse a
    // message silently assert against a suppressed call.
    await logError({ source: 'Test', message: 'resolved-flag-case' })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resolved: false }),
      }),
    )
  })

  it('does NOT emit to AI Bus when no tenantId', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload)
    await logError({ source: 'Test', message: 'err' })
    // payload.find (for AI Bus space lookup) should not be called
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('emits to AI Bus errors channel when tenantId is provided and space exists', async () => {
    const payload = makePayload({ id: 'space-123' })
    mockGetPayload.mockResolvedValue(payload)
    await logError({ source: 'TestSvc', message: 'AI Bus test', tenantId: 1 })
    // Should call payload.create twice: once for app-logs, once for AI Bus message
    expect(payload.create).toHaveBeenCalledTimes(2)
    const messageCreate = payload.create.mock.calls.find(
      (c: any) => c[0].collection === 'messages',
    )
    expect(messageCreate).toBeDefined()
    expect(messageCreate[0].data.channel).toBe('errors')
  })

  it('does not emit to AI Bus when the AI Bus space is not found', async () => {
    const payload = makePayload() // no AI Bus space
    mockGetPayload.mockResolvedValue(payload)
    await logError({ source: 'Test', message: 'no-ai-bus-space-case', tenantId: 1 })
    expect(payload.create).toHaveBeenCalledTimes(1) // only app-logs
  })

  it('does not throw when payload.create fails (graceful degradation)', async () => {
    const payload = {
      create: vi.fn().mockRejectedValue(new Error('DB down')),
      find: vi.fn().mockResolvedValue({ docs: [] }),
    } as any
    mockGetPayload.mockResolvedValue(payload)
    // Should not throw — catches internally
    await expect(logError({ source: 'Test', message: 'err' })).resolves.not.toThrow()
  })
})

// ── logCaughtError ────────────────────────────────────────────────────────────

describe('logCaughtError', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('extracts message and stack from an Error object', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload)
    const err = new Error('Something went wrong')
    await logCaughtError('TestModule', err)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: 'Something went wrong',
          details: expect.stringContaining('Error: Something went wrong'),
        }),
      }),
    )
  })

  it('handles non-Error values by stringifying them', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload)
    await logCaughtError('TestModule', 'plain string error')
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: 'plain string error',
        }),
      }),
    )
  })

  it('forwards extra options to logError', async () => {
    const payload = makePayload()
    mockGetPayload.mockResolvedValue(payload)
    await logCaughtError('TestModule', new Error('err'), { statusCode: 404, tenantId: 5 })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statusCode: 404,
          tenantId: '5',
        }),
      }),
    )
  })
})
