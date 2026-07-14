/**
 * mintSessionToken — mint a Payload-compatible session + JWT for a user.
 *
 * The single reusable form of the recipe that Google identity and the system-token
 * endpoint each hand-rolled: create a `sid` session (REQUIRED by Payload 3.x
 * `useSessions` — a JWT without a valid `sid` is rejected), append it to the
 * user's sessions (pruning expired), and sign a JWT with `payload.secret` (the
 * INTERNALLY-hashed secret, not the raw env var). Returns a bearer-usable token.
 *
 * New auth entry points (email-OTP, future SSO) should call this rather than
 * re-copying the block a third time.
 */
import type { Payload } from 'payload'
import { SignJWT } from 'jose'
import crypto from 'crypto'

const DEFAULT_TTL_SECONDS = 14 * 24 * 60 * 60 // 14 days — matches Users.tokenExpiration

export interface MintedSession {
  token: string
  sid: string
  expiresAt: string
}

export async function mintSessionToken(
  payload: Payload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: { id: number | string; email: string; sessions?: any[] },
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<MintedSession> {
  const sid = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)
  const session = { id: sid, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingSessions: any[] = user.sessions || []
  const validSessions = existingSessions.filter((s: { expiresAt: string }) => new Date(s.expiresAt) > now)
  validSessions.push(session)

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { sessions: validSessions } as never,
    depth: 0,
    overrideAccess: true,
  })

  const secretKey = new TextEncoder().encode(payload.secret)
  const issuedAt = Math.floor(now.getTime() / 1000)
  const token = await new SignJWT({ id: user.id, email: user.email, collection: 'users', sid })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttlSeconds)
    .sign(secretKey)

  return { token, sid, expiresAt: expiresAt.toISOString() }
}
