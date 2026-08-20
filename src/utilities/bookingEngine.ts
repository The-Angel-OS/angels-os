import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { sendBookingConfirmation } from '@/utilities/bookingNotifications'
import { fetchBusyBlocks } from '@/utilities/googleCalendar'

export interface TimeSlot {
  startTime: Date
  endTime: Date
  available: boolean
  bookingId?: string
  slotType: 'available' | 'booked' | 'blocked' | 'buffer'
}

export interface BookingConflict {
  conflictId: string
  conflictType: 'booking' | 'availability' | 'buffer'
  conflictStart: Date
  conflictEnd: Date
  message: string
}

export interface AvailabilityQuery {
  providerId: string
  tenantId: string
  startDate: Date
  endDate: Date
  serviceType?: string
  slotDuration?: number
}

export interface BookingRequest {
  providerId: string
  clientId: string
  tenantId: string
  startDateTime: Date
  duration: number // minutes
  /**
   * How many people the slot holds. 1 (the default) = a one-to-one appointment.
   * A class, tour or group session sets this from the Availability rule, and the
   * slot only conflicts once it is genuinely full.
   */
  capacity?: number
  bookingType: string
  title: string
  description?: string
  pricing: {
    amount: number
    currency: string
    splitConfiguration?: {
      providerShare: number
      platformShare: number
      operationsShare: number
      justiceShare: number
    }
  }
  location?: {
    type: 'provider' | 'client' | 'remote' | 'custom'
    address?: string
    remoteDetails?: {
      platform: string
      meetingLink?: string
      accessCode?: string
    }
  }
  metadata?: Record<string, any>
}

export interface RescheduleResult {
  success: boolean
  booking?: any
  alternatives?: Array<{ startTime: Date; endTime: Date; harmonicScore: number; suggestion: string }>
  error?: string
}

// ---------------------------------------------------------------------------
// Standalone pure functions — exported for direct use and testability
// ---------------------------------------------------------------------------

/**
 * Generate individual time slots within a time window.
 * Pure function: no side effects, no Payload dependency.
 */
export function generateTimeSlots(
  date: Date,
  startTime: string,
  endTime: string,
  slotDuration: number,
  bufferTime: number,
  existingBookings: Array<{ id: string; startDateTime: string; endDateTime: string }>,
  maxAdvanceBooking?: number,
  minAdvanceBooking?: number,
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)

  const slotStart = new Date(date)
  slotStart.setHours(startHour, startMinute, 0, 0)

  const windowEnd = new Date(date)
  windowEnd.setHours(endHour, endMinute, 0, 0)

  const now = new Date()
  const minBookingTime = new Date(now.getTime() + (minAdvanceBooking || 1) * 60 * 60 * 1000)
  const maxBookingTime = maxAdvanceBooking ?
    new Date(now.getTime() + maxAdvanceBooking * 24 * 60 * 60 * 1000) : null

  while (slotStart < windowEnd) {
    const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000)

    if (slotEnd > windowEnd) break

    // Check booking time constraints
    if (slotStart < minBookingTime || (maxBookingTime && slotStart > maxBookingTime)) {
      slotStart.setTime(slotStart.getTime() + slotDuration * 60 * 1000)
      continue
    }

    // Check for conflicts with existing bookings
    const conflict = existingBookings.find(booking => {
      const bookingStart = new Date(booking.startDateTime)
      const bookingEnd = new Date(booking.endDateTime)

      return (
        (slotStart >= bookingStart && slotStart < bookingEnd) ||
        (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
        (slotStart <= bookingStart && slotEnd >= bookingEnd)
      )
    })

    const slot: TimeSlot = {
      startTime: new Date(slotStart),
      endTime: new Date(slotEnd),
      available: !conflict,
      slotType: conflict ? 'booked' : 'available',
      bookingId: conflict?.id
    }

    slots.push(slot)

    // Add buffer time if configured
    if (bufferTime > 0 && !conflict) {
      const bufferEnd = new Date(slotEnd.getTime() + bufferTime * 60 * 1000)
      if (bufferEnd <= windowEnd) {
        slots.push({
          startTime: new Date(slotEnd),
          endTime: bufferEnd,
          available: false,
          slotType: 'buffer'
        })
      }
    }

    slotStart.setTime(slotStart.getTime() + (slotDuration + bufferTime) * 60 * 1000)
  }

  return slots
}

