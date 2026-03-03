/**
 * CalendarMessageService — Unit Tests
 *
 * Tests the pure eventToMessageContent and messageContentToEvent transformations
 * and fetch-based CRUD methods via stubbed global.fetch.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  CalendarMessageService,
  type CalendarEvent,
} from '@/utilities/CalendarMessageService'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'ev-1',
    title: 'Team Sync',
    startDate: '2026-03-10',
    endDate: '2026-03-10',
    startTime: '09:00',
    endTime: '10:00',
    color: 'bg-blue-500',
    category: 'meeting',
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

// ── eventToMessageContent ──────────────────────────────────────────────────────

describe('eventToMessageContent', () => {
  it('returns type "system"', () => {
    const content = CalendarMessageService.eventToMessageContent(makeEvent())
    expect(content.type).toBe('system')
  })

  it('includes the event title in the text', () => {
    const content = CalendarMessageService.eventToMessageContent(makeEvent({ title: 'Sprint Review' }))
    expect(content.text).toContain('Sprint Review')
  })

  it('sets eventType to "task_assigned" in systemData', () => {
    const content = CalendarMessageService.eventToMessageContent(makeEvent())
    expect(content.systemData?.eventType).toBe('task_assigned')
  })

  it('sets severity to "info"', () => {
    const content = CalendarMessageService.eventToMessageContent(makeEvent())
    expect(content.systemData?.severity).toBe('info')
  })

  it('sets allDay true when startTime is 00:00 and endTime is 23:59', () => {
    const content = CalendarMessageService.eventToMessageContent(
      makeEvent({ startTime: '00:00', endTime: '23:59' }),
    )
    expect((content.systemData?.details as any)?.allDay).toBe(true)
  })

  it('sets allDay false when times are not all-day', () => {
    const content = CalendarMessageService.eventToMessageContent(makeEvent())
    expect((content.systemData?.details as any)?.allDay).toBe(false)
  })

  it('stores event category in details', () => {
    const content = CalendarMessageService.eventToMessageContent(makeEvent({ category: 'deadline' }))
    expect((content.systemData?.details as any)?.category).toBe('deadline')
  })

  it('sets conversationId as calendar_<startDate>', () => {
    const content = CalendarMessageService.eventToMessageContent(makeEvent({ startDate: '2026-03-10' }))
    expect(content.metadata?.conversationId).toBe('calendar_2026-03-10')
  })

  it('sets importance to "high" for deadline category', () => {
    const content = CalendarMessageService.eventToMessageContent(makeEvent({ category: 'deadline' }))
    expect(content.metadata?.importance).toBe('high')
  })

  it('sets importance to "normal" for non-deadline category', () => {
    const content = CalendarMessageService.eventToMessageContent(makeEvent({ category: 'meeting' }))
    expect(content.metadata?.importance).toBe('normal')
  })

  it('includes calendar and event tags in metadata', () => {
    const content = CalendarMessageService.eventToMessageContent(makeEvent({ category: 'workshop' }))
    expect(content.metadata?.tags).toContain('calendar')
    expect(content.metadata?.tags).toContain('event')
    expect(content.metadata?.tags).toContain('workshop')
  })

  it('sets source to "calendar_ui"', () => {
    const content = CalendarMessageService.eventToMessageContent(makeEvent())
    expect(content.metadata?.source).toBe('calendar_ui')
  })
})

// ── messageContentToEvent ──────────────────────────────────────────────────────

describe('messageContentToEvent', () => {
  function makeContent(overrides: Record<string, unknown> = {}) {
    return {
      type: 'system' as const,
      text: 'Calendar Event: Test',
      systemData: {
        eventType: 'task_assigned',
        details: {
          eventType: 'calendar_event',
          title: 'Test Event',
          startDate: '2026-03-10',
          endDate: '2026-03-10',
          startTime: '10:00',
          endTime: '11:00',
          color: 'bg-green-500',
          category: 'meeting',
          ...overrides,
        },
        timestamp: new Date(),
        severity: 'info' as const,
      },
      metadata: { conversationId: 'calendar_2026-03-10', tags: [], source: 'calendar_ui', importance: 'normal' as const },
    }
  }

  it('returns null for non-system content', () => {
    const result = CalendarMessageService.messageContentToEvent('msg-1', {
      type: 'text',
      text: 'hello',
    } as any)
    expect(result).toBeNull()
  })

  it('returns null when eventType is not calendar_event', () => {
    const content = makeContent({ eventType: 'something_else' })
    const result = CalendarMessageService.messageContentToEvent('msg-1', content)
    expect(result).toBeNull()
  })

  it('maps messageId to event id', () => {
    const result = CalendarMessageService.messageContentToEvent('msg-42', makeContent())
    expect(result?.id).toBe('msg-42')
  })

  it('maps title from details', () => {
    const result = CalendarMessageService.messageContentToEvent('msg-1', makeContent({ title: 'My Event' }))
    expect(result?.title).toBe('My Event')
  })

  it('uses "Untitled Event" when title is missing', () => {
    const result = CalendarMessageService.messageContentToEvent('msg-1', makeContent({ title: undefined }))
    expect(result?.title).toBe('Untitled Event')
  })

  it('maps startDate from details', () => {
    const result = CalendarMessageService.messageContentToEvent('msg-1', makeContent({ startDate: '2026-04-01' }))
    expect(result?.startDate).toBe('2026-04-01')
  })

  it('maps endDate from details, falling back to startDate', () => {
    const result = CalendarMessageService.messageContentToEvent('msg-1', makeContent({ endDate: undefined, startDate: '2026-05-01' }))
    expect(result?.endDate).toBe('2026-05-01')
  })

  it('defaults startTime to "09:00" when missing', () => {
    const result = CalendarMessageService.messageContentToEvent('msg-1', makeContent({ startTime: undefined }))
    expect(result?.startTime).toBe('09:00')
  })

  it('defaults endTime to "10:00" when missing', () => {
    const result = CalendarMessageService.messageContentToEvent('msg-1', makeContent({ endTime: undefined }))
    expect(result?.endTime).toBe('10:00')
  })

  it('defaults color to "bg-blue-500" when missing', () => {
    const result = CalendarMessageService.messageContentToEvent('msg-1', makeContent({ color: undefined }))
    expect(result?.color).toBe('bg-blue-500')
  })

  it('defaults category to "meeting" when missing', () => {
    const result = CalendarMessageService.messageContentToEvent('msg-1', makeContent({ category: undefined }))
    expect(result?.category).toBe('meeting')
  })

  it('round-trips through eventToMessageContent', () => {
    const original = makeEvent({ title: 'Round Trip Test', category: 'workshop' })
    const content = CalendarMessageService.eventToMessageContent(original)
    const recovered = CalendarMessageService.messageContentToEvent('ev-1', content)
    expect(recovered?.title).toBe('Round Trip Test')
    expect(recovered?.category).toBe('workshop')
    expect(recovered?.startDate).toBe('2026-03-10')
  })
})

// ── saveEvent ──────────────────────────────────────────────────────────────────

describe('saveEvent', () => {
  it('calls POST /api/messages', async () => {
    const fetchSpy = mockFetch(true, { doc: { id: 'msg-1' } })
    await CalendarMessageService.saveEvent(makeEvent())
    expect(fetchSpy).toHaveBeenCalledWith('/api/messages', expect.objectContaining({ method: 'POST' }))
  })

  it('returns the created message id', async () => {
    mockFetch(true, { doc: { id: 'msg-99' } })
    const id = await CalendarMessageService.saveEvent(makeEvent())
    expect(id).toBe('msg-99')
  })

  it('throws when response is not ok', async () => {
    mockFetch(false, {})
    await expect(CalendarMessageService.saveEvent(makeEvent())).rejects.toThrow(
      'Failed to save calendar event',
    )
  })
})

// ── deleteEvent ────────────────────────────────────────────────────────────────

describe('deleteEvent', () => {
  it('calls DELETE /api/messages/:id', async () => {
    const fetchSpy = mockFetch(true, {})
    await CalendarMessageService.deleteEvent('msg-5')
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/messages/msg-5',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('throws when response is not ok', async () => {
    mockFetch(false, {})
    await expect(CalendarMessageService.deleteEvent('msg-5')).rejects.toThrow(
      'Failed to delete calendar event',
    )
  })
})
