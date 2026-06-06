/**
 * ensureTenantSpaces — idempotent self-heal for a tenant's baseline Spaces/Channels.
 *
 * Why: some provisioning paths created a tenant/endeavor but never made a Space
 * (e.g. the WDEG portal), so the tenant had no Community space and an empty AI
 * Bus (no space → no channels → fetchDefaultSpaceId returns undefined → chat
 * degrades). This guarantees the baseline exists, safe to run repeatedly.
 *
 * Strategy: a tenant should get its Space at PROVISION time — call this from the
 * provisioners (deterministic, full template). It also works as a backfill/
 * self-heal trigger for tenants that predate that. It is NOT a substitute for
 * lazy "create-the-channel-when-a-message-is-written" magic — see the message
 * path, which should resolve to the (now-guaranteed) default space instead.
 */
import type { Payload, PayloadRequest } from 'payload'
import {
  addChannelToSpace,
  createSpaceFromTemplate,
  type ChannelTemplate,
  type EndeavorType,
} from './spaceProvisioning'

/** The baseline every space should carry, regardless of endeavor type. */
const BASELINE_CHANNELS: ChannelTemplate[] = [
  { name: 'general', type: 'general', description: 'General discussion', isDefault: true },
  { name: 'announcements', type: 'announcements', description: 'Important updates and news' },
]

export interface EnsureSpacesResult {
  spaceId: number | string | null
  /** True when this call created the tenant's first Space. */
  createdSpace: boolean
  /** Baseline channels added to an existing space (empty when nothing was missing). */
  addedChannels: string[]
}

export async function ensureTenantSpaces(
  payload: Payload,
  tenantId: number | string,
  opts: { endeavorType?: EndeavorType; spaceName?: string; req?: PayloadRequest } = {},
): Promise<EnsureSpacesResult> {
  const reqOpt = opts.req ? { req: opts.req } : {}

  // 1. Does the tenant already have a Space? (oldest = the main/community space)
  const spaces = await payload.find({
    collection: 'spaces',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    sort: 'createdAt',
    depth: 0,
    overrideAccess: true,
    ...reqOpt,
  })

  // 2. No Space → create one from the endeavor template (resolve type if absent).
  if (!spaces.docs?.length) {
    let endeavorType = opts.endeavorType
    if (!endeavorType) {
      const endeavors = await payload
        .find({
          collection: 'endeavors',
          where: { tenant: { equals: tenantId } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          ...reqOpt,
        })
        .catch(() => ({ docs: [] as unknown[] }))
      endeavorType = ((endeavors.docs?.[0] as { endeavorType?: EndeavorType })?.endeavorType) || 'custom'
    }
    // Default the primary space to "Community" — every endeavor gets a community hub.
    const { spaceId } = await createSpaceFromTemplate(
      payload,
      endeavorType,
      tenantId,
      opts.spaceName || 'Community',
      opts.req,
    )
    return { spaceId, createdSpace: true, addedChannels: [] }
  }

  // 3. Space exists → ensure the baseline channels are present (backfill any gaps).
  const space = spaces.docs[0]!
  const existing = await payload.find({
    collection: 'channels',
    where: { and: [{ space: { equals: space.id } }, { tenant: { equals: tenantId } }] },
    limit: 100,
    depth: 0,
    overrideAccess: true,
    ...reqOpt,
  })
  const existingNames = new Set((existing.docs as Array<{ name?: string }>).map((c) => c.name))
  const addedChannels: string[] = []
  for (const ch of BASELINE_CHANNELS) {
    if (!existingNames.has(ch.name)) {
      await addChannelToSpace(payload, space.id, tenantId, ch, opts.req)
      addedChannels.push(ch.name)
    }
  }
  return { spaceId: space.id, createdSpace: false, addedChannels }
}
