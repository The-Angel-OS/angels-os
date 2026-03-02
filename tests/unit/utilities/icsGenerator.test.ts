import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateICS, formatICSDate } from '@/utilities/icsGenerator'

describe('formatICSDate', () => {
  it('formats a UTC date correctly', () => {
    const date = new Date('2026-03-15T14:30:00Z')
    expect(formatICSDate(date)).toBe('20260315T143000Z')
  })

  it('pads single-digit values', () => {
    const date = new Date('2026-01-05T09:05:02Z')
    expect(formatICSDate(date)).toBe('20260105T090502Z')
  })
})

describe('generateICS', () => {

  it('generates minimal valid VCALENDAR', () => {
    const ics = generateICS({
      uid: 'booking-123@angel-os',
      summary: 'Massage Session',
      startDateTime: new Date('2026-03-15T14:00:00Z'),
      endDateTime: new Date('2026-03-15T15:00:00Z'),
    })

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('UID:booking-123@angel-os')
    expect(ics).toContain('SUMMARY:Massage Session')
    expect(ics).toContain('DTSTART:20260315T140000Z')
    expect(ics).toContain('DTEND:20260315T150000Z')
    expect(ics).toContain('STATUS:CONFIRMED')
    expect(ics).toContain('METHOD:REQUEST')
  })

  it('includes optional fields when provided', () => {
    const ics = generateICS({
      uid: 'booking-456@angel-os',
      summary: 'Consultation',
      description: 'Follow-up appointment',
      startDateTime: '2026-03-20T10:00:00Z',
      endDateTime: '2026-03-20T10:30:00Z',
      location: '123 Main St',
      organizerName: 'Dr. Smith',
      organizerEmail: 'smith@clinic.com',
      attendeeName: 'John Doe',
      attendeeEmail: 'john@example.com',
      url: 'https://clinic.com/booking/456',
    })

    expect(ics).toContain('DESCRIPTION:Follow-up appointment')
    expect(ics).toContain('LOCATION:123 Main St')
    expect(ics).toContain('ORGANIZER;CN=Dr. Smith:mailto:smith@clinic.com')
    expect(ics).toContain('ATTENDEE;RSVP=TRUE;PARTSTAT=NEEDS-ACTION;CN=John Doe:mailto:john@example.com')
    expect(ics).toContain('URL:https://clinic.com/booking/456')
  })

  it('escapes special characters in text fields', () => {
    const ics = generateICS({
      uid: 'booking-789@angel-os',
      summary: 'Meeting; with, commas',
      description: 'Line 1\nLine 2',
      startDateTime: new Date('2026-03-15T14:00:00Z'),
      endDateTime: new Date('2026-03-15T15:00:00Z'),
    })

    expect(ics).toContain('SUMMARY:Meeting\\; with\\, commas')
    expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2')
  })

  it('accepts ISO string dates', () => {
    const ics = generateICS({
      uid: 'booking-str@angel-os',
      summary: 'String Date Test',
      startDateTime: '2026-06-01T08:00:00Z',
      endDateTime: '2026-06-01T09:00:00Z',
    })

    expect(ics).toContain('DTSTART:20260601T080000Z')
    expect(ics).toContain('DTEND:20260601T090000Z')
  })

  it('uses CRLF line endings per RFC 5545', () => {
    const ics = generateICS({
      uid: 'crlf-test@angel-os',
      summary: 'CRLF Test',
      startDateTime: new Date('2026-03-15T14:00:00Z'),
      endDateTime: new Date('2026-03-15T15:00:00Z'),
    })

    expect(ics).toMatch(/\r\n/)
    expect(ics.endsWith('\r\n')).toBe(true)
  })
})
