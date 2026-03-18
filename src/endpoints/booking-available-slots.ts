/**
 * Available Slots Endpoint — POST /api/booking-ops/available-slots
 *
 * Public API for querying bookable time slots. Returns actual availability
 * from the BookingEngine — checking provider schedules, existing bookings,
 * buffer times, and service type compatibility.
 *
 * Body:
 *   - providerId (string, required): Provider user ID
 *   - startDate (string, required): ISO date for start of range
 *   - endDate (string): ISO date for end of range (default: startDate + 3 days)
 *   - duration (number): Desired slot duration in minutes (default: 60)
 *   - serviceType (string): Optional service type to filter availability
 *   - tenantId (number): Optional tenant override (defaults to user's tenant)
 *
 * Response: { slots: TimeSlot[], total: number, query: {...} }
 *
 * Auth: Requires authentication (availability is tenant-scoped).
 *
 * @see src/utilities/bookingEngine.ts — core slot generation + conflict detection
 */
import type { PayloadHandler } from 'payload'
import { BookingEngine } from '@/utilities/bookingEngine'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

export const bookingAvailableSlotsHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rateLimited = applyRateLimit(req, 'bookings')
  if (rateLimited) return rateLimited

  try {
    // Parse body from the request
    let body: Record<string, unknown> = {}
    try {
      // Payload's PayloadRequest has data or json
      if (req.json && typeof req.json === 'function') {
        body = await req.json()
      } else if (typeof (req as any).data === 'object') {
        body = (req as any).data
      }
    } catch {
      // Body parsing failed — continue with empty body
    }

    const providerId = body.providerId ? String(body.providerId) : undefined
    const duration = Math.max(15, Number(body.duration) || 60)
    const serviceType = body.serviceType ? String(body.serviceType) : undefined

    if (!providerId) {
      return Response.json(
        { error: 'providerId is required' },
        { status: 400 }
      )
    }

    // Determine date range
    const startDate = body.startDate ? new Date(String(body.startDate)) : new Date()
    if (isNaN(startDate.getTime())) {
      return Response.json(
        { error: 'Invalid startDate format. Use ISO 8601 date.' },
        { status: 400 }
      )
    }
    startDate.setHours(0, 0, 0, 0)

    const endDate = body.endDate ? new Date(String(body.endDate)) : new Date(startDate)
    if (isNaN(endDate.getTime())) {
      return Response.json(
        { error: 'Invalid endDate format. Use ISO 8601 date.' },
        { status: 400 }
      )
    }
    if (!body.endDate) {
      endDate.setDate(endDate.getDate() + 3)
    }
    endDate.setHours(23, 59, 59, 999)

    // Determine tenant — from user's memberships or body override
    let tenantId = body.tenantId ? String(body.tenantId) : undefined
    if (!tenantId) {
      // Find user's active tenant membership
      const memberships = await payload.find({
        collection: 'tenant-memberships' as any,
        where: {
          user: { equals: user.id },
          status: { equals: 'active' },
        },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })

      if (memberships.docs.length > 0) {
        const m = memberships.docs[0] as any
        tenantId = String(typeof m.tenant === 'object' ? m.tenant?.id : m.tenant)
      }
    }

    if (!tenantId) {
      return Response.json(
        { error: 'No tenant context found. Please ensure you are a member of a workspace.' },
        { status: 400 }
      )
    }

    const engine = new BookingEngine(payload)
    const slots = await engine.getAvailableSlots({
      providerId,
      tenantId,
      startDate,
      endDate,
      serviceType,
      slotDuration: duration,
    })

    const availableSlots = slots.filter(s => s.available)

    return Response.json({
      slots: slots.map(s => ({
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        available: s.available,
        slotType: s.slotType,
        bookingId: s.bookingId,
      })),
      available: availableSlots.length,
      total: slots.length,
      query: {
        providerId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        duration,
        serviceType: serviceType || null,
        tenantId,
      },
    })
  } catch (err) {
    console.error('[Booking API] Error fetching available slots:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch available slots' },
      { status: 500 }
    )
  }
}
