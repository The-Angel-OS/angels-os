import { getPayload } from 'payload'
import type { Where } from 'payload'
import configPromise from '@payload-config'
import type { Space } from '@/payload-types'
import { resolveVisibleSpaceIds } from '@/services/PermissionService'

export interface SerializedSpace {
  id: string
  name: string
  slug: string
  description?: string
  visibility?: string
  isSystem?: boolean
  enabledApplets?: string[]
}

const AI_BUS_SLUG = 'ai-bus'

/**
 * Fetch all spaces a user has active membership in, for a given tenant.
 *
 * Server-side utility for pre-loading spaces data in the spaces page.
 * Returns serialized data safe for passing to client components.
 */
export async function fetchUserSpaces(
  userId: number | string,
  tenantId: number | string,
): Promise<SerializedSpace[]> {
  try {
    const payload = await getPayload({ config: configPromise })

    // Hydrate the user (roles needed for the admin short-circuit in the resolver).
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })

    // Delegate the "which spaces may this user see?" decision to the SAME canonical
    // resolver that powers Spaces/Channels/Messages read access — so the sidebar
    // list can never diverge from what the user can actually read. Policy lives in
    // ONE place: role-inherits-non-private + explicit-private-grants.
    const visible = await resolveVisibleSpaceIds(payload, user)

    // Resolver verdict: `true` = see-everything (admin/system) → all tenant spaces.
    // Otherwise it's the concrete read-visible id set (or `false`/empty). The AI Bus
    // is a system space seeded `private` with no per-member grant, so it is NOT in
    // the resolver's set — but it must always appear in the member's sidebar (it's
    // the AI interaction surface). We surface it here as a SIDEBAR-only addition,
    // scoped to this tenant; read access to its channels/messages stays governed by
    // the canonical resolver (we do not broaden that). This keeps the visibility
    // POLICY centralized while preserving the long-standing AI-Bus affordance.
    const visibleIds = Array.isArray(visible) ? visible : []
    const where: Where =
      visible === true
        ? { tenant: { equals: tenantId } }
        : {
            and: [
              { tenant: { equals: tenantId } },
              { or: [{ id: { in: visibleIds } }, { slug: { equals: AI_BUS_SLUG } }] },
            ],
          }

    const tenantSpaces = await payload.find({
      collection: 'spaces',
      where,
      depth: 0,
      limit: 200,
      overrideAccess: true,
    })

    const seen = new Set<string>()
    const spaces: SerializedSpace[] = []

    for (const space of tenantSpaces.docs as Space[]) {
      const id = String(space.id)
      if (seen.has(id)) continue
      seen.add(id)
      const slug = space.slug || ''
      spaces.push({
        id,
        name: space.name || '',
        slug,
        description: space.description ?? undefined,
        visibility: space.visibility ?? 'invite_only',
        isSystem: slug === AI_BUS_SLUG,
        enabledApplets: Array.isArray((space as any).enabledApplets)
          ? (space as any).enabledApplets
          : undefined,
      })
    }

    // Sort: regular spaces alphabetically, AI Bus at the end
    spaces.sort((a, b) => {
      if (a.isSystem && !b.isSystem) return 1
      if (!a.isSystem && b.isSystem) return -1
      return a.name.localeCompare(b.name)
    })

    return spaces
  } catch (err) {
    console.warn('[fetchUserSpaces] Failed:', err)
    return []
  }
}
