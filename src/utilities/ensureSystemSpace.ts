/** Slug for the system-created AI Bus space */
export const AI_BUS_SPACE_SLUG = 'ai-bus'
export const AI_BUS_SPACE_NAME = 'AI Bus'

/** Slug for the system-created Direct Messages space */
export const DM_SPACE_SLUG = 'direct-messages'
export const DM_SPACE_NAME = 'Direct Messages'

/** Default channels every AI Bus space should have.
 *
 * Architecture: one channel per integration/concern. The channel owns its messages.
 * - `leo` is the single LEO AI assistant channel (prevents duplicates)
 * - Integration channels (email, whatsapp, sms) are provisioned when integrations are enabled
 * - System channels (errors, system-log) capture operational events
 */
const AI_BUS_CHANNELS = [
  { name: 'LEO', slug: 'leo', description: 'LEO AI assistant — your primary AI interface', type: 'leo', isDefault: true },
  { name: 'general', slug: 'general', description: 'AI agent activity feed', type: 'general', isDefault: false },
  { name: 'support', slug: 'support', description: 'Support requests and system help', type: 'support', isDefault: false },
  { name: 'errors', slug: 'errors', description: 'System errors and warnings — LEO monitors this channel', type: 'general', isDefault: false },
  { name: 'system-log', slug: 'system-log', description: 'System event log — cron jobs, integrations, provisioning', type: 'general', isDefault: false },
  { name: 'Email', slug: 'email-inbox', description: 'Inbound email threads — messages arrive here from connected email accounts', type: 'email', isDefault: false },
  { name: 'Gotify', slug: 'gotify', description: 'Inbound Gotify notifications (Uptime-Kuma, system alerts) mirrored from connected Gotify servers', type: 'social', isDefault: false },
] as const

/**
 * Ensures the AI Bus system space exists for a given tenant.
 *
 * The AI Bus space is a private, system-created space where all AI agent
 * activity is visible. It's created on first visit to the spaces page.
 *
 * Also ensures default channels exist with proper tenant scoping.
 * Self-healing: backfills missing tenant IDs on orphaned channels.
 *
 * @returns The space ID of the AI Bus space
 */
export async function ensureSystemSpace(
  tenantId: number | string,
): Promise<string | undefined> {
  try {
    // Lazy import: avoids pulling @payload-config into every module that imports this file
    const { getPayload } = await import('payload')
    const configPromise = (await import('@payload-config')).default
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

    let spaceId: string | number

    if (existing.docs?.[0]) {
      spaceId = existing.docs[0].id
    } else {
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
      spaceId = space.id
    }

    // Ensure all default channels exist with proper tenant scoping
    await ensureChannels(payload, spaceId, tenantId)

    return String(spaceId)
  } catch (err) {
    // Non-critical — spaces page works without AI Bus space
    console.warn('[ensureSystemSpace] Failed to ensure AI Bus space:', err)
    return undefined
  }
}

/**
 * Resolve the AI Bus space id for a tenant from an existing Payload instance.
 * Cheap query first; falls back to ensureSystemSpace (which creates it) only if
 * missing. This is the canonical "where do automated/integration/page channels
 * live" lookup — they ALL belong on the AI Bus, never a human community space.
 */
