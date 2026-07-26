/**
 * Google Calendar — read a provider's real busy times, write confirmed bookings.
 *
 * Why this exists: the booking engine only knew about bookings made THROUGH us.
 * A provider who takes an appointment by phone, or has a school pickup on their
 * own calendar, was still shown as free — so /book cheerfully double-booked them
 * and the platform looked broken at exactly the moment it mattered most.
 *
 * Connected per user, on demand, at /api/auth/google?calendar=1 — its own
 * consent screen, never bundled into sign-in. Same pattern as the contacts
 * import. @see src/endpoints/auth-google.ts
 *
 * Fail-soft everywhere: if Google is down, or the token was revoked, we return
 * "no busy blocks" and fall back to our own bookings. A calendar outage must
 * degrade to the old behaviour, never take booking down with it.
 */
import type { Payload } from 'payload'
import { safeDecrypt } from '@/utilities/encryption'
import { logError } from '@/utilities/logError'

/** Scopes requested by `?calendar=1`. `events` covers read AND write, so a
 *  later "write the booking back" needs no second consent screen. */
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

export interface BusyBlock {
  start: Date
  end: Date
}

/** 8s: a calendar lookup sits in the /book request path — a slow Google must not
 *  become a slow booking page. (The global 180s default is far too generous here.) */
const CALENDAR_TIMEOUT_MS = 8_000

/** Exchange a stored refresh token for a short-lived access token. */
async function getAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(CALENDAR_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

interface CalendarCredentials {
  refreshToken: string
  calendarId: string
}

/** Read a provider's stored calendar credentials, or null if they never connected. */
async function getCredentials(
  payload: Payload,
  providerId: number | string,
): Promise<CalendarCredentials | null> {
  try {
    const user = (await payload.findByID({
      collection: 'users',
      id: providerId,
      depth: 0,
      overrideAccess: true,
    })) as { googleCalendar?: { connected?: boolean; refreshToken?: string; calendarId?: string } }

    const gc = user?.googleCalendar
    if (!gc?.connected || !gc.refreshToken) return null

    const refreshToken = safeDecrypt(gc.refreshToken)
    if (!refreshToken) return null

    return { refreshToken, calendarId: gc.calendarId || 'primary' }
  } catch {
    return null
  }
}

/**
 * The provider's busy blocks between two instants, from THEIR calendar.
 *
 * Returns `[]` for anyone who hasn't connected one — which is most people, and
 * is why this is safe to call unconditionally from the booking engine.
 */
export async function fetchBusyBlocks(
  payload: Payload,
  providerId: number | string,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyBlock[]> {
  const creds = await getCredentials(payload, providerId)
  if (!creds) return []

  const accessToken = await getAccessToken(creds.refreshToken)
  if (!accessToken) {
    void logError({
      level: 'warning',
      source: 'googleCalendar/fetchBusyBlocks',
      message: `Could not refresh Google token for provider ${providerId} — their calendar is being ignored, so /book may offer times they are not free. They likely revoked access and need to reconnect.`,
    })
    return []
  }

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: creds.calendarId }],
      }),
      signal: AbortSignal.timeout(CALENDAR_TIMEOUT_MS),
    })
    if (!res.ok) return []

    const data = (await res.json()) as {
      calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>
    }
    const busy = data.calendars?.[creds.calendarId]?.busy ?? []
    return busy
      .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
      .filter((b) => !isNaN(b.start.getTime()) && !isNaN(b.end.getTime()))
  } catch {
    // Timeout or transport failure — fall back to our own bookings.
    return []
  }
}

/**
 * Write a confirmed booking onto the provider's calendar. Returns the Google
 * event id, or null if they have no calendar connected / the write failed.
 *
 * Fail-soft by design: the booking is already saved in OUR system before this
 * runs. A calendar write failing must never roll back a paid appointment.
 */
export async function createCalendarEvent(
  payload: Payload,
  providerId: number | string,
  event: {
    summary: string
    description?: string
    start: Date
    end: Date
    attendeeEmail?: string
    location?: string
  },
): Promise<string | null> {
  const creds = await getCredentials(payload, providerId)
  if (!creds) return null

  const accessToken = await getAccessToken(creds.refreshToken)
  if (!accessToken) return null

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(creds.calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: { dateTime: event.start.toISOString() },
          end: { dateTime: event.end.toISOString() },
          ...(event.attendeeEmail ? { attendees: [{ email: event.attendeeEmail }] } : {}),
        }),
        signal: AbortSignal.timeout(CALENDAR_TIMEOUT_MS),
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { id?: string }
    return data.id ?? null
  } catch {
    return null
  }
}

/** Move an existing event (reschedule). Returns true on success. */
export async function updateCalendarEvent(
  payload: Payload,
  providerId: number | string,
  eventId: string,
  patch: { start?: Date; end?: Date; summary?: string },
): Promise<boolean> {
  const creds = await getCredentials(payload, providerId)
  if (!creds) return false
  const accessToken = await getAccessToken(creds.refreshToken)
  if (!accessToken) return false

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(creds.calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(patch.summary ? { summary: patch.summary } : {}),
          ...(patch.start ? { start: { dateTime: patch.start.toISOString() } } : {}),
          ...(patch.end ? { end: { dateTime: patch.end.toISOString() } } : {}),
        }),
        signal: AbortSignal.timeout(CALENDAR_TIMEOUT_MS),
      },
    )
    return res.ok
  } catch {
    return false
  }
}

/** Remove an event (cancellation). Treats 404/410 as success — already gone is
 *  the outcome we wanted. */
export async function deleteCalendarEvent(
  payload: Payload,
  providerId: number | string,
  eventId: string,
): Promise<boolean> {
  const creds = await getCredentials(payload, providerId)
  if (!creds) return false
  const accessToken = await getAccessToken(creds.refreshToken)
  if (!accessToken) return false

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(creds.calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(CALENDAR_TIMEOUT_MS),
      },
    )
    return res.ok || res.status === 404 || res.status === 410
  } catch {
    return false
  }
}
