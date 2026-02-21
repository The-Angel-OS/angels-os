/**
 * LiveKit Token Endpoint — POST /api/livekit/token
 *
 * Generates a short-lived LiveKit access token for the current user
 * to join a voice/video room scoped to a specific channel.
 *
 * Room naming convention: {tenantSlug}-{spaceSlug}-{channelSlug}
 * This ensures rooms are unique per tenant + space + channel.
 *
 * @see https://docs.livekit.io/server/generating-tokens/
 */
import type { PayloadHandler } from 'payload'
import { AccessToken } from 'livekit-server-sdk'

export const liveKitTokenHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const liveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

  if (!apiKey || !apiSecret || !liveKitUrl) {
    return Response.json(
      { error: 'LiveKit is not configured. Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or NEXT_PUBLIC_LIVEKIT_URL.' },
      { status: 503 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { spaceId, channelSlug } = body

  if (!spaceId || !channelSlug) {
    return Response.json(
      { error: 'spaceId and channelSlug are required.' },
      { status: 400 },
    )
  }

  // Resolve space and tenant for room name
  let roomName: string
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const space = await payload.findByID({
      collection: 'spaces',
      id: spaceId as number,
      depth: 1,
    }) as any

    if (!space) {
      return Response.json({ error: 'Space not found.' }, { status: 404 })
    }

    const tenant =
      typeof space.tenant === 'object' && space.tenant !== null
        ? space.tenant
        : null
    const tenantSlug = tenant?.slug || 'default'
    const spaceSlug = space.slug || String(spaceId)

    // Room name: tenant-space-channel (lowercase, sanitized)
    roomName = `${tenantSlug}-${spaceSlug}-${String(channelSlug)}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
  } catch {
    return Response.json({ error: 'Failed to resolve space.' }, { status: 500 })
  }

  // Verify user has access to this space via membership
  try {
    const memberships = await payload.find({
      collection: 'space-memberships',
      where: {
        and: [
          { user: { equals: user.id } },
          { space: { equals: spaceId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRoles = (user as any).roles || []
    const isSuperAdmin = Array.isArray(userRoles) && userRoles.includes('super_admin')

    if (!isSuperAdmin && memberships.docs.length === 0) {
      return Response.json(
        { error: 'You are not a member of this space.' },
        { status: 403 },
      )
    }
  } catch {
    return Response.json({ error: 'Failed to verify space membership.' }, { status: 500 })
  }

  // Generate LiveKit access token
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userName = (user as any).name || (user as any).email || `user-${user.id}`

    const at = new AccessToken(apiKey, apiSecret, {
      identity: String(user.id),
      name: userName,
      ttl: '2h', // 2 hour token
    })

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    const token = await at.toJwt()

    return Response.json({
      success: true,
      token,
      roomName,
      url: liveKitUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate LiveKit token'
    return Response.json({ error: message }, { status: 500 })
  }
}
