/**
 * ensureMainSpace — Creates or returns the "main" community space for a tenant.
 *
 * Every tenant/endeavor has one main space that all members auto-join on onboarding.
 * This utility is idempotent — safe to call multiple times for the same tenant.
 *
 * Pattern follows ensureSystemSpace.ts (AI Bus / DMs spaces).
 *
 * @returns { spaceId, channelIds, created } or undefined on failure
 */

/** Default channels every main community space should have */
const MAIN_SPACE_CHANNELS = [
  {
    name: 'main',
    slug: 'main',
    description: 'The main community channel — where everyone lands.',
    type: 'general',
    isDefault: true,
  },
  {
    name: 'announcements',
    slug: 'announcements',
    description: 'Important updates and announcements',
    type: 'general',
    isDefault: false,
  },
  {
    name: 'support',
    slug: 'support',
    description: 'Help and support requests',
    type: 'support',
    isDefault: false,
  },
] as const

interface EnsureMainSpaceResult {
  spaceId: string
  channelIds: string[]
  created: boolean
  /** Channels created THIS call (vs already-present). */
  channelsCreated: number
  /** Real errors from channel creation — surfaced, no longer swallowed. */
  channelErrors: string[]
}

export async function ensureMainSpace(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  tenantId: number | string,
  tenantName?: string,
  tenantSlug?: string,
  // Pass the request so writes JOIN its transaction/connection. Without it,
  // every payload.create opens an AUTONOMOUS connection — on prod's PgBouncer
  // pool (small, transaction-mode) those starve behind the endpoint's own
  // transaction and the channel creates silently fail (the bug that left
  // invited-in members staring at an empty Community space). See callers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req?: any,
): Promise<EnsureMainSpaceResult | undefined> {
  try {
    // 1. Check if a main space already exists for this tenant
    const existing = await payload.find({
      collection: 'spaces',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { isMain: { equals: true } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })

    if (existing.docs?.[0]) {
      // Main space exists — self-heal the name to "Community" (older portals were
      // named "<Person> Community"), ensure channels, then return.
      const spaceId = String(existing.docs[0].id)
      const cur = existing.docs[0] as { name?: string; slug?: string }
      if (cur.name !== 'Community') {
        try {
          await payload.update({
            collection: 'spaces',
            id: spaceId,
            data: { name: 'Community', slug: 'community' },
            overrideAccess: true,
            req,
          })
        } catch {
          /* non-fatal — slug collision or drift; leave the existing name */
        }
      }
      const { channelIds, created: channelsCreated, errors: channelErrors } =
        await ensureMainChannels(payload, spaceId, tenantId, req)
      return { spaceId, channelIds, created: false, channelsCreated, channelErrors }
    }

    // 2. Resolve tenant name/slug if not provided
    if (!tenantName || !tenantSlug) {
      const tenant = await payload.findByID({
        collection: 'tenants',
        id: tenantId,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (!tenantName) tenantName = tenant?.name || 'Community'
      if (!tenantSlug) tenantSlug = tenant?.slug || 'community'
    }

    // 3. Create the main community space — always named "Community" (not
    //    "<Person> Community"); the tenant already carries the person/brand name.
    const space = await payload.create({
      collection: 'spaces',
      data: {
        name: 'Community',
        slug: 'community',
        description: `The community space for ${tenantName}. All members are automatically added here.`,
        visibility: 'invite_only',
        isMain: true,
        tenant: tenantId as number,
      },
      overrideAccess: true,
      req,
    })

    const spaceId = String(space.id)

    // 4. Create default channels
    const { channelIds, created: channelsCreated, errors: channelErrors } =
      await ensureMainChannels(payload, spaceId, tenantId, req)

    payload.logger?.info?.(
      `[ensureMainSpace] Created "Community" space (${spaceId}) with ${channelIds.length} channels for tenant ${tenantId}`,
    )

    return { spaceId, channelIds, created: true, channelsCreated, channelErrors }
  } catch (err) {
    // Non-critical — don't break tenant creation
    console.warn('[ensureMainSpace] Failed to ensure main space:', err)
    return undefined
  }
}

/**
 * Ensure default channels exist for the main space.
 * Self-healing: creates missing channels, backfills missing tenant IDs.
 */
async function ensureMainChannels(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  spaceId: string | number,
  tenantId: number | string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req?: any,
): Promise<{ channelIds: string[]; created: number; errors: string[] }> {
  const channelIds: string[] = []
  const errors: string[] = []
  let created = 0

  try {
    // Fetch existing channels for this space
    const existingChannels = await payload.find({
      collection: 'channels',
      where: { space: { equals: spaceId } },
      limit: 50,
      depth: 0,
      overrideAccess: true,
      req,
    })

    const existingBySlug = new Map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      existingChannels.docs.map((ch: any) => [ch.slug, ch]),
    )

    for (const template of MAIN_SPACE_CHANNELS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = existingBySlug.get(template.slug) as any

      if (existing) {
        channelIds.push(String(existing.id))

        // Self-heal: backfill tenant if missing
        if (!existing.tenant) {
          try {
            await payload.update({
              collection: 'channels',
              id: existing.id,
              data: { tenant: tenantId as number },
              overrideAccess: true,
              req,
            })
          } catch {
            console.warn(`[ensureMainSpace] Failed to backfill tenant on channel ${template.slug}`)
          }
        }
      } else {
        // Create missing channel — surface the REAL error (was silently swallowed,
        // which hid the pool-starvation failure on prod for weeks).
        try {
          const channel = await payload.create({
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
            req,
          })
          channelIds.push(String(channel.id))
          created++
        } catch (e) {
          const msg = `channel ${template.slug}: ${e instanceof Error ? e.message : String(e)}`
          errors.push(msg)
          payload.logger?.error?.(`[ensureMainSpace] ${msg}`)
        }
      }
    }
  } catch (err) {
    const msg = `list/heal channels: ${err instanceof Error ? err.message : String(err)}`
    errors.push(msg)
    payload.logger?.error?.(`[ensureMainSpace] ${msg}`)
  }

  return { channelIds, created, errors }
}
