/**
 * resolveEmailSender — Unit Tests
 *
 * Tests the fallback and connector-driven email resolution.
 * Real email providers (Resend, SMTP) are not invoked; only the resolution
 * logic and returned shape are verified.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock resolveConnector to control what connector is returned
vi.mock('@/utilities/resolveConnector', () => ({
  resolveConnector: vi.fn(),
}))

// Mock outboundRetry (used inside provider sends)
vi.mock('@/utilities/outboundRetry', () => ({
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}))

import { resolveEmailSender, markConnectorError } from '@/utilities/resolveEmailSender'
import { resolveConnector } from '@/utilities/resolveConnector'

const mockResolveConnector = vi.mocked(resolveConnector)

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [] }),
    update: vi.fn().mockResolvedValue({}),
    sendEmail: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any
}

// ── resolveEmailSender — fallback to payload-default ──────────────────────────

describe('resolveEmailSender (payload-default fallback)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveConnector.mockResolvedValue(null)
  })

  it('returns provider "payload-default" when no connector found', async () => {
    const payload = makePayload()
    const result = await resolveEmailSender(payload, 1)
    expect(result.provider).toBe('payload-default')
  })

  it('exposes a sendEmail function on the returned object', async () => {
    const payload = makePayload()
    const result = await resolveEmailSender(payload, 1)
    expect(typeof result.sendEmail).toBe('function')
  })

  it('sends email via payload.sendEmail in fallback mode', async () => {
    const payload = makePayload()
    const result = await resolveEmailSender(payload, 1)
    await result.sendEmail({ to: 'user@example.com', subject: 'Test', text: 'Hello' })
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com', subject: 'Test' }),
    )
  })

  it('returns fromAddress from SYSTEM_EMAIL_ADDRESS env var when set', async () => {
    const payload = makePayload()
    process.env.SYSTEM_EMAIL_ADDRESS = 'system@myapp.com'
    const result = await resolveEmailSender(payload)
    expect(result.fromAddress).toBe('system@myapp.com')
    delete process.env.SYSTEM_EMAIL_ADDRESS
  })

  it('falls back to default fromAddress when env not set', async () => {
    const payload = makePayload()
    delete process.env.SYSTEM_EMAIL_ADDRESS
    delete process.env.EMAIL_FROM_ADDRESS
    const result = await resolveEmailSender(payload)
    expect(result.fromAddress).toBe('hello@spacesangels.com')
  })

  it('does not call resolveConnector when tenantId is undefined', async () => {
    const payload = makePayload()
    await resolveEmailSender(payload)
    expect(mockResolveConnector).not.toHaveBeenCalled()
  })

  it('calls resolveConnector when tenantId is provided', async () => {
    const payload = makePayload()
    await resolveEmailSender(payload, 42)
    expect(mockResolveConnector).toHaveBeenCalledWith(payload, {
      type: 'email_outbound',
      tenantId: 42,
    })
  })

  it('gracefully falls back when resolveConnector throws', async () => {
    mockResolveConnector.mockRejectedValue(new Error('DB unavailable'))
    const payload = makePayload()
    const result = await resolveEmailSender(payload, 1)
    expect(result.provider).toBe('payload-default')
  })
})

// ── resolveEmailSender — connector with unrecognized provider ─────────────────

describe('resolveEmailSender (unrecognized connector provider)', () => {
  it('falls back to payload-default when provider is unknown', async () => {
    mockResolveConnector.mockResolvedValue({
      id: 'conn-1',
      config: { provider: 'carrier-pigeon', fromAddress: 'pigeon@example.com' },
    })
    const payload = makePayload()
    const result = await resolveEmailSender(payload, 1)
    expect(result.provider).toBe('payload-default')
  })
})

// ── markConnectorError ────────────────────────────────────────────────────────

describe('markConnectorError', () => {
  it('does not throw when payload.update succeeds', async () => {
    const payload = makePayload()
    await expect(markConnectorError(payload, 'conn-1', 'Some error')).resolves.toBeUndefined()
  })

  it('does not throw when payload.update fails (non-critical)', async () => {
    const payload = makePayload({ update: vi.fn().mockRejectedValue(new Error('DB error')) })
    await expect(markConnectorError(payload, 'conn-1', 'error msg')).resolves.toBeUndefined()
  })

  it('calls payload.update with status: error', async () => {
    const payload = makePayload()
    await markConnectorError(payload, 'conn-abc', 'Timeout')
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'error', errorMessage: 'Timeout' }),
      }),
    )
  })
})
