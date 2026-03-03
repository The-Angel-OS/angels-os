/**
 * AppointmentMessageService — Unit Tests
 *
 * Tests the pure appointmentToCalendarEvent transformation and
 * fetch-based CRUD methods via stubbed global.fetch.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  AppointmentMessageService,
  type AppointmentEvent,
} from '@/utilities/AppointmentMessageService'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAppointment(overrides: Partial<AppointmentEvent> = {}): AppointmentEvent {
  return {
    id: 'appt-1',
    title: 'Screen Print Consultation',
    startTime: '2026-03-10T09:00:00.000Z',
    endTime: '2026-03-10T10:00:00.000Z',
    appointmentType: 'consultation',
    status: 'scheduled',
    organizer: { id: 42 },
    meetingType: 'in_person',
    ...overrides,
  }
}

function mockFetch(ok: boolean, body: unknown) {
  const spy = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── appointmentToCalendarEvent ─────────────────────────────────────────────────

describe('appointmentToCalendarEvent', () => {
  it('returns the appointment id', () => {
    const ev = AppointmentMessageService.appointmentToCalendarEvent(makeAppointment({ id: 'appt-99' }))
    expect(ev.id).toBe('appt-99')
  })

  it('returns the appointment title', () => {
    const ev = AppointmentMessageService.appointmentToCalendarEvent(makeAppointment({ title: 'Custom Install' }))
    expect(ev.title).toBe('Custom Install')
  })

  it('formats startDate as YYYY-MM-DD', () => {
    const ev = AppointmentMessageService.appointmentToCalendarEvent(makeAppointment())
    expect(ev.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('formats endDate as YYYY-MM-DD', () => {
    const ev = AppointmentMessageService.appointmentToCalendarEvent(makeAppointment())
    expect(ev.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('formats startTime as HH:MM', () => {
    const ev = AppointmentMessageService.appointmentToCalendarEvent(makeAppointment())
    expect(ev.startTime).toMatch(/^\d{2}:\d{2}$/)
  })

  it('formats endTime as HH:MM', () => {
    const ev = AppointmentMessageService.appointmentToCalendarEvent(makeAppointment())
    expect(ev.endTime).toMatch(/^\d{2}:\d{2}$/)
  })

  it('maps consultation type to blue color', () => {
    const ev = AppointmentMessageService.appointmentToCalendarEvent(makeAppointment({ appointmentType: 'consultation' }))
    expect(ev.color).toContain('blue')
  })

  it('maps beauty_service type to pink color', () => {
    const ev = AppointmentMessageService.appointmentToCalendarEvent(makeAppointment({ appointmentType: 'beauty_service' }))
    expect(ev.color).toContain('pink')
  })

  it('uses default blue color for unknown appointment types', () => {
    const ev = AppointmentMessageService.appointmentToCalendarEvent(makeAppointment({ appointmentType: 'unknown_type' }))
    expect(ev.color).toContain('blue')
  })

  it('sets category to the appointment type', () => {
    const ev = AppointmentMessageService.appointmentToCalendarEvent(makeAppointment({ appointmentType: 'auto_repair' }))
    expect(ev.category).toBe('auto_repair')
  })

  it('handles missing startTime gracefully (defaults to now)', () => {
    const ev = AppointmentMessageService.appointmentToCalendarEvent(
      makeAppointment({ startTime: '' }),
    )
    expect(ev.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('passes description through', () => {
    const ev = AppointmentMessageService.appointmentToCalendarEvent(
      makeAppointment({ description: 'Bring your artwork files' }),
    )
    expect(ev.description).toBe('Bring your artwork files')
  })
})

// ── createAppointmentMessage ──────────────────────────────────────────────────

describe('createAppointmentMessage', () => {
  it('calls POST /api/messages', async () => {
    const fetchSpy = mockFetch(true, { doc: { id: 'msg-42' } })
    await AppointmentMessageService.createAppointmentMessage(makeAppointment())
    expect(fetchSpy).toHaveBeenCalledWith('/api/messages', expect.objectContaining({ method: 'POST' }))
  })

  it('returns the created message id', async () => {
    mockFetch(true, { doc: { id: 'msg-77' } })
    const id = await AppointmentMessageService.createAppointmentMessage(makeAppointment())
    expect(id).toBe('msg-77')
  })

  it('throws when response is not ok', async () => {
    mockFetch(false, {})
    await expect(
      AppointmentMessageService.createAppointmentMessage(makeAppointment()),
    ).rejects.toThrow('Failed to create appointment message')
  })
})

// ── loadAppointments ───────────────────────────────────────────────────────────

describe('loadAppointments', () => {
  it('returns empty array when response is not ok', async () => {
    mockFetch(false, {})
    const result = await AppointmentMessageService.loadAppointments()
    expect(result).toEqual([])
  })

  it('maps docs to AppointmentEvent shape', async () => {
    const doc = {
      id: 'a1',
      title: 'Test Appt',
      startTime: '2026-03-10T09:00:00.000Z',
      endTime: '2026-03-10T10:00:00.000Z',
      appointmentType: 'consultation',
      status: 'scheduled',
      organizer: { id: 1 },
      meetingType: 'in_person',
    }
    mockFetch(true, { docs: [doc] })
    const result = await AppointmentMessageService.loadAppointments()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a1')
    expect(result[0].title).toBe('Test Appt')
  })

  it('returns empty array when docs is empty', async () => {
    mockFetch(true, { docs: [] })
    const result = await AppointmentMessageService.loadAppointments()
    expect(result).toEqual([])
  })
})

// ── deleteAppointment ─────────────────────────────────────────────────────────

describe('deleteAppointment', () => {
  it('calls DELETE /api/appointments/:id', async () => {
    const fetchSpy = mockFetch(true, {})
    await AppointmentMessageService.deleteAppointment('appt-5')
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/appointments/appt-5',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('throws when response is not ok', async () => {
    mockFetch(false, {})
    await expect(AppointmentMessageService.deleteAppointment('appt-5')).rejects.toThrow(
      'Failed to delete appointment',
    )
  })
})
