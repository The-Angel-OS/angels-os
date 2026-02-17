/**
 * AI Bus Polling Endpoint
 *
 * Dedicated endpoint for external agents (OpenClaw/Merlin) to efficiently
 * poll the AI Bus for new messages. Simpler than crafting complex Payload
 * REST queries — just pass `since` and optional filters.
 *
 * GET /api/ai-bus/poll?since=<ISO timestamp>&spaceId=<id>&channel=<name>&visibility=<level>&limit=<n>
 *
 * Constitutional Reference: Article IV — AI Bus Protocol
 * All communication observable at tenant level by default.
 */
import type { PayloadHandler } from 'payload'

export const aiBusPollHandler: PayloadHandler = async (req) => {
  const { user, payload } = req

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse query parameters from the URL
  const url = new URL(req.url || '', 'http://localhost')
  const since = url.searchParams.get('since')
  const spaceId = url.searchParams.get('spaceId')
  const channel = url.searchParams.get('channel')
  const visibility = url.searchParams.get('visibility')
  const limitParam = url.searchParams.get('limit')
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100)

  // Resolve tenant for the authenticated user
  // System users have servesTenant; regular users have tenants array
  const userDoc = user as unknown as Record<string, unknown>
  let tenantId: number | string | undefined

  if (userDoc.servesTenant) {
    // System agent — serves a specific tenant
    tenantId =
      typeof userDoc.servesTenant === 'object' && userDoc.servesTenant !== null
        ? (userDoc.servesTenant as { id: number }).id
        : (userDoc.servesTenant as number)
  } else if (Array.isArray(userDoc.tenants) && userDoc.tenants.length > 0) {
    // Regular user — use first tenant assignment
    const firstTenant = userDoc.tenants[0] as { tenant: number | { id: number } }
    tenantId =
      typeof firstTenant.tenant === 'object' && firstTenant.tenant !== null
        ? firstTenant.tenant.id
        : firstTenant.tenant
  }

  // Fallback: resolve from x-tenant-id header
  if (!tenantId) {
    const tenantSlug = req.headers.get('x-tenant-id')
    if (tenantSlug) {
      const tenants = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: tenantSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      tenantId = tenants.docs?.[0]?.id
    }
  }

  if (!tenantId) {
    return Response.json({ error: 'Could not resolve tenant for user' }, { status: 400 })
  }

  // Build query conditions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [{ tenant: { equals: tenantId } }]

  if (since) {
    conditions.push({ createdAt: { greater_than: since } })
  }
  if (spaceId) {
    conditions.push({ space: { equals: Number(spaceId) } })
  }
  if (channel) {
    conditions.push({ channel: { equals: channel } })
  }
  if (visibility) {
    conditions.push({ visibility: { equals: visibility } })
  }

  try {
    const result = await payload.find({
      collection: 'messages',
      where: { and: conditions },
      sort: '-createdAt',
      limit,
      depth: 1, // Populate author + space one level
      overrideAccess: true, // We've already validated tenant scope
    })

    return Response.json({
      messages: result.docs,
      lastId: result.docs[0]?.id ?? null,
      hasMore: result.hasNextPage,
      total: result.totalDocs,
    })
  } catch (error) {
    console.error('[AI Bus Poll] Query error:', error)
    return Response.json({ error: 'Failed to query AI Bus' }, { status: 500 })
  }
}
