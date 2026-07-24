/**
 * Google identity → Payload session helper
 *
 * Shared by:
 *   - auth-google.ts (web OAuth code-exchange callback)
 *   - auth-federated.ts (native id_token federation)
 *
 * Given verified Google claims, this:
 *   1. finds or creates the matching Users doc (linking the google
 *      socialProviders entry),
 *   2. mints a Payload-compatible session (`sid`) — required by Payload 3.x
 *      useSessions default, or the JWT strategy rejects the token,
 *   3. signs a Payload JWT with `req.payload.secret` (the internally-hashed
 *      secret, NOT the raw env var).
 *
 * Returns the resolved user and a bearer-usable Payload token.
 */
import type { Payload } from 'payload'
import { SignJWT } from 'jose'
import crypto from 'crypto'

export interface GoogleClaims {
  email?: string
  name?: string
  sub?: string
  picture?: string
}

export interface ResolvedGoogleUser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any
  token: string
  isNew: boolean
}

const TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60 // 14 days

/**
 * Resolve (find-or-create) a Users doc from verified Google claims and mint a
 * Payload JWT. Callers MUST have already verified the token's authenticity
 * (either via the OAuth code exchange or JWKS signature check).
 */
export async function resolveUserFromGoogleClaims(
  payload: Payload,
  claims: GoogleClaims,
): Promise<ResolvedGoogleUser> {
  const { email, name, sub, picture } = claims

  if (!email || !sub) {
    throw new Error('Google token missing required claims (email, sub).')
  }

  const socialEntry = {
    provider: 'google' as const,
    providerId: sub,
    email,
    displayName: name || '',
    avatarUrl: picture || '',
    linkedAt: new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })

  const isNew = existing.docs.length === 0

  if (!isNew) {
    user = existing.docs[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const providers: any[] = Array.isArray(user.socialProviders)
      ? user.socialProviders
      : []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alreadyLinked = providers.some((p: any) => p.providerId === sub)

    if (!alreadyLinked) {
      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          socialProviders: [...providers, socialEntry],
        } as any, // socialProviders not yet in generated types
        overrideAccess: true,
      })
    }
  } else {
    user = await payload.create({
      collection: 'users',
      data: {
        email,
        name: name || '',
        password: crypto.randomUUID() + crypto.randomUUID(),
        roles: ['customer'],
        socialProviders: [socialEntry],
      } as any, // socialProviders not yet in generated types
      overrideAccess: true,
    })
  }

  // PII-safe: log only opaque IDs, never email
  console.log('[Google Identity] User resolved:', { userId: user.id, isNew })

  // ----- Create session (required for Payload 3.x useSessions default) -----
  const sid = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_SECONDS * 1000)
  const session = {
    id: sid,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingSessions: any[] = (user as any).sessions || []
  const validSessions = existingSessions.filter(
    (s: { expiresAt: string }) => new Date(s.expiresAt) > now,
  )
  validSessions.push(session)

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { sessions: validSessions } as any,
    depth: 0,
    overrideAccess: true,
  })

  // ----- Generate Payload-compatible JWT -----
  // CRITICAL: Use `payload.secret` — Payload internally hashes the config
  // secret via sha256(PAYLOAD_SECRET).slice(0, 32). Signing with the raw env
  // var produces tokens Payload's JWT strategy cannot verify.
  const secretKey = new TextEncoder().encode(payload.secret)
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiration = issuedAt + TOKEN_TTL_SECONDS

  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    collection: 'users',
    sid,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiration)
    .sign(secretKey)

  // Onboarding floor: every person gets their personal guardian-angel portal on
  // Google sign-in. This lives HERE (not in a single endpoint) because it's the
  // shared choke point for BOTH Google entry paths — the native id_token
  // federation (auth-federated) AND the system-browser OAuth callback that Nimue
  // actually uses (auth-google). Idempotent (find-or-mint by gmail⇔angel 1:1), so
  // repeat logins are a fast find; awaited so the angel is ready when the client
  // loads My Portals, but fail-soft — a provisioning hiccup never blocks sign-in.
  try {
    const { ensureBaselineMemberships } = await import('@/utilities/ensureBaselineMemberships')
    await ensureBaselineMemberships(payload, { id: user.id, email: user.email, name: user.name })
  } catch (gaErr) {
    console.warn('[Google Identity] baseline memberships failed:', gaErr instanceof Error ? gaErr.message : gaErr)
  }

  return { user, token, isNew }
}
