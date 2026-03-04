/**
 * System Token Bootstrap Endpoint
 *
 * POST /api/auth/system-token
 *
 * Allows programmatic clients (MCP server, cron jobs, scripts) to obtain
 * a valid JWT with a session ID by proving knowledge of PAYLOAD_SECRET.
 *
 * Auth: The caller sends { secretHash } where secretHash is:
 *   crypto.createHash('sha256').update(PAYLOAD_SECRET).digest('hex').slice(0, 32)
 *
 * This matches Payload's internal hashing of the secret, so:
 *   secretHash === req.payload.secret
 *
 * On success, finds/creates the system LEO user for the 'default' tenant,
 * creates a session, and returns a JWT with the correct `sid`.
 */
import type { PayloadHandler } from 'payload'
import * as crypto from 'node:crypto'
import { SignJWT } from 'jose'
import { leoSystemUserEmail, leoLegacyEmail } from '../utilities/leoEmail'

export const authSystemTokenHandler: PayloadHandler = async (req) => {
  // Only POST
  if (req.method?.toUpperCase() !== 'POST' && (req as Request).method !== 'POST') {
    return Response.json({ message: 'Method not allowed' }, { status: 405 })
  }

  // Parse body
  let body: { secretHash?: string; tenantSlug?: string }
  try {
    body = await (req as any).json()
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const { secretHash, tenantSlug = 'default' } = body

  if (!secretHash) {
    return Response.json({ message: 'Missing secretHash' }, { status: 400 })
  }

  // Validate: secretHash must match Payload's internally-hashed secret
  if (secretHash !== req.payload.secret) {
    return Response.json({ message: 'Invalid secret' }, { status: 403 })
  }

  try {
    // Find the system user (LEO) for the tenant
    const systemEmail = leoSystemUserEmail(tenantSlug)
    const legacyEmail = leoLegacyEmail(tenantSlug)

    let user: any = null

    // Try current email format first
    const result = await req.payload.find({
      collection: 'users',
      where: { email: { equals: systemEmail } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    user = result.docs[0]

    // Fallback to legacy email
    if (!user) {
      const legacy = await req.payload.find({
        collection: 'users',
        where: { email: { equals: legacyEmail } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      user = legacy.docs[0]
    }

    // Fallback: find any super_admin
    if (!user) {
      const admins = await req.payload.find({
        collection: 'users',
        limit: 1,
        sort: 'createdAt',
        depth: 0,
        overrideAccess: true,
      })
      user = admins.docs[0]
    }

    if (!user) {
      return Response.json({ message: 'No suitable user found' }, { status: 404 })
    }

    // Create session (required for Payload 3.77+ useSessions)
    const sid = crypto.randomUUID()
    const now = new Date()
    const tokenExpMs = 24 * 60 * 60 * 1000 // 24 hours (shorter for system tokens)
    const expiresAt = new Date(now.getTime() + tokenExpMs)
    const session = { id: sid, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() }

    // Append to existing valid sessions (prune expired ones)
    const existingSessions: any[] = user.sessions || []
    const validSessions = existingSessions.filter(
      (s: { expiresAt: string }) => new Date(s.expiresAt) > now,
    )
    validSessions.push(session)

    await req.payload.update({
      collection: 'users',
      id: user.id,
      data: { sessions: validSessions } as any,
      depth: 0,
      overrideAccess: true,
    })

    // Sign JWT with Payload's internal secret
    const secretKey = new TextEncoder().encode(req.payload.secret)
    const issuedAt = Math.floor(Date.now() / 1000)
    const expiration = issuedAt + 24 * 60 * 60 // 24 hours

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

    return Response.json({
      token,
      user: { id: user.id, email: user.email },
      expiresAt: expiresAt.toISOString(),
    })
  } catch (err: any) {
    return Response.json(
      { message: `System token creation failed: ${err.message || err}` },
      { status: 500 },
    )
  }
}
