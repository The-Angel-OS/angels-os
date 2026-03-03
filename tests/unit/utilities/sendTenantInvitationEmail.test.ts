/**
 * sendTenantInvitationEmail — Unit Tests
 *
 * Tests the tenant-level invitation email composition and dispatch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/utilities/resolveEmailSender', () => ({
  resolveEmailSender: vi.fn(),
}))

vi.mock('@/utilities/getURL', () => ({
  getServerSideURL: vi.fn(() => 'https://platform.example.com'),
}))

import { sendTenantInvitationEmail } from '@/utilities/sendTenantInvitationEmail'
import { resolveEmailSender } from '@/utilities/resolveEmailSender'

const mockResolveEmailSender = vi.mocked(resolveEmailSender)

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSendEmail() {
  return vi.fn().mockResolvedValue(undefined)
}

function makeSender(sendEmail = makeSendEmail()) {
  return {
    sendEmail,
    fromAddress: 'hello@platform.example.com',
    fromName: 'Angel OS',
    provider: 'payload-default' as const,
  }
}

const PAYLOAD = {} as any

const BASE_OPTS = {
  payload: PAYLOAD,
  tenantId: 1,
  recipientEmail: 'newmember@example.com',
  inviterName: 'Carol',
  enterpriseName: 'Acme Corp',
  inviteUrl: '/invite/tenant/abc',
  role: 'tenant_admin',
}

// ── sendTenantInvitationEmail ──────────────────────────────────────────────────

describe('sendTenantInvitationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveEmailSender.mockResolvedValue(makeSender())
  })

  it('returns true when email sends successfully', async () => {
    const result = await sendTenantInvitationEmail(BASE_OPTS)
    expect(result).toBe(true)
  })

  it('returns false when sendEmail throws', async () => {
    const sender = makeSender(vi.fn().mockRejectedValue(new Error('transport error')))
    mockResolveEmailSender.mockResolvedValue(sender)
    const result = await sendTenantInvitationEmail(BASE_OPTS)
    expect(result).toBe(false)
  })

  it('sends to the recipient email', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendTenantInvitationEmail(BASE_OPTS)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'newmember@example.com' }),
    )
  })

  it('subject includes inviter name and enterprise name', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendTenantInvitationEmail(BASE_OPTS)
    const { subject } = sendEmail.mock.calls[0][0]
    expect(subject).toContain('Carol')
    expect(subject).toContain('Acme Corp')
  })

  it('strips "tenant_" prefix from role label in HTML', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendTenantInvitationEmail({ ...BASE_OPTS, role: 'tenant_admin' })
    const { html } = sendEmail.mock.calls[0][0]
    // Role should appear as "admin" not "tenant_admin"
    expect(html).toContain('admin')
    expect(html).not.toContain('tenant_admin')
  })

  it('prepends server URL to relative inviteUrl', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendTenantInvitationEmail({ ...BASE_OPTS, inviteUrl: '/invite/tenant/xyz' })
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).toContain('https://platform.example.com/invite/tenant/xyz')
  })

  it('uses absolute inviteUrl as-is when it starts with http', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendTenantInvitationEmail({
      ...BASE_OPTS,
      inviteUrl: 'https://other.example.com/join/abc',
    })
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).toContain('https://other.example.com/join/abc')
    expect(html).not.toContain('platform.example.com/https://')
  })

  it('HTML-escapes XSS in inviter name', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendTenantInvitationEmail({ ...BASE_OPTS, inviterName: '<script>bad()</script>' })
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('includes personal message in HTML when provided', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendTenantInvitationEmail({ ...BASE_OPTS, message: 'Welcome to the team!' })
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).toContain('Welcome to the team!')
  })

  it('calls resolveEmailSender with the provided tenantId', async () => {
    await sendTenantInvitationEmail(BASE_OPTS)
    expect(mockResolveEmailSender).toHaveBeenCalledWith(PAYLOAD, 1)
  })
})
