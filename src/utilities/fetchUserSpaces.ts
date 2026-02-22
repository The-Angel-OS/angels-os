import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Space } from '@/payload-types'

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

    // Fetch active memberships with space populated
    const memberships = await payload.find({
      collection: 'space-memberships',
      where: {
        and: [
          { user: { equals: userId } },
          { status: { equals: 'active' } },
        ],
      },
      depth: 1,
      limit: 100,
      overrideAccess: true,
    })

    // Extract unique spaces, filtering to this tenant
    const seen = new Set<string>()
    const spaces: SerializedSpace[] = []

    for (const doc of memberships.docs) {
      const space =
        typeof doc.space === 'object' && doc.space !== null
          ? (doc.space as Space)
          : null
      if (!space) continue

      const id = String(space.id)
      if (seen.has(id)) continue
      seen.add(id)

      // Check tenant matches (space.tenant could be number or object)
      const spaceTenant =
        typeof space.tenant === 'object' && space.tenant !== null
          ? space.tenant.id
          : space.tenant
      if (String(spaceTenant) !== String(tenantId)) continue

      spaces.push({
        id,
        name: space.name || '',
        slug: space.slug || '',
        description: space.description ?? undefined,
        visibility: space.visibility ?? 'invite_only',
        isSystem: space.slug === AI_BUS_SLUG,
        enabledApplets: Array.isArray((space as any).enabledApplets)
          ? (space as any).enabledApplets
          : undefined,
      })
    }

    // Also fetch spaces where user might not have explicit membership but is admin
    // (e.g., AI Bus space for super_admins)
    const tenantSpaces = await payload.find({
      collection: 'spaces',
      where: { tenant: { equals: tenantId } },
      depth: 0,
      limit: 100,
      overrideAccess: true,
    })

    for (const space of tenantSpaces.docs) {
      const id = String(space.id)
      if (seen.has(id)) continue
      // Only add public spaces or the AI Bus space (system)
      const slug = space.slug || ''
      const visibility = space.visibility ?? 'invite_only'
      if (visibility === 'public' || slug === AI_BUS_SLUG) {
        seen.add(id)
        spaces.push({
          id,
          name: space.name || '',
          slug,
          description: space.description ?? undefined,
          visibility,
          isSystem: slug === AI_BUS_SLUG,
          enabledApplets: Array.isArray((space as any).enabledApplets)
            ? (space as any).enabledApplets
            : undefined,
        })
      }
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
