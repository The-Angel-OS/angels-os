import type { PayloadHandler } from 'payload'
import { findOrCreateDM } from '@/utilities/dmChannels'
import { ensureDMSpace } from '@/utilities/ensureSystemSpace'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

/**
 * POST /api/dm/find-or-create
 *
 * Find or create a DM channel between the authenticated user and a target.
 *
 * Body:
 *   - targetUserId: string | 'leo'   — The other user (or 'leo' for LEO assistant)
 *   - tenantId: string               — Tenant context
 *
 * Response:
 *   - channel: { id, slug, name }
 *   - isNew: boolean
 */
export const dmFindOrCreateHandler: PayloadHandler = async (req) => {
  const { payload, headers } = req

  // Authenticate
  const { user } = await payload.auth({ headers })
  if (!user) {
    return Response.json({ message: 'Not authenticated' }, { status: 401 })
  }

  const rateLimited = applyRateLimit(req, 'default')
  if (rateLimited) return rateLimited

  // Parse body
  let body: Record<string, unknown>
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const { targetUserId, tenantId } = body

  if (!targetUserId || !tenantId) {
    return Response.json(
      { message: 'Missing required fields: targetUserId, tenantId' },
      { status: 400 },
    )
  }

  try {
    // Ensure DMs space exists
    const dmSpaceId = await ensureDMSpace(tenantId as string)
    if (!dmSpaceId) {
      return Response.json(
        { message: 'Failed to provision DMs space' },
        { status: 500 },
      )
    }

    // Find or create the DM channel
    const result = await findOrCreateDM(
      tenantId as string,
      dmSpaceId,
      user.id,
      targetUserId as string | 'leo',
    )

    // Fetch the full channel for response
    const channel = await payload.findByID({
      collection: 'channels',
      id: result.channelId,
      depth: 1,
      overrideAccess: true,
    })

    return Response.json({
      channel: {
        id: String(channel.id),
        slug: (channel as any).slug,
        name: (channel as any).name,
        type: (channel as any).type,
        members: (channel as any).members,
        source: (channel as any).source,
      },
      dmSpaceId,
      isNew: result.isNew,
    })
  } catch (err) {
    console.error('[dm-find-or-create] Error:', err)
    return Response.json(
      { message: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
