/**
 * verifyOtpSms — the phone-invite branch.
 *
 * Both cases here are regressions from 260805, when David C signed in by text
 * and got "19497350665@phone.invalid" while davidc@neurocarepro.com sat on the
 * very invitation row being read — and no Angel portal, because the SMS path
 * was the one door that skipped the onboarding floor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockEnsureBaseline = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const mockMint = vi.hoisted(() => vi.fn().mockResolvedValue({ token: 'tok' }))

vi.mock('@/utilities/ensureBaselineMemberships', () => ({
  ensureBaselineMemberships: mockEnsureBaseline,
}))
vi.mock('@/utilities/mintSession', () => ({ mintSessionToken: mockMint }))
vi.mock('@/utilities/autoActivatePendingMembership', () => ({
  autoActivatePendingMembership: vi.fn().mockResolvedValue(undefined),
}))

import { verifyOtpSms } from '@/utilities/otpLogin'

const PHONE = '+19497350665'
const INVITE_EMAIL = 'davidc@neurocarepro.com'

/** An invite row carrying both the admin-typed email and the phone. */
function inviteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 181,
    tenant: 30,
    invitationDetails: {
      invitationEmail: INVITE_EMAIL,
      invitationPhone: PHONE,
      invitationName: 'David Christenson',
    },
    ...overrides,
  }
}

/**
 * @param userDocs what `users` lookups return, in call order
 *                 (1st = by phone, 2nd = by invited email)
 */
function makePayload(userDocs: unknown[][], inviteDocs: unknown[]) {
  const calls = [...userDocs]
  return {
    find: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'users') return { docs: calls.shift() ?? [], totalDocs: 0 }
      if (collection === 'tenant-memberships') return { docs: inviteDocs, totalDocs: inviteDocs.length }
      return { docs: [], totalDocs: 0 }
    }),
    create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 999,
      ...data,
    })),
    update: vi.fn().mockImplementation(async ({ id, data }: { id: number; data: Record<string, unknown> }) => ({
      id,
      email: INVITE_EMAIL,
      ...data,
    })),
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    secret: 'test-secret',
  } as never
}

describe('verifyOtpSms — invite branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TWILIO_ACCOUNT_SID = 'AC_test'
    process.env.TWILIO_AUTH_TOKEN = 'tok_test'
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VA_test'
    // Twilio Verify approves the code.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'approved' }) }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_VERIFY_SERVICE_SID
  })

  it('creates the account under the INVITATION email, never a phone.invalid placeholder', async () => {
    const payload = makePayload([[], []], [inviteRow()])
    const res = await verifyOtpSms(payload, PHONE, '123456')

    expect(res.ok).toBe(true)
    const created = (payload as never as { create: { mock: { calls: any[][] } } }).create.mock.calls[0][0]
    expect(created.data.email).toBe(INVITE_EMAIL)
    expect(created.data.email).not.toContain('phone.invalid')
    expect(created.data.phone).toBe(PHONE)
    expect(created.data.name).toBe('David Christenson')
  })

  it('links the phone to an EXISTING account with that email instead of creating a rival', async () => {
    const existing = { id: 77, email: INVITE_EMAIL, name: 'David Christenson' }
    // 1st users lookup (by phone) misses; 2nd (by invited email) hits.
    const payload = makePayload([[], [existing]], [inviteRow()])
    const res = await verifyOtpSms(payload, PHONE, '123456')

    expect(res.ok).toBe(true)
    expect((payload as never as { create: { mock: { calls: unknown[] } } }).create).not.toHaveBeenCalled()
    const upd = (payload as never as { update: { mock: { calls: any[][] } } }).update.mock.calls[0][0]
    expect(upd.id).toBe(77)
    expect(upd.data.phone).toBe(PHONE)
  })

  it('falls back to the placeholder only when the invite carries no email', async () => {
    const noEmail = inviteRow({
      invitationDetails: { invitationPhone: PHONE, invitationName: 'Vlad' },
    })
    const payload = makePayload([[], []], [noEmail])
    await verifyOtpSms(payload, PHONE, '123456')

    const created = (payload as never as { create: { mock: { calls: any[][] } } }).create.mock.calls[0][0]
    expect(created.data.email).toBe('19497350665@phone.invalid')
  })

  it('grants the onboarding floor — the Angel portal — on the SMS path', async () => {
    const payload = makePayload([[{ id: 5, email: 'a@b.com' }]], [])
    const res = await verifyOtpSms(payload, PHONE, '123456')

    expect(res.ok).toBe(true)
    expect(mockEnsureBaseline).toHaveBeenCalledOnce()
    expect(mockEnsureBaseline.mock.calls[0][1]).toMatchObject({ id: 5 })
  })

  it('still refuses an unknown phone with no invite', async () => {
    const payload = makePayload([[]], [])
    const res = await verifyOtpSms(payload, PHONE, '123456')

    expect(res.ok).toBe(false)
    expect((payload as never as { create: { mock: { calls: unknown[] } } }).create).not.toHaveBeenCalled()
  })
})
