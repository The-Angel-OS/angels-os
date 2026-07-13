/**
 * Ensure the universal Community space — POST /api/provision-ops/ensure-community-space
 *
 * Designates (or creates) THE town square: a single space on the platform tenant
 * marked visibility:'community', which PermissionService.resolveVisibleSpaceIds
 * makes readable + postable by EVERY authenticated user on the node — no tenant
 * membership, no invite. This is the shared place everyone lands (distinct from a
 * user's guardian angel, which is their private home).
 *
 * Idempotent: find-or-create the space (slug 'community' on the platform tenant),
 * force its visibility to 'community', and ensure a default 'town-square' channel.
 * super_admin-gated (it touches the platform tenant). Safe to re-run.
 */
import type { PayloadHandler } from 'payload'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function platformTenantId(payload: any): Promise<number | string> {
  try {
    const res = await payload.find({
      collection: 'tenants',
      where: { type: { equals: 'platform' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const id = (res.docs?.[0] as { id?: number | string } | undefined)?.id
    if (id != null) return id
  } catch {
    /* fall through */
  }
  return 1
}

export const ensureCommunitySpaceHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'sign-in required' }, { status: 401 })
  if (!checkRole(ADMIN_ROLES, user)) {
    return Response.json({ error: 'super_admin required' }, { status: 403 })
  }

  const tenantId = await platformTenantId(payload)

  // 1. Find-or-create the Community space (slug 'community' on the platform tenant).
  const existing = await payload.find({
    collection: 'spaces',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: 'community' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  let space = existing.docs?.[0] as { id: number | string; visibility?: string } | undefined
  let created = false
  if (!space) {
    space = (await payload.create({
      collection: 'spaces',
      data: {
        name: 'Community',
        slug: 'community',
        tenant: tenantId,
        visibility: 'community',
        description: 'The town square — a shared space everyone on Angel OS can read and post in.',
      } as never,
      overrideAccess: true,
    })) as { id: number | string; visibility?: string }
    created = true
  } else if (space.visibility !== 'community') {
    // Designate an existing space as the town square (e.g. a pre-existing 'community'
    // space that was only 'public' before this tier existed).
    space = (await payload.update({
      collection: 'spaces',
      id: space.id,
      data: { visibility: 'community' } as never,
      overrideAccess: true,
      overrideLock: true as never,
    })) as { id: number | string; visibility?: string }
  }

  // 2. Ensure a default channel exists so people can actually post on arrival.
  const chans = await payload.find({
    collection: 'channels',
    where: { and: [{ space: { equals: space.id } }, { slug: { equals: 'town-square' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  let channelId = (chans.docs?.[0] as { id?: number | string } | undefined)?.id
  if (channelId == null) {
    const ch = (await payload.create({
      collection: 'channels',
      data: {
        name: 'Town Square',
        slug: 'town-square',
        type: 'general',
        space: space.id,
        tenant: tenantId,
        description: 'Say hello — this channel is open to everyone.',
      } as never,
      overrideAccess: true,
    })) as { id: number | string }
    channelId = ch.id
  }

  return Response.json({
    ok: true,
    created,
    space: { id: space.id, slug: 'community', visibility: 'community' },
    channel: { id: channelId, slug: 'town-square' },
    tenantId,
  })
}
