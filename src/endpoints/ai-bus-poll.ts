/**
 * AI Bus Polling Endpoint
 *
 * Dedicated endpoint for external agents (AngelClaw/Merlin) to efficiently
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

  // Resolve tenant for the authenticated user.
  // System users have servesTenant; everyone else is scoped to the SUBDOMAIN they
  // are viewing (x-tenant-id) — NOT user.tenants[0]. A super_admin (or any user)
  // viewing a tenant they aren't "tenants[0]" of must poll THAT tenant, or messages
  // posted on that subdomain (saved against the space's tenant) would never match.
  const userDoc = user as unknown as Record<string, unknown>
  let tenantId: number | string | undefined

  // Authorization signals from the user doc (no DB cost).
  const roles = Array.isArray((user as { roles?: unknown[] }).roles)
    ? ((user as { roles: unknown[] }).roles as unknown[])
    : []
  const isSuper = roles.includes('super_admin')
  const servesTenantId =
    typeof userDoc.servesTenant === 'object' && userDoc.servesTenant !== null
      ? (userDoc.servesTenant as { id: number | string }).id
      : (userDoc.servesTenant as number | string | undefined)
  const userTenantIds = (Array.isArray(userDoc.tenants) ? userDoc.tenants : []).map((t) => {
    const tt = (t as { tenant?: unknown }).tenant
    return tt && typeof tt === 'object' ? (tt as { id: number | string }).id : (tt as number | string)
  })
  const sameId = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b)

  // When a spaceId is supplied, the SPACE authoritatively determines the tenant —
  // the exact tenant chat-send writes against — which is more reliable than header
  // resolution on apex domains. BUT we must NOT trust a caller-supplied space to
  // pick the tenant unconditionally, or any authenticated user could read another
  // tenant's messages by passing a foreign spaceId (the query below runs with
  // overrideAccess). Only adopt the space's tenant when the user is actually
  // entitled to it; otherwise fall through to user/header resolution (which will
  // scope to the user's OWN tenant, returning nothing for a foreign space).
  if (spaceId) {
    try {
      const spaceDoc = await payload.findByID({
        collection: 'spaces',
        id: (Number(spaceId) || spaceId) as number,
        depth: 0,
        overrideAccess: true,
      })
      if (spaceDoc) {
        const spaceTenantId =
          typeof spaceDoc.tenant === 'object' && spaceDoc.tenant !== null
            ? (spaceDoc.tenant as { id: number | string }).id
            : (spaceDoc.tenant as number | string)
        const spaceVisibility = (spaceDoc as { visibility?: string }).visibility
        const authorized =
          isSuper ||
          sameId(servesTenantId, spaceTenantId) ||
          userTenantIds.some((id) => sameId(id, spaceTenantId)) ||
          spaceVisibility === 'public'
        if (authorized) tenantId = spaceTenantId
      }
    } catch (e) {
      console.warn(
        '[AI Bus Poll] space→tenant resolution failed, falling back to headers:',
        e instanceof Error ? e.message : e,
      )
    }
  }

  if (!tenantId && userDoc.servesTenant) {
    // System agent — serves a specific tenant
    tenantId =
      typeof userDoc.servesTenant === 'object' && userDoc.servesTenant !== null
        ? (userDoc.servesTenant as { id: number }).id
        : (userDoc.servesTenant as number)
  }

  // Prefer the current subdomain context.
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

  // Last fallback: the user's first tenant assignment.
  if (!tenantId && Array.isArray(userDoc.tenants) && userDoc.tenants.length > 0) {
    const firstTenant = userDoc.tenants[0] as { tenant: number | { id: number } }
    tenantId =
      typeof firstTenant.tenant === 'object' && firstTenant.tenant !== null
        ? firstTenant.tenant.id
        : firstTenant.tenant
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
