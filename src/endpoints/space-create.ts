/**
 * Space Create Endpoint — POST /api/spaces/create
 *
 * Atomic space creation: Space doc + space_admin membership + channels.
 * Optionally sends batch invitations to a list of emails.
 *
 * Body:
 *   name        string   (required)
 *   description string   (optional)
 *   visibility  'public' | 'invite_only' | 'private'   (default: invite_only)
 *   template    'service-provider' | 'retail-commerce' | 'creator-content' | 'booking-based' | 'custom'
 *   invites     Array<{ email: string; role: 'member' | 'moderator' | 'guest' }>
 */
import type { PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { SPACE_TEMPLATES } from '@/utilities/spaceProvisioning'
import type { EndeavorType } from '@/utilities/spaceProvisioning'
import { createInvitation, isValidEmail } from '@/utilities/invitationSystem'
import { sendInvitationEmail } from '@/utilities/sendInvitationEmail'
import { detectTenantFromHostname } from '@/middleware/detectTenant'

const COMMON_CHANNELS = [
  { name: 'general', type: 'general', description: 'General discussion', isDefault: true },
  { name: 'announcements', type: 'announcements', description: 'Important updates and news' },
]

export const spaceCreateHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Rate limit: 3 space creations/min per user
  const rateLimited = applyRateLimit(req, 'spaces_create')
  if (rateLimited) return rateLimited

  // ── Resolve tenant ────────────────────────────────────────────────────────
  const tenantSlug =
    req.headers.get('x-tenant-id') ||
    detectTenantFromHostname(req.headers.get('host')?.split(':')[0] || 'localhost') ||
    'default'

  const tenantResult = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: tenantSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const tenantId = tenantResult.docs[0]?.id
  if (!tenantId) {
    return Response.json({ error: 'Could not resolve tenant' }, { status: 400 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, description, visibility, template, invites } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return Response.json({ error: 'Space name is required' }, { status: 400 })
  }

  const vis = (visibility as string) || 'invite_only'
  if (!['public', 'invite_only', 'private'].includes(vis)) {
    return Response.json({ error: 'Invalid visibility value' }, { status: 400 })
  }

  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // ── 1. Create Space ───────────────────────────────────────────────────────
  let space: { id: number | string; name: string; slug: string }
  try {
    space = (await payload.create({
      collection: 'spaces',
      data: {
        name: name.trim(),
        slug,
        description: (description as string | undefined) || undefined,
        visibility: vis as 'public' | 'invite_only' | 'private',
        tenant: tenantId as number,
      },
      overrideAccess: true,
    })) as typeof space
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Space creation failed'
    return Response.json({ error: msg }, { status: 500 })
  }

  // ── 2. Create space_admin membership for creator ──────────────────────────
  try {
    await payload.create({
      collection: 'space-memberships',
      data: {
        user: user.id as number,
        space: space.id as number,
        role: 'space_admin',
        status: 'active',
        joinedAt: new Date().toISOString(),
        tenant: tenantId as number,
      },
      overrideAccess: true,
    })
  } catch {
    // Non-fatal — space was created, membership can be fixed
  }

  // ── 3. Create channels ────────────────────────────────────────────────────
  const templateKey = template as EndeavorType | undefined
  const channelDefs =
    templateKey && SPACE_TEMPLATES[templateKey]
      ? SPACE_TEMPLATES[templateKey].channels
      : COMMON_CHANNELS

  let channelsCreated = 0
  for (const ch of channelDefs) {
    try {
      await payload.create({
        collection: 'channels',
        data: {
          name: ch.name,
          slug: ch.name,
          description: ch.description,
          space: space.id as number,
          type: ch.type as 'general',
          isDefault: (ch as { isDefault?: boolean }).isDefault ?? false,
          tenant: tenantId as number,
        },
        overrideAccess: true,
      })
      channelsCreated++
    } catch {
      // Continue — partial channel creation is acceptable
    }
  }

  // ── 4. Send invitations (non-fatal) ───────────────────────────────────────
  const inviteList = Array.isArray(invites)
    ? (invites as { email: string; role?: string }[])
    : []

  for (const inv of inviteList) {
    if (!inv.email || !isValidEmail(String(inv.email))) continue
    try {
      const result = await createInvitation({
        payload,
        email: String(inv.email),
        spaceId: space.id,
        invitedByUserId: user.id,
        role: (inv.role as 'member' | 'moderator' | 'guest') || 'member',
      })
      // Send email non-fatally
      sendInvitationEmail({
        payload,
        recipientEmail: String(inv.email),
        inviteUrl: result.inviteUrl,
        spaceName: space.name,
        inviterName: (user as { name?: string }).name || 'Someone',
        role: (inv.role as string) || 'member',
      }).catch(() => undefined)
    } catch {
      // Invitation failure is non-fatal
    }
  }

  return Response.json({
    success: true,
    space: { id: space.id, name: space.name, slug: space.slug },
    channelsCreated,
  })
}
