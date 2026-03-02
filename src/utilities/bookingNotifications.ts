/**
 * Booking Notifications — multi-channel confirmation sender.
 *
 * Called after a booking is created to:
 *   1. Email confirmation with ICS calendar attachment
 *   2. Optional WhatsApp / SMS if the client has a phone number and the tenant has a connector
 *   3. Initialize a LEO conversation thread for follow-up
 *
 * Failures are logged but never bubble — a failed notification must not block booking creation.
 */
import type { Payload } from 'payload'
import { generateICS } from '@/utilities/icsGenerator'
import { resolveEmailSender } from '@/utilities/resolveEmailSender'
import { resolveWhatsAppSender } from '@/utilities/resolveWhatsAppSender'
import { resolveSmsSender } from '@/utilities/resolveSmsSender'
import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { findOrCreateBridgeChannel } from '@/utilities/bridgeHelpers'
import { logCaughtError } from '@/utilities/logError'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BookingDoc = Record<string, any>

export async function sendBookingConfirmation(
  payload: Payload,
  booking: BookingDoc,
  tenantId: number | string,
): Promise<{ emailSent: boolean; smsSent: boolean; whatsappSent: boolean; leoThreadId: string | null }> {
  const result = { emailSent: false, smsSent: false, whatsappSent: false, leoThreadId: null as string | null }

  // ── Resolve client ──────────────────────────────────────────
  const clientId = typeof booking.client === 'object' ? booking.client?.id : booking.client
  const providerId = typeof booking.provider === 'object' ? booking.provider?.id : booking.provider

  let client: BookingDoc | null = null
  let provider: BookingDoc | null = null
  try {
    ;[client, provider] = await Promise.all([
      clientId
        ? payload.findByID({ collection: 'users' as 'payload-locked-documents', id: String(clientId), depth: 0, overrideAccess: true })
        : null,
      providerId
        ? payload.findByID({ collection: 'users' as 'payload-locked-documents', id: String(providerId), depth: 0, overrideAccess: true })
        : null,
    ])
  } catch (err) {
    logCaughtError('booking-notifications/resolve-users', err, { tenantId })
    return result
  }

  if (!client) return result

  const clientEmail = (client as BookingDoc).email as string | undefined
  const clientPhone = (client as BookingDoc).phoneNumber as string | undefined
  const clientName = (client as BookingDoc).name as string || 'Guest'
  const providerName = (provider as BookingDoc)?.name as string || 'Provider'

  const startDate = new Date(booking.startDateTime)
  const endDate = new Date(booking.endDateTime)
  const formattedDate = startDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const formattedTime = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  // ── 1. Email confirmation with ICS ─────────────────────────
  if (clientEmail) {
    try {
      const emailSender = await resolveEmailSender(payload, tenantId)

      const icsString = generateICS({
        uid: `booking-${booking.id}@angel-os`,
        summary: booking.title || 'Booking Confirmation',
        description: `${booking.title} with ${providerName}\nDuration: ${booking.duration} minutes`,
        startDateTime: startDate,
        endDateTime: endDate,
        location: booking.location?.address || booking.location?.remoteDetails?.meetingLink,
        organizerName: providerName,
        organizerEmail: (provider as BookingDoc)?.email,
        attendeeName: clientName,
        attendeeEmail: clientEmail,
      })

      const icsBase64 = Buffer.from(icsString).toString('base64')

      await emailSender.sendEmail({
        to: clientEmail,
        subject: `Booking Confirmed: ${booking.title}`,
        html: buildConfirmationHTML(booking, clientName, providerName, formattedDate, formattedTime),
        text: `Hi ${clientName},\n\nYour booking "${booking.title}" with ${providerName} is confirmed for ${formattedDate} at ${formattedTime}.\n\nDuration: ${booking.duration} minutes\n${booking.location?.address ? `Location: ${booking.location.address}` : ''}\n\nSee you then!`,
        attachments: [{
          filename: 'booking.ics',
          content: icsBase64,
          contentType: 'text/calendar',
        }],
      } as any) // attachments field extends EmailMessage

      result.emailSent = true
    } catch (err) {
      logCaughtError('booking-notifications/email', err, { tenantId })
    }
  }

  // ── 2. WhatsApp / SMS (if client has phone + connector exists) ──
  if (clientPhone) {
    const shortMsg = `Hi ${clientName}! Your booking "${booking.title}" with ${providerName} is confirmed for ${formattedDate} at ${formattedTime}. Duration: ${booking.duration}min.`

    // Try WhatsApp first, then SMS
    try {
      const waSender = await resolveWhatsAppSender(payload, tenantId)
      if (waSender) {
        await waSender.sendText(clientPhone, shortMsg)
        result.whatsappSent = true
      }
    } catch (err) {
      logCaughtError('booking-notifications/whatsapp', err, { tenantId })
    }

    if (!result.whatsappSent) {
      try {
        const smsSender = await resolveSmsSender(payload, tenantId)
        if (smsSender) {
          await smsSender.sendText(clientPhone, shortMsg)
          result.smsSent = true
        }
      } catch (err) {
        logCaughtError('booking-notifications/sms', err, { tenantId })
      }
    }
  }

  // ── 3. Initialize LEO conversation thread ──────────────────
  try {
    const dmSpaceId = await ensureDMSpace(tenantId)
    if (dmSpaceId) {
      const channel = await findOrCreateBridgeChannel(payload, {
        tenantId,
        dmSpaceId: typeof dmSpaceId === 'string' ? parseInt(dmSpaceId, 10) : dmSpaceId,
        slug: `booking-${booking.id}`,
        displayName: `Booking: ${booking.title}`,
        source: 'system',
        description: `Conversation thread for booking ${booking.id}`,
      })
      result.leoThreadId = channel?.channelId || null
    }
  } catch (err) {
    logCaughtError('booking-notifications/leo-thread', err, { tenantId })
  }

  // ── 4. Update booking record with notification status ──────
  try {
    const updateData: Record<string, unknown> = {
      notifications: {
        confirmationSent: result.emailSent || result.smsSent || result.whatsappSent,
        reminderSent: false,
        followUpSent: false,
      },
    }
    if (result.leoThreadId) {
      updateData['integration.leoConversationId'] = result.leoThreadId
    }
    await payload.update({
      collection: 'bookings' as 'payload-locked-documents',
      id: booking.id,
      data: updateData as any,
      overrideAccess: true,
    })
  } catch (err) {
    logCaughtError('booking-notifications/update-booking', err, { tenantId })
  }

  return result
}

