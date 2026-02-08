// Appointment Message Service
// Bridges Appointments collection with AT Protocol Messages

import type { MessageContent } from '../types/messages'

export interface AppointmentEvent {
  id: string
  title: string
  description?: string
  startTime: string
  endTime: string
  appointmentType: string
  status: string
  organizer: any
  attendees?: any[]
  location?: string
  meetingLink?: string
  meetingType: string
}

export class AppointmentMessageService {
  /**
   * Create AT Protocol message when appointment is created/updated
   */
  static async createAppointmentMessage(appointment: any): Promise<string> {
    const messageContent: MessageContent = {
      type: 'system',
      text: `Appointment: ${appointment.title}`,
      systemData: {
        eventType: 'task_assigned',
        details: {
          appointmentId: appointment.id,
          title: appointment.title,
          description: appointment.description,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          appointmentType: appointment.appointmentType,
          status: appointment.status,
          location: appointment.location,
          meetingType: appointment.meetingType,
          organizerId: typeof appointment.organizer === 'object' ? appointment.organizer.id : appointment.organizer,
          attendeeIds: appointment.attendees?.map((a: any) => typeof a === 'object' ? a.id : a) || []
        },
        timestamp: new Date(),
        severity: appointment.status === 'cancelled' ? 'warning' : 'info'
      },
      metadata: {
        conversationId: `appointment_${appointment.id}`,
        tags: ['appointment', appointment.appointmentType, appointment.status],
        source: 'appointment_system',
        importance: appointment.appointmentType === 'consultation' ? 'high' : 'normal'
      }
    }

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: messageContent,
        messageType: 'system',
        space: appointment.space || 1,
        sender: 1, // System user for appointment messages
        priority: appointment.appointmentType === 'consultation' ? 'high' : 'normal'
      })
    })

    if (!response.ok) {
      throw new Error('Failed to create appointment message')
    }

    const result = await response.json()
    return result.doc.id
  }

  /**
   * Load appointments from Appointments collection (not messages)
   */
  static async loadAppointments(spaceId?: number, tenantId?: number): Promise<AppointmentEvent[]> {
    const params = new URLSearchParams({
      limit: '100',
      sort: 'startTime',
      populate: 'organizer,attendees'
    })

    if (spaceId) {
      params.append('where[space][equals]', spaceId.toString())
    }
    if (tenantId) {
      params.append('where[tenant][equals]', tenantId.toString())
    }

    const response = await fetch(`/api/appointments?${params}`)
    
    if (!response.ok) {
      console.error('Failed to load appointments')
      return []
    }

    const result = await response.json()
    
    return result.docs.map((appointment: any): AppointmentEvent => ({
      id: appointment.id,
      title: appointment.title,
      description: appointment.description,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      appointmentType: appointment.appointmentType,
      status: appointment.status,
      organizer: appointment.organizer,
      attendees: appointment.attendees,
      location: appointment.location,
      meetingLink: appointment.meetingLink,
      meetingType: appointment.meetingType
    }))
  }

  /**
   * Convert appointment to calendar event format for display
   */
  static appointmentToCalendarEvent(appointment: AppointmentEvent): {
    id: string
    title: string
    description?: string
    startDate: string
    endDate: string
    startTime: string
    endTime: string
    color: string
    category: string
  } {
    const startDate = appointment.startTime ? new Date(appointment.startTime) : new Date()
    const endDate = appointment.endTime ? new Date(appointment.endTime) : new Date()
    
    // Helper function to safely extract date string
    const formatDateString = (date: Date): string => {
      const isoString = date.toISOString()
      return isoString.substring(0, 10) // YYYY-MM-DD
    }
    
    // Map appointment types to calendar colors
    const colorMap: Record<string, string> = {
      'consultation': 'bg-blue-500',
      'standard_install': 'bg-green-500',
      'custom_install': 'bg-purple-500',
      'quote_consultation': 'bg-orange-500',
      'mobile_service': 'bg-red-500',
      'beauty_service': 'bg-pink-500',
      'barber_service': 'bg-indigo-500',
      'auto_repair': 'bg-yellow-500',
      'diagnostic': 'bg-gray-500',
      'general_meeting': 'bg-blue-500'
    }

    return {
      id: appointment.id,
      title: appointment.title,
      description: appointment.description || '',
      startDate: formatDateString(startDate) as string,
      endDate: formatDateString(endDate) as string,
      startTime: startDate.toTimeString().slice(0, 5),
      endTime: endDate.toTimeString().slice(0, 5),
      color: colorMap[appointment.appointmentType] || 'bg-blue-500',
      category: appointment.appointmentType
    }
  }

  /**
   * Save appointment to Appointments collection
   */
  static async saveAppointment(appointmentData: Partial<AppointmentEvent>): Promise<string> {
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointmentData)
    })

    if (!response.ok) {
      throw new Error('Failed to save appointment')
    }

    const result = await response.json()
    
    // Create corresponding AT Protocol message
    await this.createAppointmentMessage(result.doc)
    
    return result.doc.id
  }

  /**
   * Update appointment in Appointments collection
   */
  static async updateAppointment(appointmentId: string, updates: Partial<AppointmentEvent>): Promise<void> {
    const response = await fetch(`/api/appointments/${appointmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      throw new Error('Failed to update appointment')
    }

    const result = await response.json()
    
    // Create update message in AT Protocol
    await this.createAppointmentMessage(result.doc)
  }

  /**
   * Delete appointment
   */
  static async deleteAppointment(appointmentId: string): Promise<void> {
    const response = await fetch(`/api/appointments/${appointmentId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete appointment')
    }
  }
}

