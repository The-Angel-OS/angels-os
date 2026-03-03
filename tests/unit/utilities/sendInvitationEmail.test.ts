/**
 * sendInvitationEmail — Unit Tests
 *
 * Tests the email composition and dispatch logic.
 * Real email transport is replaced by a mock sender.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/utilities/resolveEmailSender', () => ({
  resolveEmailSender: vi.fn(),
}))

vi.mock('@/utilities/getURL', () => ({
  getServerSideURL: vi.fn(() => 'https://app.example.com'),
}))

import { sendInvitationEmail } from '@/utilities/sendInvitationEmail'
import { resolveEmailSender } from '@/utilities/resolveEmailSender'

const mockResolveEmailSender = vi.mocked(resolveEmailSender)

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSendEmail() {
  return vi.fn().mockResolvedValue(undefined)
}

function makeSender(sendEmail = makeSendEmail()) {
  return {
    sendEmail,
    fromAddress: 'hello@example.com',
    fromName: 'Angel OS',
    provider: 'payload-default' as const,
  }
}

const PAYLOAD = {} as any

const BASE_OPTS = {
  payload: PAYLOAD,
  tenantId: 1,
  recipientEmail: 'user@example.com',
  inviterName: 'Alice',
  spaceName: 'The Hub',
  inviteUrl: '/invite/abc123',
  role: 'member',
}

// ── sendInvitationEmail ────────────────────────────────────────────────────────

describe('sendInvitationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const sender = makeSender()
    mockResolveEmailSender.mockResolvedValue(sender)
  })

  it('returns true when email sends successfully', async () => {
    const result = await sendInvitationEmail(BASE_OPTS)
    expect(result).toBe(true)
  })

  it('returns false when sendEmail throws', async () => {
    const sender = makeSender(vi.fn().mockRejectedValue(new Error('SMTP down')))
    mockResolveEmailSender.mockResolvedValue(sender)
    const result = await sendInvitationEmail(BASE_OPTS)
    expect(result).toBe(false)
  })

  it('calls sender.sendEmail with the recipient email', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendInvitationEmail(BASE_OPTS)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com' }),
    )
  })

  it('subject includes inviter name and space name', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendInvitationEmail(BASE_OPTS)
    const { subject } = sendEmail.mock.calls[0][0]
    expect(subject).toContain('Alice')
    expect(subject).toContain('The Hub')
  })

  it('prepends server URL to relative inviteUrl', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendInvitationEmail({ ...BASE_OPTS, inviteUrl: '/invite/xyz' })
    const { html, text } = sendEmail.mock.calls[0][0]
    expect(html).toContain('https://app.example.com/invite/xyz')
    expect(text).toContain('https://app.example.com/invite/xyz')
  })

  it('uses absolute inviteUrl as-is when it starts with http', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendInvitationEmail({
      ...BASE_OPTS,
      inviteUrl: 'https://custom.example.com/invite/abc',
    })
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).toContain('https://custom.example.com/invite/abc')
    // Should NOT double-prepend the server URL
    expect(html).not.toContain('https://app.example.com/https://')
  })

  it('includes personal message in HTML when provided', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendInvitationEmail({ ...BASE_OPTS, message: 'Looking forward to it!' })
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).toContain('Looking forward to it!')
  })

  it('HTML-escapes XSS in inviter name', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendInvitationEmail({ ...BASE_OPTS, inviterName: '<script>alert(1)</script>' })
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('HTML-escapes XSS in space name', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendInvitationEmail({ ...BASE_OPTS, spaceName: '"><img src=x onerror=alert(1)>' })
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('includes tenant name in HTML when provided', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendInvitationEmail({ ...BASE_OPTS, tenantName: 'Acme Corp' })
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).toContain('Acme Corp')
  })

  it('calls resolveEmailSender with payload and tenantId', async () => {
    await sendInvitationEmail(BASE_OPTS)
    expect(mockResolveEmailSender).toHaveBeenCalledWith(PAYLOAD, 1)
  })
})
