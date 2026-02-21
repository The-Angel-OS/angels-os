import { getPayload } from 'payload'
import configPromise from '@payload-config'

/** Slug for the system-created AI Bus space */
export const AI_BUS_SPACE_SLUG = 'ai-bus'
export const AI_BUS_SPACE_NAME = 'AI Bus'

/**
 * Ensures the AI Bus system space exists for a given tenant.
 *
 * The AI Bus space is a private, system-created space where all AI agent
 * activity is visible. It's created on first visit to the spaces page.
 *
 * Also creates a default "general" channel in the space if it doesn't exist.
 *
 * @returns The space ID of the AI Bus space
 */
export async function ensureSystemSpace(
  tenantId: number | string,
): Promise<string | undefined> {
  try {
    const payload = await getPayload({ config: configPromise })

    // Check if AI Bus space already exists for this tenant
    const existing = await payload.find({
      collection: 'spaces',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { slug: { equals: AI_BUS_SPACE_SLUG } },
        ],
      },
      limit: 1,
      depth: 0,
    })

    if (existing.docs?.[0]) {
      return String(existing.docs[0].id)
    }

    // Create the AI Bus space
    const space = await payload.create({
      collection: 'spaces',
      data: {
        name: AI_BUS_SPACE_NAME,
        slug: AI_BUS_SPACE_SLUG,
        description: 'System space for AI agent activity and monitoring. All Angel actions are visible here.',
        visibility: 'private',
        tenant: tenantId as number,
      },
      overrideAccess: true,
    })

    // Create the default "general" channel
    try {
      await payload.create({
        collection: 'channels',
        data: {
          name: 'general',
          slug: 'general',
          description: 'AI agent activity feed',
          type: 'general',
          space: space.id,
          isDefault: true,
        },
        overrideAccess: true,
      })
    } catch {
      // Channel creation is non-critical — space still usable
      console.warn('[ensureSystemSpace] Failed to create default channel for AI Bus space')
    }

    return String(space.id)
  } catch (err) {
    // Non-critical — spaces page works without AI Bus space
    console.warn('[ensureSystemSpace] Failed to create AI Bus space:', err)
    return undefined
  }
}