/**
 * Merge overlapping/adjacent available slots.
 * Pure function: no side effects, no Payload dependency.
 */
export function mergeOverlappingSlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length <= 1) return slots

  const sorted = slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  const merged: TimeSlot[] = []
  let current = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]

    if (current.available && next.available &&
        current.slotType === 'available' && next.slotType === 'available' &&
        current.endTime.getTime() === next.startTime.getTime()) {
      // Merge adjacent available slots
      current = {
        ...current,
        endTime: next.endTime
      }
    } else {
      merged.push(current)
      current = next
    }
  }

  merged.push(current)
  return merged
}

/**
 * Calculate harmonic compatibility between requested and alternative times.
 * Pure function: no side effects, no Payload dependency.
 *
 * Answer 53 harmonic principles:
 * - Same day = highest harmony
 * - Similar time of day = good harmony
 * - 1-2 days difference = acceptable harmony
 * - Weekend/weekday shifts = consider rhythm
 */
export function calculateHarmonicScore(requestedTime: Date, alternativeTime: Date): number {
  const timeDiff = Math.abs(requestedTime.getTime() - alternativeTime.getTime())
  const hoursDiff = timeDiff / (1000 * 60 * 60)

  if (hoursDiff < 1) return 100 // Perfect harmony
  if (hoursDiff < 4) return 90   // Same day, close time
  if (hoursDiff < 24) return 70  // Same day, different time
  if (hoursDiff < 48) return 50  // Next day

  return Math.max(10, 40 - (hoursDiff / 24) * 5) // Decreasing harmony over time
}

/**
 * Core booking engine for Angel OS
 * Handles availability checking, slot generation, and booking creation
 */
export class BookingEngine {
  private payload: Payload
  
  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Get available time slots for a provider within a date range
   */
  async getAvailableSlots(query: AvailabilityQuery): Promise<TimeSlot[]> {
    const { providerId, tenantId, startDate, endDate, serviceType, slotDuration = 60 } = query

    // Get provider's availability rules
    const availabilityRules = await this.payload.find({
      collection: 'availability',
      where: {
        and: [
          { provider: { equals: providerId } },
          { tenant: { equals: tenantId } },
          { isActive: { equals: true } },
        ],
      },
    })

    // Get existing bookings in the date range
    const existingBookings = await this.payload.find({
      collection: 'bookings',
      where: {
        and: [
          { provider: { equals: providerId } },
          { tenant: { equals: tenantId } },
          { startDateTime: { greater_than_equal: startDate.toISOString() } },
          { startDateTime: { less_than_equal: endDate.toISOString() } },
          { 
            status: { 
              in: ['pending', 'confirmed', 'in-progress'] 
            } 
          },
        ],
      },
    })

    // The provider's OWN calendar, if they connected one. Without this we only
    // know about bookings made THROUGH us — an appointment they took by phone,
    // or anything personal, was invisible and we would double-book them.
    // Returns [] for anyone not connected, and [] if Google is unreachable, so
    // this degrades to the previous behaviour rather than breaking /book.
    const busyBlocks = await fetchBusyBlocks(this.payload, providerId, startDate, endDate)
    const blockedTimes = [
      ...existingBookings.docs,
      ...busyBlocks.map((b, i) => ({
        id: `gcal-${i}`,
        startDateTime: b.start.toISOString(),
        endDateTime: b.end.toISOString(),
      })),
    ]

    const slots: TimeSlot[] = []
    const currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      const dailySlots = await this.generateDailySlots(
        currentDate,
        availabilityRules.docs,
        blockedTimes,
        slotDuration,
        serviceType
      )
      slots.push(...dailySlots)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  }

