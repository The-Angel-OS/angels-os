// Calendar Event Message Service
// Stores calendar events as messages with structured content

import type { MessageContent } from '../types/messages'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  color: string
  category: string
}

export class CalendarMessageService {
  /**
   * Convert calendar event to message content
   */
  static eventToMessageContent(event: CalendarEvent): MessageContent {
    return {
      type: 'system',
      text: `Calendar Event: ${event.title}`,
      systemData: {
        eventType: 'task_assigned', // Using existing event type
        details: {
          eventType: 'calendar_event',
          title: event.title,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          startTime: event.startTime,
          endTime: event.endTime,
          color: event.color,
          category: event.category,
          allDay: event.startTime === '00:00' && event.endTime === '23:59'
        },
        timestamp: new Date(),
        severity: 'info'
      },
      metadata: {
        conversationId: `calendar_${event.startDate}`,
        tags: ['calendar', 'event', event.category],
        source: 'calendar_ui',
        importance: event.category === 'deadline' ? 'high' : 'normal'
      }
    }
  }

  /**
   * Convert message content back to calendar event
   */
  static messageContentToEvent(messageId: string, content: MessageContent): CalendarEvent | null {
    if (content.type !== 'system' || content.systemData?.details?.eventType !== 'calendar_event') {
      return null
    }

    const details = content.systemData?.details
    if (!details) return null
    return {
      id: messageId,
      title: details.title || 'Untitled Event',
      description: details.description || '',
      startDate: details.startDate || '',
      endDate: details.endDate || details.startDate || '',
      startTime: details.startTime || '09:00',
      endTime: details.endTime || '10:00',
      color: details.color || 'bg-blue-500',
      category: details.category || 'meeting'
    }
  }

  /**
   * Save calendar event as message
   */
  static async saveEvent(event: CalendarEvent, spaceId: number = 1, channelId?: string): Promise<string> {
    const messageContent = this.eventToMessageContent(event)
    
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: messageContent,
        messageType: 'system',
        space: spaceId,
        channel: channelId,
        sender: 1, // System user for calendar messages
        priority: event.category === 'deadline' ? 'high' : 'normal'
      })
    })

    if (!response.ok) {
      throw new Error('Failed to save calendar event')
    }

    const result = await response.json()
    return result.doc.id
  }

  /**
   * Update calendar event message
   */
  static async updateEvent(messageId: string, event: CalendarEvent): Promise<void> {
    const messageContent = this.eventToMessageContent(event)
    
    const response = await fetch(`/api/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: messageContent
      })
    })

    if (!response.ok) {
      throw new Error('Failed to update calendar event')
    }
  }

  /**
   * Delete calendar event message
   */
  static async deleteEvent(messageId: string): Promise<void> {
    const response = await fetch(`/api/messages/${messageId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete calendar event')
    }
  }

  /**
   * Load calendar events from messages
   */
  static async loadEvents(spaceId: number = 1, channelId?: string): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      where: JSON.stringify({
        and: [
          { space: { equals: spaceId } },
          { messageType: { equals: 'system' } },
          { 'content.systemData.details.eventType': { equals: 'calendar_event' } },
          ...(channelId ? [{ channel: { equals: channelId } }] : [])
        ]
      }),
      limit: '100',
      sort: '-createdAt'
    })

    const response = await fetch(`/api/messages?${params}`)
    
    if (!response.ok) {
      console.error('Failed to load calendar events')
      return []
    }

    const result = await response.json()
    const events: CalendarEvent[] = []

    for (const message of result.docs) {
      const event = this.messageContentToEvent(message.id, message.content)
      if (event) {
        events.push(event)
      }
    }

    return events
  }
}

