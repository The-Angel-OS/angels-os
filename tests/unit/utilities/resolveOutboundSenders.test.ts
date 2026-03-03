/**
 * Outbound Sender Resolvers — Unit Tests
 *
 * Tests resolveSmsSender, resolveTelegramSender, resolveWhatsAppSender,
 * and resolveSlackSender. All follow the same pattern:
 *   - Look up a connector via resolveConnector (or findAllConnectors)
 *   - Return null when no connector found
 *   - Return a typed sender object with provider metadata
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Shared mocks ──────────────────────────────────────────────────────────────

vi.mock('@/utilities/resolveConnector', () => ({
  resolveConnector: vi.fn(),
  findAllConnectors: vi.fn(),
}))
vi.mock('@/utilities/bridgeHelpers', () => ({
  markConnectorActive: vi.fn().mockResolvedValue(undefined),
  markConnectorError: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/utilities/logError', () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logCaughtError: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/utilities/outboundRetry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

import { resolveConnector, findAllConnectors } from '@/utilities/resolveConnector'
import { resolveSmsSender } from '@/utilities/resolveSmsSender'
import { resolveTelegramSender } from '@/utilities/resolveTelegramSender'
import { resolveWhatsAppSender } from '@/utilities/resolveWhatsAppSender'
import { resolveSlackSender } from '@/utilities/resolveSlackSender'

const mockedResolveConnector = vi.mocked(resolveConnector)
const mockedFindAllConnectors = vi.mocked(findAllConnectors)

/** Minimal fake Payload instance */
const payload = { find: vi.fn(), update: vi.fn() } as any

// ── resolveSmsSender ──────────────────────────────────────────────────────────

describe('resolveSmsSender', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no SMS connector is found', async () => {
    mockedResolveConnector.mockResolvedValue(null)
    const result = await resolveSmsSender(payload, 1)
    expect(result).toBeNull()
  })

  it('returns null when connector is missing required fields', async () => {
    mockedResolveConnector.mockResolvedValue({
      id: 'c1',
      config: { accountSid: '', authToken: '', fromNumber: '' },
    } as any)
    const result = await resolveSmsSender(payload, 1)
    expect(result).toBeNull()
  })

  it('returns a sender with correct metadata when connector is valid', async () => {
    mockedResolveConnector.mockResolvedValue({
      id: 'c1',
      config: { accountSid: 'AC123', authToken: 'tok', fromNumber: '+15551234567' },
    } as any)
    const result = await resolveSmsSender(payload, 1)
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('twilio')
    expect(result!.fromNumber).toBe('+15551234567')
    expect(result!.connectorId).toBe('c1')
    expect(typeof result!.sendText).toBe('function')
  })

  it('passes tenantId and spaceId to resolveConnector', async () => {
    mockedResolveConnector.mockResolvedValue(null)
    await resolveSmsSender(payload, 42, 99)
    expect(mockedResolveConnector).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ type: 'sms', tenantId: 42, spaceId: 99 }),
    )
  })
})

// ── resolveTelegramSender ─────────────────────────────────────────────────────

describe('resolveTelegramSender', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no Telegram connector is found', async () => {
    mockedResolveConnector.mockResolvedValue(null)
    const result = await resolveTelegramSender(payload, 1)
    expect(result).toBeNull()
  })

  it('returns null when connector is missing botToken', async () => {
    mockedResolveConnector.mockResolvedValue({
      id: 'c2',
      config: { botToken: '', botUsername: 'mybot' },
    } as any)
    const result = await resolveTelegramSender(payload, 1)
    expect(result).toBeNull()
  })

  it('returns a sender with correct metadata when connector is valid', async () => {
    mockedResolveConnector.mockResolvedValue({
      id: 'c2',
      config: { botToken: 'tg-secret', botUsername: 'angelbot' },
    } as any)
    const result = await resolveTelegramSender(payload, 1)
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('telegram')
    expect(result!.botUsername).toBe('angelbot')
    expect(result!.connectorId).toBe('c2')
    expect(typeof result!.sendText).toBe('function')
  })

  it('passes tenantId and spaceId to resolveConnector', async () => {
    mockedResolveConnector.mockResolvedValue(null)
    await resolveTelegramSender(payload, 7, 22)
    expect(mockedResolveConnector).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ type: 'telegram', tenantId: 7, spaceId: 22 }),
    )
  })
})

// ── resolveWhatsAppSender ─────────────────────────────────────────────────────

describe('resolveWhatsAppSender', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no WhatsApp connector is found', async () => {
    mockedResolveConnector.mockResolvedValue(null)
    const result = await resolveWhatsAppSender(payload, 1)
    expect(result).toBeNull()
  })

  it('returns a sender with correct metadata when connector is valid', async () => {
    mockedResolveConnector.mockResolvedValue({
      id: 'c3',
      config: {
        phoneNumberId: 'ph1',
        accessToken: 'wa-tok',
        businessAccountId: 'biz1',
        verifyToken: 'verify',
      },
    } as any)
    const result = await resolveWhatsAppSender(payload, 1)
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('meta')
    expect(result!.connectorId).toBe('c3')
    expect(typeof result!.sendText).toBe('function')
  })

  it('passes the correct connector type to resolveConnector', async () => {
    mockedResolveConnector.mockResolvedValue(null)
    await resolveWhatsAppSender(payload, 5)
    expect(mockedResolveConnector).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ type: 'whatsapp', tenantId: 5 }),
    )
  })
})

// ── resolveSlackSender ────────────────────────────────────────────────────────

describe('resolveSlackSender', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no Slack connectors exist', async () => {
    mockedFindAllConnectors.mockResolvedValue([])
    const result = await resolveSlackSender(payload, 1)
    expect(result).toBeNull()
  })

  it('returns null when no connector matches the tenantId', async () => {
    mockedFindAllConnectors.mockResolvedValue([
      { id: 'c4', tenantId: 99, config: { botToken: 'tok' } } as any,
    ])
    const result = await resolveSlackSender(payload, 1) // different tenant
    expect(result).toBeNull()
  })

  it('returns null when the matching connector has no botToken', async () => {
    mockedFindAllConnectors.mockResolvedValue([
      { id: 'c4', tenantId: 1, config: { botToken: '' } } as any,
    ])
    const result = await resolveSlackSender(payload, 1)
    expect(result).toBeNull()
  })

  it('returns a sender with correct metadata when connector is valid', async () => {
    mockedFindAllConnectors.mockResolvedValue([
      { id: 'c4', tenantId: 1, config: { botToken: 'xoxb-abc' } } as any,
    ])
    const result = await resolveSlackSender(payload, 1)
    expect(result).not.toBeNull()
    expect(result!.provider).toBe('slack')
    expect(result!.botToken).toBe('xoxb-abc')
    expect(result!.connectorId).toBe('c4')
    expect(typeof result!.sendText).toBe('function')
  })

  it('calls findAllConnectors with type slack', async () => {
    mockedFindAllConnectors.mockResolvedValue([])
    await resolveSlackSender(payload, 3)
    expect(mockedFindAllConnectors).toHaveBeenCalledWith(payload, 'slack')
  })
})