// ── HTML Template ────────────────────────────────────────────────

function buildConfirmationHTML(
  booking: BookingDoc,
  clientName: string,
  providerName: string,
  formattedDate: string,
  formattedTime: string,
): string {
  const locationBlock = booking.location?.address
    ? `<p><strong>Location:</strong> ${escapeHtml(booking.location.address)}</p>`
    : booking.location?.remoteDetails?.meetingLink
      ? `<p><strong>Meeting Link:</strong> <a href="${escapeHtml(booking.location.remoteDetails.meetingLink)}">${escapeHtml(booking.location.remoteDetails.platform || 'Join Meeting')}</a></p>`
      : ''

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Booking Confirmed</h2>
      <p>Hi ${escapeHtml(clientName)},</p>
      <p>Your booking has been confirmed. Here are the details:</p>
      <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>${escapeHtml(booking.title || 'Booking')}</strong></p>
        <p style="margin: 4px 0;">with ${escapeHtml(providerName)}</p>
        <p style="margin: 4px 0;">${escapeHtml(formattedDate)} at ${escapeHtml(formattedTime)}</p>
        <p style="margin: 4px 0;">Duration: ${booking.duration} minutes</p>
        ${locationBlock}
      </div>
      <p>A calendar event is attached to this email. Add it to your calendar so you don't miss it!</p>
      <p style="color: #666; font-size: 14px;">— Angel OS</p>
    </div>
  `.trim()
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
