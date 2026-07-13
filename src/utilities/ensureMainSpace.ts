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

/**
 * Local-API options for a provisioning write. overrideAccess bypasses the
 * collection's access; the request (when in flight) is threaded so writes join
 * its transaction.
 *
 * ⚠️ THE actual "invited members land in an empty Community space" bug was NOT
 * access — it was a STRING space id. The multi-tenant plugin adds filterOptions
 * to channels.space that, on create, validates the id against the tenant's
 * spaces; that check compares the submitted id against numeric ids in JS, so a
 * STRING "62" never matches numeric 62 → "The following field is invalid:
 * Space", swallowed silently. ensureSystemSpace (AI Bus) passed the raw numeric
 * id and worked; ensureMainSpace String()'d it and didn't. The finding took a
 * probe (docs: proved every create strategy works with a NUMBER, none of the
 * user/req variants mattered). Fix: coerce space/tenant to Number below.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sysOpts(req?: any): Record<string, unknown> {
  return { overrideAccess: true, ...(req ? { req } : {}) }
}

export async function ensureMainSpace(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  tenantId: number | string,
  tenantName?: string,
  tenantSlug?: string,
  // Optional in-flight request — when present, writes join its transaction (via
  // sysOpts, which clones it and swaps in SYSTEM_ADMIN). The privileged user, not
  // the req, is what actually fixes the empty-Community-space bug; see SYSTEM_ADMIN.
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
      ...sysOpts(req),
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
            ...sysOpts(req),
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
        ...sysOpts(req),
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
        tenant: Number(tenantId),
      },
      ...sysOpts(req),
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
      ...sysOpts(req),
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
              data: { tenant: Number(tenantId) },
              ...sysOpts(req),
            })
          } catch {
            console.warn(`[ensureMainSpace] Failed to backfill tenant on channel ${template.slug}`)
          }
        }
      } else {
        // Create missing channel — surface the REAL error (was silently swallowed,
        // which hid the relationship-validation failure on prod for weeks: see
        // SYSTEM_ADMIN — the space read during validation returned nothing without
        // a privileged user, so every create failed "invalid field: Space").
        try {
          const channel = await payload.create({
            collection: 'channels',
            data: {
              name: template.name,
              slug: template.slug,
              description: template.description,
              type: template.type as string,
              // Number(), NOT `as number`: the multi-tenant relationship validation
              // matches the submitted id against numeric space ids in JS, so a
              // STRING id silently fails "invalid: Space". This was THE bug.
              space: Number(spaceId),
              isDefault: template.isDefault,
              tenant: Number(tenantId),
            } as any,
            ...sysOpts(req),
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