  /**
   * Generate available slots for a specific day
   */
  private async generateDailySlots(
    date: Date,
    availabilityRules: any[],
    existingBookings: any[],
    slotDuration: number,
    serviceType?: string
  ): Promise<TimeSlot[]> {
    const slots: TimeSlot[] = []
    const dayOfWeek = date.getDay()
    const dateString = date.toISOString().split('T')[0]

    // Find applicable availability rules for this day
    const applicableRules = availabilityRules.filter(rule => {
      if (rule.availabilityType === 'weekly') {
        return rule.weeklySchedule?.dayOfWeek === dayOfWeek
      } else if (rule.availabilityType === 'date-range') {
        const startDate = new Date(rule.dateRange.startDate)
        const endDate = new Date(rule.dateRange.endDate)
        return date >= startDate && date <= endDate
      } else if (rule.availabilityType === 'one-time') {
        const blockDate = new Date(rule.oneTimeBlock.startDateTime).toISOString().split('T')[0]
        return blockDate === dateString
      }
      return false
    })

    // Check for exceptions
    const exceptionsForDate = availabilityRules.flatMap(rule => 
      rule.exceptions?.filter((exc: any) => 
        new Date(exc.date).toISOString().split('T')[0] === dateString
      ) || []
    )

    if (exceptionsForDate.length > 0 && !exceptionsForDate.some(exc => exc.alternativeAvailability)) {
      return slots // No availability due to exception
    }

    // Generate slots from applicable rules
    for (const rule of applicableRules) {
      let startTime: string
      let endTime: string
      let ruleSlotDuration = rule.slotDuration || slotDuration
      let bufferTime = rule.bufferTime || 0

      if (rule.availabilityType === 'weekly') {
        startTime = rule.weeklySchedule.startTime
        endTime = rule.weeklySchedule.endTime
      } else if (rule.availabilityType === 'date-range') {
        startTime = rule.dateRange.startTime
        endTime = rule.dateRange.endTime
      } else if (rule.availabilityType === 'one-time') {
        const blockStart = new Date(rule.oneTimeBlock.startDateTime)
        const blockEnd = new Date(rule.oneTimeBlock.endDateTime)
        startTime = blockStart.toTimeString().slice(0, 5)
        endTime = blockEnd.toTimeString().slice(0, 5)
      } else {
        continue
      }

      // Check service type compatibility
      if (serviceType && rule.serviceTypes?.length > 0) {
        const compatibleService = rule.serviceTypes.find((st: any) => 
          st.serviceType === serviceType
        )
        if (!compatibleService) continue
      }

      // Generate time slots within the availability window
      const daySlots = generateTimeSlots(
        date,
        startTime,
        endTime,
        ruleSlotDuration,
        bufferTime,
        existingBookings,
        rule.maxAdvanceBooking,
        rule.minAdvanceBooking
      )

      slots.push(...daySlots)
    }

    return mergeOverlappingSlots(slots)
  }

  /**
   * Check for booking conflicts
   */
  async checkBookingConflicts(request: BookingRequest): Promise<BookingConflict[]> {
    const conflicts: BookingConflict[] = []
    const { providerId, tenantId, startDateTime, duration } = request
    
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000)

    // Check existing bookings
    const existingBookings = await this.payload.find({
      collection: 'bookings',
      where: {
        and: [
          { provider: { equals: providerId } },
          { tenant: { equals: tenantId } },
          { status: { in: ['pending', 'confirmed', 'in-progress'] } },
          {
            or: [
              {
                and: [
                  { startDateTime: { less_than_equal: startDateTime.toISOString() } },
                  { endDateTime: { greater_than: startDateTime.toISOString() } }
                ]
              },
              {
                and: [
                  { startDateTime: { less_than: endDateTime.toISOString() } },
                  { endDateTime: { greater_than_equal: endDateTime.toISOString() } }
                ]
              },
              {
                and: [
                  { startDateTime: { greater_than_equal: startDateTime.toISOString() } },
                  { startDateTime: { less_than: endDateTime.toISOString() } }
                ]
              }
            ]
          }
        ]
      }
    })

    const nowMs = Date.now()
    const live = existingBookings.docs.filter(booking => {
      // An abandoned deposit-hold (pending, past its holdExpiresAt) no longer
      // reserves the slot — don't let it block a fresh booking. Mirrors the same
      // rule in booking-public-slots so the calendar and commit-time check agree.
      const hold = (booking as { holdExpiresAt?: string }).holdExpiresAt
      return !(booking.status === 'pending' && hold && new Date(hold).getTime() < nowMs)
    })

    // Capacity, not presence, is what makes a slot unavailable. A one-to-one
    // appointment (capacity 1) conflicts on the first overlapping booking, which
    // is the original behaviour; a tour with six seats only conflicts on the
    // seventh. Reporting no conflict below capacity keeps this the single guard
    // the checkout relies on — the caller does not have to count seats itself.
    const capacity = Math.max(1, request.capacity || 1)
    if (live.length < capacity) return conflicts