export async function resolveAiBusSpaceId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: { find: (...args: any[]) => Promise<any> },
  tenantId: number | string,
): Promise<string | undefined> {
  try {
    const existing = await payload.find({
      collection: 'spaces',
      where: {
        and: [{ tenant: { equals: tenantId } }, { slug: { equals: AI_BUS_SPACE_SLUG } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs?.[0]) return String(existing.docs[0].id)
  } catch {
    /* fall through to create */
  }
  // Not found — create it (and its channels) via the heavier path.
  return ensureSystemSpace(tenantId)
}

/**
 * Ensure default channels exist for a space, creating missing ones
 * and backfilling tenant IDs on orphaned channels (self-healing).
 */
async function ensureChannels(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: { find: (...args: any[]) => Promise<any>; create: (...args: any[]) => Promise<any>; update: (...args: any[]) => Promise<any> },
  spaceId: string | number,
  tenantId: number | string,
): Promise<void> {
  // Fetch existing channels for this space (bypass tenant filter)
  const existingChannels = await payload.find({
    collection: 'channels',
    where: { space: { equals: spaceId } },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  const existingBySlug = new Map(
    existingChannels.docs.map((ch: any) => [ch.slug, ch]),
  )

  for (const template of AI_BUS_CHANNELS) {
    const existing = existingBySlug.get(template.slug) as any

    if (existing) {
      // Self-heal: backfill tenant if missing (fixes orphaned channels)
      if (!existing.tenant) {
        try {
          await payload.update({
            collection: 'channels',
            id: existing.id,
            data: { tenant: tenantId as number },
            overrideAccess: true,
          })
        } catch {
          console.warn(`[ensureSystemSpace] Failed to backfill tenant on channel ${template.slug}`)
        }
      }
    } else {
      // Create missing channel
      try {
        await payload.create({
          collection: 'channels',
          data: {
            name: template.name,
            slug: template.slug,
            description: template.description,
            type: template.type as string,
            space: spaceId as number,
            isDefault: template.isDefault,
            tenant: tenantId as number,
          } as any,
          overrideAccess: true,
        })
      } catch {
        console.warn(`[ensureSystemSpace] Failed to create channel ${template.slug}`)
      }
    }
  }
}

/**
 * Ensures the Direct Messages system space exists for a given tenant.
 *
 * Same self-healing pattern as AI Bus. No default channels — DM channels
 * are created on-demand via findOrCreateDM.
 *
 * @returns The space ID of the DMs space, or undefined on failure
 */
export async function ensureDMSpace(
  tenantId: number | string,
): Promise<string | undefined> {
  try {
    const { getPayload } = await import('payload')
    const configPromise = (await import('@payload-config')).default
    const payload = await getPayload({ config: configPromise })

    // Check if DMs space already exists for this tenant
    const existing = await payload.find({
      collection: 'spaces',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { slug: { equals: DM_SPACE_SLUG } },
        ],
      },
      limit: 1,
      depth: 0,
    })

    if (existing.docs?.[0]) {
      return String(existing.docs[0].id)
    }

    // Create the DMs space
    const space = await payload.create({
      collection: 'spaces',
      data: {
        name: DM_SPACE_NAME,
        slug: DM_SPACE_SLUG,
        description: 'System space for direct messages between users and LEO.',
        visibility: 'private',
        tenant: tenantId as number,
      },
      overrideAccess: true,
    })

    return String(space.id)
  } catch (err) {
    console.warn('[ensureDMSpace] Failed to ensure DMs space:', err)
    return undefined
  }
}

/**
 * Ensures a user has an active SpaceMembership in the DMs space.
 * Creates one if missing. Idempotent.
 */
export async function ensureDMSpaceMembership(
  userId: number | string,
  dmSpaceId: number | string,
  tenantId: number | string,
): Promise<void> {
  try {
    const { getPayload } = await import('payload')
    const configPromise = (await import('@payload-config')).default
    const payload = await getPayload({ config: configPromise })

    // Check existing membership
    const existing = await payload.find({
      collection: 'space-memberships',
      where: {
        and: [
          { user: { equals: userId } },
          { space: { equals: dmSpaceId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.docs?.length > 0) return

    // Create membership
    await payload.create({
      collection: 'space-memberships',
      data: {
        user: userId as number,
        space: dmSpaceId as number,
        role: 'member',
        status: 'active',
        tenant: tenantId as number,
      } as any,
      overrideAccess: true,
    })
  } catch (err) {
    console.warn('[ensureDMSpaceMembership] Failed:', err)
  }
}
