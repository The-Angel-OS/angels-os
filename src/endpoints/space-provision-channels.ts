/**
 * Space Provision Channels Endpoint — POST /api/spaces/provision-channels
 *
 * Creates the default channel set (general, announcements) for an existing
 * space that was created without them (e.g. via Payload Admin or before
 * the auto-channel feature existed).  Idempotent — skips any channel
 * whose slug already exists in the space.
 *
 * Auth: space_admin, admin, archangel, or super_admin.
 *
 * Body:
 *   spaceId  number | string  — ID of the space to provision.
 */
import type { PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { SPACE_TEMPLATES } from '@/utilities/spaceProvisioning'

const DEFAULT_CHANNELS = [
  { name: 'general', type: 'general', description: 'General discussion', isDefault: true },
  { name: 'announcements', type: 'announcements', description: 'Important updates and news', isDefault: false },
]

const ADMIN_ROLES = ['super_admin', 'admin', 'archangel']

export const spaceProvisionChannelsHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rateLimited = applyRateLimit(req, 'spaces_create')
  if (rateLimited) return rateLimited

  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { spaceId, template } = body

  if (!spaceId) {
    return Response.json({ error: 'spaceId is required' }, { status: 400 })
  }

  try {
    // Fetch the space
    const space = await payload.findByID({
      collection: 'spaces' as any,
      id: spaceId as number,
      depth: 0,
      overrideAccess: true,
    }) as any

    if (!space) {
      return Response.json({ error: 'Space not found' }, { status: 404 })
    }

    const tenantId = typeof space.tenant === 'object' ? space.tenant?.id : space.tenant

    // Check user has permission: must be site admin OR have space_admin membership
    const userRoles = (user as any).roles as string[] | undefined
    const isGlobalAdmin = userRoles?.some((r) => ADMIN_ROLES.includes(r))

    if (!isGlobalAdmin) {
      const membership = await payload.find({
        collection: 'space-memberships' as any,
        where: {
          user: { equals: user.id },
          space: { equals: spaceId },
          status: { equals: 'active' },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      const memberRole = (membership.docs[0] as any)?.role
      if (!memberRole || !['space_admin'].includes(memberRole)) {
        return Response.json({ error: 'You must be a space admin to provision channels' }, { status: 403 })
      }
    }

    // Find existing channels for this space to avoid duplicates
    const existing = await payload.find({
      collection: 'channels' as any,
      where: { space: { equals: spaceId } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    const existingSlugs = new Set((existing.docs as any[]).map((ch) => ch.slug))

    // Determine which channels to create
    const templateKey = template as keyof typeof SPACE_TEMPLATES | undefined
    const channelDefs =
      templateKey && SPACE_TEMPLATES[templateKey]
        ? SPACE_TEMPLATES[templateKey].channels
        : DEFAULT_CHANNELS

    const created: string[] = []
    const skipped: string[] = []

    for (const ch of channelDefs) {
      if (existingSlugs.has(ch.name)) {
        skipped.push(ch.name)
        continue
      }

      await payload.create({
        collection: 'channels' as any,
        data: {
          name: ch.name,
          slug: ch.name,
          description: ch.description,
          space: Number(spaceId),
          type: ch.type as 'general',
          isDefault: (ch as { isDefault?: boolean }).isDefault ?? false,
          ...(tenantId ? { tenant: tenantId } : {}),
        },
        overrideAccess: true,
      })
      created.push(ch.name)
    }

    return Response.json({
      success: true,
      spaceId,
      created,
      skipped,
      message: created.length > 0
        ? `Created ${created.length} channel(s): ${created.join(', ')}`
        : 'No new channels needed — all defaults already exist.',
    })
  } catch (err) {
    console.error('[provision-channels] Error:', err)
    return Response.json({ error: 'Failed to provision channels' }, { status: 500 })
  }
}
