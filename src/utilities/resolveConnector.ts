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
