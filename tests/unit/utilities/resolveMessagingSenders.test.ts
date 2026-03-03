/**
 * resolveSlackSender / resolveWhatsAppSender / resolveSmsSender / resolveTelegramSender
 * — Unit Tests
 *
 * Tests the null/return paths for each resolver.
 * Real API calls (Slack, WhatsApp Cloud API, Twilio, Telegram Bot API) are not made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/utilities/resolveConnector', () => ({
  resolveConnector: vi.fn(),
  findAllConnectors: vi.fn(),
}))

vi.mock('@/utilities/outboundRetry', () => ({
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}))

vi.mock('@/utilities/logError', () => ({
  logError: vi.fn().mockReturnValue(Promise.resolve()),
  logCaughtError: vi.fn().mockReturnValue(Promise.resolve()),
}))

vi.mock('@/utilities/bridgeHelpers', () => ({
  markConnectorActive: vi.fn().mockResolvedValue(undefined),
  markConnectorError: vi.fn().mockResolvedValue(undefined),
  getSourceIcon: vi.fn(),
  getChannelSource: vi.fn(),
  getMessageType: vi.fn(),
}))

import { resolveSlackSender } from '@/utilities/resolveSlackSender'
import { resolveWhatsAppSender } from '@/utilities/resolveWhatsAppSender'
import { resolveSmsSender } from '@/utilities/resolveSmsSender'
import { resolveTelegramSender } from '@/utilities/resolveTelegramSender'
import { resolveConnector, findAllConnectors } from '@/utilities/resolveConnector'

const mockResolveConnector = vi.mocked(resolveConnector)
const mockFindAllConnectors = vi.mocked(findAllConnectors)

const PAYLOAD = {} as any

// ── resolveSlackSender ────────────────────────────────────────────────────────

describe('resolveSlackSender', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindAllConnectors.mockResolvedValue([])
  })

  it('returns null when no connectors found for tenant', async () => {
    mockFindAllConnectors.mockResolvedValue([])
    const result = await resolveSlackSender(PAYLOAD, 1)
    expect(result).toBeNull()
  })

  it('returns null when connector for other tenant found but not this one', async () => {
    mockFindAllConnectors.mockResolvedValue([
      { id: 'c1', tenantId: '99', config: { botToken: 'xoxb-test' } },
    ])
    const result = await resolveSlackSender(PAYLOAD, 1)
    expect(result).toBeNull()
  })

  it('returns null when connector found but botToken is missing', async () => {
    mockFindAllConnectors.mockResolvedValue([
      { id: 'c1', tenantId: '1', config: {} },
    ])
    const result = await resolveSlackSender(PAYLOAD, 1)
    expect(result).toBeNull()
  })

  it('returns resolved sender with correct shape when connector is valid', async () => {
    mockFindAllConnectors.mockResolvedValue([
      { id: 'c1', tenantId: '1', config: { botToken: 'xoxb-abc123' } },
    ])
    const result = await resolveSlackSender(PAYLOAD, 1)
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('slack')
    expect(result!.botToken).toBe('xoxb-abc123')
    expect(result!.connectorId).toBe('c1')
    expect(typeof result!.sendText).toBe('function')
  })
})

// ── resolveWhatsAppSender ─────────────────────────────────────────────────────

describe('resolveWhatsAppSender', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveConnector.mockResolvedValue(null)
  })

  it('returns null when no connector found', async () => {
    const result = await resolveWhatsAppSender(PAYLOAD, 1)
    expect(result).toBeNull()
  })

  it('returns null when phoneNumberId is missing', async () => {
    mockResolveConnector.mockResolvedValue({
      id: 'wa-1',
      config: { accessToken: 'EAAtest' },
    })
    const result = await resolveWhatsAppSender(PAYLOAD, 1)
    expect(result).toBeNull()
  })

  it('returns null when accessToken is missing', async () => {
    mockResolveConnector.mockResolvedValue({
      id: 'wa-1',
      config: { phoneNumberId: '12345' },
    })
    const result = await resolveWhatsAppSender(PAYLOAD, 1)
    expect(result).toBeNull()
  })

  it('returns resolved sender with correct shape when connector is valid', async () => {
    mockResolveConnector.mockResolvedValue({
      id: 'wa-1',
      config: { phoneNumberId: '12345', accessToken: 'EAAtest', businessName: 'TestCo' },
    })
    const result = await resolveWhatsAppSender(PAYLOAD, 1)
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('meta')
    expect(result!.connectorId).toBe('wa-1')
    expect(typeof result!.sendText).toBe('function')
  })
})

// ── resolveSmsSender ──────────────────────────────────────────────────────────

describe('resolveSmsSender', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveConnector.mockResolvedValue(null)
  })

  it('returns null when no connector found', async () => {
    const result = await resolveSmsSender(PAYLOAD, 1)
    expect(result).toBeNull()
  })

  it('returns null when required Twilio credentials are missing', async () => {
    mockResolveConnector.mockResolvedValue({
      id: 'sms-1',
      config: { accountSid: 'ACtest' }, // missing authToken and fromNumber
    })
    const result = await resolveSmsSender(PAYLOAD, 1)
    expect(result).toBeNull()
  })

  it('returns resolved sender with correct shape when all credentials are present', async () => {
    mockResolveConnector.mockResolvedValue({
      id: 'sms-1',
      config: {
        accountSid: 'ACtest123',
        authToken: 'auth456',
        fromNumber: '+15551234567',
      },
    })
    const result = await resolveSmsSender(PAYLOAD, 1)
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('twilio')
    expect(result!.fromNumber).toBe('+15551234567')
    expect(result!.connectorId).toBe('sms-1')
    expect(typeof result!.sendText).toBe('function')
  })
})

// ── resolveTelegramSender ─────────────────────────────────────────────────────

describe('resolveTelegramSender', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveConnector.mockResolvedValue(null)
  })

  it('returns null when no connector found', async () => {
    const result = await resolveTelegramSender(PAYLOAD, 1)
    expect(result).toBeNull()
  })

  it('returns null when botToken is missing', async () => {
    mockResolveConnector.mockResolvedValue({
      id: 'tg-1',
      config: { botUsername: 'mybot' }, // no botToken
    })
    const result = await resolveTelegramSender(PAYLOAD, 1)
    expect(result).toBeNull()
  })

  it('returns resolved sender with correct shape when connector is valid', async () => {
    mockResolveConnector.mockResolvedValue({
      id: 'tg-1',
      config: { botToken: 'bot123:ABCdef', botUsername: 'mybot' },
    })
    const result = await resolveTelegramSender(PAYLOAD, 1)
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('telegram')
    expect(result!.botUsername).toBe('mybot')
    expect(result!.connectorId).toBe('tg-1')
    expect(typeof result!.sendText).toBe('function')
  })
})
