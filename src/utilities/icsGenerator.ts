/**
 * ICS Calendar Event Generator
 *
 * Pure function: booking data → RFC 5545 ICS string.
 * No external dependencies — suitable for email attachments or download links.
 */

export interface ICSEventInput {
  uid: string
  summary: string
  description?: string
  startDateTime: Date | string
  endDateTime: Date | string
  location?: string
  organizerName?: string
  organizerEmail?: string
  attendeeName?: string
  attendeeEmail?: string
  url?: string
}

/**
 * Generate an ICS calendar string from booking data.
 * Returns a complete VCALENDAR with one VEVENT.
 */
export function generateICS(event: ICSEventInput): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Angel OS//Booking Engine//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${escapeICS(event.uid)}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(toDate(event.startDateTime))}`,
    `DTEND:${formatICSDate(toDate(event.endDateTime))}`,
    `SUMMARY:${escapeICS(event.summary)}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`)
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICS(event.location)}`)
  }

  if (event.organizerEmail) {
    const cn = event.organizerName ? `;CN=${escapeICS(event.organizerName)}` : ''
    lines.push(`ORGANIZER${cn}:mailto:${event.organizerEmail}`)
  }

  if (event.attendeeEmail) {
    const cn = event.attendeeName ? `;CN=${escapeICS(event.attendeeName)}` : ''
    lines.push(`ATTENDEE;RSVP=TRUE;PARTSTAT=NEEDS-ACTION${cn}:mailto:${event.attendeeEmail}`)
  }

  if (event.url) {
    lines.push(`URL:${event.url}`)
  }

  lines.push('STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR')

  return lines.join('\r\n') + '\r\n'
}

// ── Helpers ──────────────────────────────────────────────────────

function toDate(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d
}

/** Format a Date as ICS UTC timestamp: 20260302T140000Z */
export function formatICSDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  const s = String(date.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${d}T${h}${min}${s}Z`
}

/** Escape special characters per RFC 5545 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}
