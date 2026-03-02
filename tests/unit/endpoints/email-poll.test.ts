import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────

const mockLeoProcess = vi.fn().mockResolvedValue({
  text: 'Hi from LEO',
  agentName: 'LEO',
})

vi.mock('@/utilities/leoProcessMessage', () => ({
  leoProcessMessage: (...args: unknown[]) => mockLeoProcess(...args),
}))

// Mock ImapFlow class
const mockRelease = vi.fn()
const mockImapInstance = {
  connect: vi.fn().mockResolvedValue(undefined),
  getMailboxLock: vi.fn().mockResolvedValue({ release: mockRelease }),
  search: vi.fn().mockResolvedValue([]),
  fetchOne: vi.fn().mockResolvedValue(null),
  messageFlagsAdd: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
}
vi.mock('imapflow', () => ({
  ImapFlow: vi.fn().mockImplementation(() => mockImapInstance),
}))

// Mock mailparser — value inlined to avoid vi.mock hoisting issue
vi.mock('mailparser', () => ({
  simpleParser: vi.fn().mockResolvedValue({
    from: { value: [{ address: 'sender@example.com', name: 'Sender Name' }] },
    subject: 'Test Subject',
    text: 'Hello, this is a test email.',
    html: false,
    messageId: '<msg-123@example.com>',
    headers: new Map(),
  }),
}))

vi.mock('@/utilities/bridgeHelpers', () => ({
  findOrCreateBridgeChannel: vi.fn().mockResolvedValue({ id: 'ch-1', slug: 'email-sender-examplecom' }),
  markConnectorActive: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utilities/ensureSystemSpace', () => ({
  ensureDMSpace: vi.fn().mockResolvedValue(1),
}))

vi.mock('@/utilities/resolveConnector', () => ({
  findAllConnectors: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/utilities/logError', () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logCaughtError: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utilities/messageContent', () => ({
  wrapTextContent: vi.fn((text: string) => text),
}))

const mockSendEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('@/utilities/resolveEmailSender', () => ({
  resolveEmailSender: vi.fn().mockResolvedValue({
    sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  }),
}))

import { emailPollHandler } from '@/endpoints/email-poll'
import { simpleParser } from 'mailparser'

// ── Helpers ───────────────────────────────────────────────────

function makeReq(payload: unknown, headers?: Record<string, string>) {
  const request = new Request('http://localhost/api/email/poll', {
    method: 'GET',
    headers: headers || {},
  })
  return Object.assign(request, { payload }) as any
}

function makePayload(tenantDocs = [{ id: 1, slug: 'default' }]) {
  return {
    find: vi.fn().mockResolvedValue({ docs: tenantDocs }),
    findByID: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    update: vi.fn().mockResolvedValue({}),
  }
}

// ── Tests ─────────────────────────────────────────────────────

describe('emailPollHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
    delete process.env.SYSTEM_EMAIL_ADDRESS
    delete process.env.SYSTEM_EMAIL_PASSWORD
    delete process.env.SYSTEM_EMAIL_NAME
  })

  it('rejects unauthorized requests when CRON_SECRET is set', async () => {
    process.env.CRON_SECRET = 'my-secret'
    const payload = makePayload()
    const req = makeReq(payload, { authorization: 'Bearer wrong-secret' })

    const res = await emailPollHandler(req)
    expect(res.status).toBe(401)
  })

  it('returns 500 when no email sources configured', async () => {
    // No CRON_SECRET → auth skipped
    // No env vars + findAllConnectors returns [] → no email sources
    const payload = makePayload()
    const req = makeReq(payload)

    const res = await emailPollHandler(req)
    expect(res.status).toBe(500)
  })

  it('returns 404 when no default tenant found', async () => {
    process.env.SYSTEM_EMAIL_ADDRESS = 'hello@test.com'
    process.env.SYSTEM_EMAIL_PASSWORD = 'pass'
    // Payload returns empty tenant list
    const payload = makePayload([])
    const req = makeReq(payload)

    const res = await emailPollHandler(req)
    expect(res.status).toBe(404)
  })

  it('processes unseen emails via IMAP', async () => {
    process.env.SYSTEM_EMAIL_ADDRESS = 'hello@spacesangels.com'
    process.env.SYSTEM_EMAIL_PASSWORD = 'pass123'
    process.env.SYSTEM_EMAIL_NAME = 'Angel OS'

    const payload = makePayload()
    const req = makeReq(payload)

    // IMAP returns one unseen message
    mockImapInstance.search.mockResolvedValueOnce([42])
    mockImapInstance.fetchOne.mockResolvedValueOnce({
      source: Buffer.from('From: sender@example.com\r\nSubject: Test\r\n\r\nHello'),
    })

    const res = await emailPollHandler(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.processed).toBe(1)
    expect(mockLeoProcess).toHaveBeenCalled()
    expect(mockSendEmail).toHaveBeenCalled()
  })

  it('skips auto-reply emails', async () => {
    process.env.SYSTEM_EMAIL_ADDRESS = 'hello@spacesangels.com'
    process.env.SYSTEM_EMAIL_PASSWORD = 'pass123'

    const payload = makePayload()
    const req = makeReq(payload)

    mockImapInstance.search.mockResolvedValueOnce([42])
    mockImapInstance.fetchOne.mockResolvedValueOnce({
      source: Buffer.from('From: noreply@example.com\r\nSubject: Auto\r\n\r\nOOO'),
    })

    // simpleParser returns an auto-reply email (auto-submitted header)
    vi.mocked(simpleParser).mockResolvedValueOnce({
      from: { value: [{ address: 'noreply@example.com', name: 'No Reply' }] },
      subject: 'Automatic Reply: Out of Office',
      text: 'I am out of the office.',
      html: false,
      messageId: '<auto-123@example.com>',
      headers: new Map([['auto-submitted', 'auto-replied']]),
    } as any)

    const res = await emailPollHandler(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.processed).toBe(0)
    expect(mockLeoProcess).not.toHaveBeenCalled()
  })
})
