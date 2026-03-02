import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────

const mockSendEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('@/utilities/resolveEmailSender', () => ({
  resolveEmailSender: vi.fn().mockResolvedValue({
    sendEmail: (...args: unknown[]) => mockSendEmail(...args),
    fromAddress: 'noreply@test.com',
    fromName: 'Test',
    provider: 'resend',
  }),
}))

const mockSendWhatsApp = vi.fn().mockResolvedValue(undefined)
vi.mock('@/utilities/resolveWhatsAppSender', () => ({
  resolveWhatsAppSender: vi.fn().mockResolvedValue({
    sendText: (...args: unknown[]) => mockSendWhatsApp(...args),
    phoneNumberId: 'pn-1',
    businessName: 'Test Business',
    provider: 'meta',
    connectorId: 'conn-wa-1',
  }),
}))

const mockSendSms = vi.fn().mockResolvedValue(undefined)
vi.mock('@/utilities/resolveSmsSender', () => ({
  resolveSmsSender: vi.fn().mockResolvedValue({
    sendText: (...args: unknown[]) => mockSendSms(...args),
    fromNumber: '+15550001111',
    provider: 'twilio',
    connectorId: 'conn-sms-1',
  }),
}))

vi.mock('@/utilities/ensureSystemSpace', () => ({
  ensureDMSpace: vi.fn().mockResolvedValue('space-1'),
}))

vi.mock('@/utilities/bridgeHelpers', () => ({
  findOrCreateBridgeChannel: vi.fn().mockResolvedValue({ channelId: 'ch-booking-1', isNew: true }),
}))

vi.mock('@/utilities/logError', () => ({
  logCaughtError: vi.fn(),
}))

vi.mock('@/utilities/icsGenerator', () => ({
  generateICS: vi.fn().mockReturnValue('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'),
}))

import { sendBookingConfirmation } from '@/utilities/bookingNotifications'
import { resolveWhatsAppSender } from '@/utilities/resolveWhatsAppSender'
import { resolveSmsSender } from '@/utilities/resolveSmsSender'
import { logCaughtError } from '@/utilities/logError'
import { generateICS } from '@/utilities/icsGenerator'

// ── Helpers ───────────────────────────────────────────────────

function makePayload(clientData?: Record<string, unknown>, providerData?: Record<string, unknown>) {
  const client = { id: '10', email: 'alice@example.com', name: 'Alice', phoneNumber: '+15551234567', ...clientData }
  const provider = { id: '20', email: 'bob@clinic.com', name: 'Dr. Bob', ...providerData }

  return {
    findByID: vi.fn().mockImplementation(({ id }: { id: string }) => {
      if (id === '10') return Promise.resolve(client)
      if (id === '20') return Promise.resolve(provider)
      return Promise.resolve(null)
    }),
    update: vi.fn().mockResolvedValue({}),
  } as any
}

function makeBooking(overrides?: Record<string, unknown>) {
  return {
    id: 'booking-1',
    title: 'Massage Session',
    bookingType: 'service',
    provider: '20',
    client: '10',
    startDateTime: '2026-03-15T14:00:00Z',
    endDateTime: '2026-03-15T15:00:00Z',
    duration: 60,
    location: { type: 'provider', address: '123 Main St' },
    status: 'pending',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────

describe('sendBookingConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends email confirmation with ICS attachment', async () => {
    const payload = makePayload()
    const booking = makeBooking()

    const result = await sendBookingConfirmation(payload, booking, 1)

    expect(result.emailSent).toBe(true)
    expect(mockSendEmail).toHaveBeenCalledTimes(1)

    const emailArg = mockSendEmail.mock.calls[0][0]
    expect(emailArg.to).toBe('alice@example.com')
    expect(emailArg.subject).toContain('Massage Session')
    expect(emailArg.html).toContain('Booking Confirmed')
    expect(emailArg.text).toContain('Alice')
    expect(emailArg.attachments).toBeDefined()
    expect(emailArg.attachments[0].filename).toBe('booking.ics')
  })

  it('generates ICS with correct booking data', async () => {
    const payload = makePayload()
    const booking = makeBooking()

    await sendBookingConfirmation(payload, booking, 1)

    expect(generateICS).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'booking-booking-1@angel-os',
        summary: 'Massage Session',
        attendeeEmail: 'alice@example.com',
        organizerEmail: 'bob@clinic.com',
      }),
    )
  })

  it('sends WhatsApp when client has phone number', async () => {
    const payload = makePayload()
    const booking = makeBooking()

    const result = await sendBookingConfirmation(payload, booking, 1)

    expect(result.whatsappSent).toBe(true)
    expect(mockSendWhatsApp).toHaveBeenCalledTimes(1)
    expect(mockSendWhatsApp).toHaveBeenCalledWith('+15551234567', expect.stringContaining('Massage Session'))
  })

  it('falls back to SMS when WhatsApp is unavailable', async () => {
    vi.mocked(resolveWhatsAppSender).mockResolvedValueOnce(null)

    const payload = makePayload()
    const booking = makeBooking()

    const result = await sendBookingConfirmation(payload, booking, 1)

    expect(result.whatsappSent).toBe(false)
    expect(result.smsSent).toBe(true)
    expect(mockSendSms).toHaveBeenCalledWith('+15551234567', expect.stringContaining('Massage Session'))
  })

  it('skips phone notifications when client has no phone', async () => {
    const payload = makePayload({ phoneNumber: undefined })
    const booking = makeBooking()

    const result = await sendBookingConfirmation(payload, booking, 1)

    expect(result.emailSent).toBe(true)
    expect(result.whatsappSent).toBe(false)
    expect(result.smsSent).toBe(false)
    expect(mockSendWhatsApp).not.toHaveBeenCalled()
    expect(mockSendSms).not.toHaveBeenCalled()
  })

  it('initializes LEO conversation thread', async () => {
    const payload = makePayload()
    const booking = makeBooking()

    const result = await sendBookingConfirmation(payload, booking, 1)

    expect(result.leoThreadId).toBe('ch-booking-1')
  })

  it('updates booking with notification status', async () => {
    const payload = makePayload()
    const booking = makeBooking()

    await sendBookingConfirmation(payload, booking, 1)

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'bookings',
        id: 'booking-1',
        data: expect.objectContaining({
          notifications: expect.objectContaining({
            confirmationSent: true,
          }),
        }),
      }),
    )
  })

  it('handles email failure gracefully without blocking', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('SMTP down'))

    const payload = makePayload()
    const booking = makeBooking()

    const result = await sendBookingConfirmation(payload, booking, 1)

    expect(result.emailSent).toBe(false)
    expect(result.whatsappSent).toBe(true) // other channels still attempted
    expect(logCaughtError).toHaveBeenCalledWith('booking-notifications/email', expect.any(Error), expect.any(Object))
  })

  it('returns empty result when client cannot be resolved', async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    } as any

    const booking = makeBooking()
    const result = await sendBookingConfirmation(payload, booking, 1)

    expect(result.emailSent).toBe(false)
    expect(result.smsSent).toBe(false)
    expect(result.whatsappSent).toBe(false)
    expect(result.leoThreadId).toBeNull()
  })

  it('includes location in email when remote', async () => {
    const payload = makePayload()
    const booking = makeBooking({
      location: {
        type: 'remote',
        remoteDetails: { platform: 'zoom', meetingLink: 'https://zoom.us/j/123' },
      },
    })

    await sendBookingConfirmation(payload, booking, 1)

    const emailArg = mockSendEmail.mock.calls[0][0]
    expect(emailArg.html).toContain('zoom.us/j/123')
  })
})
