/**
 * Message content types for AI Bus / AT Protocol style messages.
 * Used by AppointmentMessageService, CalendarMessageService, BusinessIntelligenceProcessor, etc.
 */

/** Widget shape in message content (e.g. for BI or UI blocks). */
export interface DynamicWidget {
  widgetId?: string
  type: string
  title?: string
  content?: Record<string, unknown>
}

export interface MessageContent {
  type: string
  text: string
  systemData?: {
    eventType: string
    details: Record<string, unknown>
    timestamp: Date
    severity?: 'info' | 'warning' | 'error'
  }
  metadata?: {
    conversationId?: string
    tags?: string[]
    source?: string
    importance?: string
    intent?: import('./conversation').DetectedIntent
  }
  intelligenceData?: import('./business-intelligence').BusinessIntelligenceData
  widgets?: DynamicWidget[]
}