    live.forEach(booking => {
      conflicts.push({
        conflictId: String(booking.id),
        conflictType: 'booking',
        conflictStart: new Date(booking.startDateTime),
        conflictEnd: new Date(booking.endDateTime),
        message: `Conflicts with existing booking: ${booking.title}`
      })
    })

    return conflicts
  }

  /**
   * Create a new booking
   */
  async createBooking(request: BookingRequest): Promise<any> {
    // Check for conflicts
    const conflicts = await this.checkBookingConflicts(request)
    
    if (conflicts.length > 0) {
      throw new Error(`Booking conflicts detected: ${conflicts.map(c => c.message).join(', ')}`)
    }

    const endDateTime = new Date(request.startDateTime.getTime() + request.duration * 60 * 1000)

    // splitConfiguration is DEPRECATED and no longer written. The applied rate
    // is data (src/utilities/platformFee.ts); writing a second, different set of
    // numbers onto every booking is how four conflicting splits came to exist.

    const tenantIdNum = typeof request.tenantId === 'number' ? request.tenantId : parseInt(String(request.tenantId), 10)
    if (Number.isNaN(tenantIdNum)) throw new Error('Invalid tenantId')
    const booking = await this.payload.create({
      collection: 'bookings',
      data: {
        tenant: tenantIdNum,
        title: request.title,
        ...(request.description && {
          description: typeof request.description === 'object'
            ? request.description
            : { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: String(request.description) }] }], direction: null, format: '', indent: 0, version: 1 } }
        }),
        bookingType: request.bookingType,
        provider: request.providerId,
        client: request.clientId,
        startDateTime: request.startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        duration: request.duration,
        pricing: {
          ...request.pricing,
        },
        location: request.location,
        status: 'pending',
        metadata: request.metadata,
        notifications: {
          confirmationSent: false,
          reminderSent: false,
          followUpSent: false
        }
      } as any,
      overrideAccess: true,
    })

    // Fire-and-forget: notifications must never block booking creation
    sendBookingConfirmation(this.payload, booking, request.tenantId).catch((err) => {
      console.error('[BookingEngine] Failed to send booking confirmation email:', err)
    })

    return booking
  }

  /**
   * Answer 53 - Harmonized booking resolution
   * For complex scheduling scenarios that require creative solutions
   */
  async resolveBookingHarmonically(
    request: BookingRequest, 
    conflicts: BookingConflict[]
  ): Promise<{ solution: string; alternatives: any[] }> {
    // This is where Answer 53 comes into play
    // Instead of just rejecting conflicted bookings, we find harmonic alternatives

    const alternatives: Array<{ startTime: Date; endTime: Date; harmonicScore: number; suggestion: string }> = []
    
    // Find nearby available slots
    const nearbySlots = await this.getAvailableSlots({
      providerId: request.providerId,
      tenantId: request.tenantId,
      startDate: new Date(request.startDateTime.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
      endDate: new Date(request.startDateTime.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days after
      serviceType: request.bookingType,
      slotDuration: request.duration
    })

    const availableAlternatives = nearbySlots
      .filter(slot => slot.available && 
              Math.abs(slot.startTime.getTime() - request.startDateTime.getTime()) < 7 * 24 * 60 * 60 * 1000)
      .slice(0, 5) // Top 5 alternatives

    availableAlternatives.forEach(slot => {
      alternatives.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        harmonicScore: calculateHarmonicScore(request.startDateTime, slot.startTime),
        suggestion: `Alternative time: ${slot.startTime.toLocaleString()}`
      })
    })

    return {
      solution: conflicts.length > 0 ? 
        "Yes and No in perfect rhythm - conflict exists but alternatives harmonize" :
        "Creative change through compassion - booking flows naturally",
      alternatives: alternatives.sort((a, b) => b.harmonicScore - a.harmonicScore)
    }
  }

  /**
   * Cancel an existing booking
   */
  async cancelBooking(
    bookingId: string,
    tenantId: string,
    reason: string,
    cancelledBy: 'client' | 'provider' | 'system'
  ): Promise<any> {
    // Fetch the existing booking
    const booking = await this.payload.findByID({
      collection: 'bookings',
      id: bookingId,
      overrideAccess: true,
    })

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`)
    }

    // Validate the booking belongs to this tenant
    const bookingTenantId = typeof booking.tenant === 'object' ? (booking.tenant as any)?.id : booking.tenant
    if (String(bookingTenantId) !== String(tenantId)) {
      throw new Error(`Booking ${bookingId} does not belong to tenant ${tenantId}`)
    }

    // Validate the booking is in a cancellable state
    const cancellableStatuses = ['pending', 'confirmed']
    if (!cancellableStatuses.includes(booking.status as string)) {
      throw new Error(`Booking ${bookingId} cannot be cancelled — current status: ${booking.status}`)
    }

    // Update the booking with structured cancellation data
    const updatedBooking = await this.payload.update({
      collection: 'bookings',
      id: bookingId,
      data: {
        status: 'cancelled',
        cancellation: {
          reason,
          cancelledBy,
          cancelledAt: new Date().toISOString(),
        },
      } as any,
      overrideAccess: true,
    })

    return updatedBooking
  }

  /**
   * Reschedule an existing booking to a new time
   */
  async rescheduleBooking(
    bookingId: string,
    tenantId: string,
    newStartDateTime: Date,
    newDuration?: number
  ): Promise<RescheduleResult> {
    // Fetch the existing booking
    let booking: any
    try {
      booking = await this.payload.findByID({
        collection: 'bookings',
        id: bookingId,
        overrideAccess: true,
      })
    } catch {
      return { success: false, error: `Booking ${bookingId} not found` }
    }

    if (!booking) {
      return { success: false, error: `Booking ${bookingId} not found` }
    }

    // Validate the booking belongs to this tenant
    const bookingTenantId = typeof booking.tenant === 'object' ? (booking.tenant as any)?.id : booking.tenant
    if (String(bookingTenantId) !== String(tenantId)) {
      return { success: false, error: `Booking ${bookingId} does not belong to tenant ${tenantId}` }
    }

    // Validate the booking is in a reschedulable state
    const reschedulableStatuses = ['pending', 'confirmed']
    if (!reschedulableStatuses.includes(booking.status as string)) {
      return { success: false, error: `Booking ${bookingId} cannot be rescheduled — current status: ${booking.status}` }
    }

    const duration = newDuration || booking.duration
    const providerId = typeof booking.provider === 'object' ? (booking.provider as any)?.id : booking.provider
    const clientId = typeof booking.client === 'object' ? (booking.client as any)?.id : booking.client

    // Build a request for conflict checking
    const rescheduleRequest: BookingRequest = {
      providerId: String(providerId),
      clientId: String(clientId),
      tenantId,
      startDateTime: newStartDateTime,
      duration,
      bookingType: booking.bookingType,
      title: booking.title,
      pricing: booking.pricing,
      location: booking.location,
    }

    // Check for conflicts at the new time (exclude the current booking from conflict check)
    const conflicts = await this.checkBookingConflicts(rescheduleRequest)
    // Filter out the booking being rescheduled from conflicts
    const realConflicts = conflicts.filter(c => c.conflictId !== bookingId)

    if (realConflicts.length === 0) {
      // No conflicts — update the booking
      const newEndDateTime = new Date(newStartDateTime.getTime() + duration * 60 * 1000)
      const currentRescheduleCount = (booking.rescheduling?.rescheduleCount as number) || 0
      const updatedBooking = await this.payload.update({
        collection: 'bookings',
        id: bookingId,
        data: {
          startDateTime: newStartDateTime.toISOString(),
          endDateTime: newEndDateTime.toISOString(),
          duration,
          rescheduling: {
            rescheduledFrom: {
              startDateTime: booking.startDateTime,
              endDateTime: booking.endDateTime,
              rescheduledAt: new Date().toISOString(),
            },
            rescheduleCount: currentRescheduleCount + 1,
          },
        } as any,
        overrideAccess: true,
      })

      return { success: true, booking: updatedBooking }
    }

    // Conflicts exist — resolve harmonically
    const harmonicResult = await this.resolveBookingHarmonically(rescheduleRequest, realConflicts)
    return {
      success: false,
      alternatives: harmonicResult.alternatives,
      error: `Conflicts at requested time: ${realConflicts.map(c => c.message).join(', ')}`,
    }
  }
}