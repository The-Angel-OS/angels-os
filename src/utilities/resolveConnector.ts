import type { Payload } from 'payload'

/**
 * Resolve the best-matching connector for a given type, tenant, and optional space.
 *
 * Resolution order:
 *   1. Space-level connector (type + space + tenant, enabled)
 *   2. Endeavor-level connector (type + tenant, space=null, enabled)
 *
 * When multiple connectors match at the same level, the one with the highest
 * `priority` wins. Returns null if no enabled connector is found.
 */
export async function resolveConnector(
  payload: Payload,
  opts: {
    type: string
    tenantId: number | string
    spaceId?: number | string | null
  },
): Promise<{ id: string; config: Record<string, unknown>; routingChannel?: string; systemUser?: string } | null> {
  const { type, tenantId, spaceId } = opts

  // Step 1: Try Space-level connector
  if (spaceId) {
    const spaceLevel = await payload.find({
      collection: 'connectors' as any,
      where: {
        and: [
          { type: { equals: type } },
          { tenant: { equals: tenantId } },
          { space: { equals: spaceId } },
          { enabled: { equals: true } },
          { status: { not_equals: 'error' } },
        ],
      },
      sort: '-priority',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (spaceLevel.docs?.[0]) {
      const doc = spaceLevel.docs[0] as any
      return {
        id: String(doc.id),
        config: (doc.config as Record<string, unknown>) || {},
        routingChannel: doc.routingChannel ? String(doc.routingChannel) : undefined,
        systemUser: doc.systemUser ? String(doc.systemUser) : undefined,
      }
    }
  }

  // Step 2: Endeavor-level fallback (space is null)
  const endeavorLevel = await payload.find({
    collection: 'connectors' as any,
    where: {
      and: [
        { type: { equals: type } },
        { tenant: { equals: tenantId } },
        { space: { exists: false } },
        { enabled: { equals: true } },
        { status: { not_equals: 'error' } },
      ],
    },
    sort: '-priority',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (endeavorLevel.docs?.[0]) {
    const doc = endeavorLevel.docs[0] as any
    return {
      id: String(doc.id),
      config: (doc.config as Record<string, unknown>) || {},
      routingChannel: doc.routingChannel ? String(doc.routingChannel) : undefined,
      systemUser: doc.systemUser ? String(doc.systemUser) : undefined,
    }
  }

  return null
}

/**
 * Resolve the connector BOUND to a channel (the reverse of resolveConnector).
 *
 * Connectors declare an inbound `routingChannel` — the channel their messages
 * land in (e.g. the gotify connector → the "gotify" channel). This looks that
 * binding up from the channel side, so LEO in a given channel can reach the
 * capability that channel represents. Returns the connector incl. its `type`,
 * so the caller can dispatch outbound by type.
 */
export async function resolveConnectorByChannel(
  payload: Payload,
  opts: { channelSlug: string; tenantId: number | string; spaceId?: number | string | null },
): Promise<{ id: string; type: string; config: Record<string, unknown>; channelId: string } | null> {
  const { channelSlug, tenantId, spaceId } = opts

  // 1. Resolve the channel id from its slug (scoped to tenant, and space if known).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chWhere: any = { and: [{ slug: { equals: channelSlug } }, { tenant: { equals: tenantId } }] }
  if (spaceId) chWhere.and.push({ space: { equals: spaceId } })
  const channels = await payload.find({
    collection: 'channels' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    where: chWhere,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const channelId = channels.docs?.[0]?.id
  if (channelId == null) return null

  // 2. The enabled connector whose routingChannel points at that channel.
  const conns = await payload.find({
    collection: 'connectors' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    where: {
      and: [
        { routingChannel: { equals: channelId } },
        { tenant: { equals: tenantId } },
        { enabled: { equals: true } },
        { status: { not_equals: 'error' } },
      ],
    },
    sort: '-priority',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = conns.docs?.[0] as any
  if (!doc) return null
  return {
    id: String(doc.id),
    type: String(doc.type),
    config: (doc.config as Record<string, unknown>) || {},
    channelId: String(channelId),
  }
}

/**
 * Find all enabled connectors of a given type across all tenants.
 * Used by cron jobs that need to iterate all active connectors
 * (e.g., email poll iterates all email_inbound connectors).
 */
export async function findAllConnectors(
  payload: Payload,
  type: string,
): Promise<
  Array<{
    id: string
    tenantId: string
    config: Record<string, unknown>
    routingChannel?: string
    systemUser?: string
  }>
> {
  const result = await payload.find({
    collection: 'connectors' as any,
    where: {
      and: [
        { type: { equals: type } },
        { enabled: { equals: true } },
        { status: { not_equals: 'error' } },
      ],
    },
    sort: '-priority',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  return (result.docs || []).map((doc: any) => ({
    id: String(doc.id),
    tenantId: String(doc.tenant),
    config: (doc.config as Record<string, unknown>) || {},
    routingChannel: doc.routingChannel ? String(doc.routingChannel) : undefined,
    systemUser: doc.systemUser ? String(doc.systemUser) : undefined,
  }))
}
