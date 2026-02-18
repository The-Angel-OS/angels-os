/**
 * AI Bus Server-Sent Events (SSE) Endpoint
 *
 * Real-time streaming endpoint for AI Bus messages. Replaces polling with push.
 * Clients receive new messages as they're created, reducing latency from seconds
 * to near-instant.
 *
 * GET /api/ai-bus/stream?spaceId=<id>&channel=<name>
 *
 * Protocol: Server-Sent Events (text/event-stream)
 * Events:
 *   - message: New message in the subscribed space/channel
 *   - heartbeat: Keep-alive ping every 15s
 *   - error: Server-side error notification
 *
 * Constitutional Reference: Article IV — AI Bus Protocol
 * All communication observable at tenant level by default.
 */
import type { PayloadHandler } from 'payload'

// In-memory subscriber registry (per-process; works with Vercel serverless functions)
// Each subscriber has a controller to push events and metadata for filtering
type Subscriber = {
  controller: ReadableStreamDefaultController
  tenantId: number | string
  spaceId?: number
  channel?: string
  userId: number
}

const subscribers = new Set<Subscriber>()

/**
 * Broadcast a message to all matching subscribers.
 * Called from collection afterChange hooks (Messages collection).
 */
export function broadcastToSubscribers(message: {
  id: number | string
  space: number | string | { id: number }
  channel?: string
  tenant: number | string | { id: number }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}) {
  const msgTenantId =
    typeof message.tenant === 'object' && message.tenant !== null
      ? message.tenant.id
      : message.tenant
  const msgSpaceId =
    typeof message.space === 'object' && message.space !== null
      ? message.space.id
      : message.space

  for (const sub of subscribers) {
    try {
      // Match tenant
      if (String(sub.tenantId) !== String(msgTenantId)) continue
      // Match space if subscriber specified one
      if (sub.spaceId && String(sub.spaceId) !== String(msgSpaceId)) continue
      // Match channel if subscriber specified one
      if (sub.channel && sub.channel !== message.channel) continue

      const event = `event: message\ndata: ${JSON.stringify(message)}\n\n`
      sub.controller.enqueue(new TextEncoder().encode(event))
    } catch {
      // Subscriber disconnected — will be cleaned up
      subscribers.delete(sub)
    }
  }
}

/**
 * SSE endpoint handler
 */
export const aiBusStreamHandler: PayloadHandler = async (req) => {
  const { user, payload } = req

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Parse query parameters
  const url = new URL(req.url || '', 'http://localhost')
  const spaceIdParam = url.searchParams.get('spaceId')
  const channel = url.searchParams.get('channel') || undefined
  const spaceId = spaceIdParam ? Number(spaceIdParam) : undefined

  // Resolve tenant for the authenticated user
  const userDoc = user as unknown as Record<string, unknown>
  let tenantId: number | string | undefined

  if (userDoc.servesTenant) {
    tenantId =
      typeof userDoc.servesTenant === 'object' && userDoc.servesTenant !== null
        ? (userDoc.servesTenant as { id: number }).id
        : (userDoc.servesTenant as number)
  } else if (Array.isArray(userDoc.tenants) && userDoc.tenants.length > 0) {
    const firstTenant = userDoc.tenants[0] as { tenant: number | { id: number } }
    tenantId =
      typeof firstTenant.tenant === 'object' && firstTenant.tenant !== null
        ? firstTenant.tenant.id
        : firstTenant.tenant
  }

  // Fallback: resolve from header
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
    return new Response('Could not resolve tenant', { status: 400 })
  }

  // Create SSE stream
  let subscriberRef: Subscriber | undefined

  const stream = new ReadableStream({
    start(controller) {
      // Register this subscriber
      subscriberRef = {
        controller,
        tenantId: tenantId!,
        spaceId,
        channel,
        userId: typeof user.id === 'number' ? user.id : Number(user.id),
      }
      subscribers.add(subscriberRef)

      // Send initial connection event
      const connectEvent = `event: connected\ndata: ${JSON.stringify({
        tenantId,
        spaceId: spaceId || null,
        channel: channel || null,
        subscriberCount: subscribers.size,
      })}\n\n`
      controller.enqueue(new TextEncoder().encode(connectEvent))

      // Heartbeat every 15 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          const ping = `event: heartbeat\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`
          controller.enqueue(new TextEncoder().encode(ping))
        } catch {
          clearInterval(heartbeat)
          if (subscriberRef) subscribers.delete(subscriberRef)
        }
      }, 15_000)

      // Clean up on Vercel function timeout (max 60s for hobby, 300s for pro)
      // Set a safety timeout to close gracefully before Vercel kills the function
      const maxDuration = Number(process.env.SSE_MAX_DURATION) || 55_000
      setTimeout(() => {
        clearInterval(heartbeat)
        try {
          const reconnect = `event: reconnect\ndata: ${JSON.stringify({ reason: 'timeout' })}\n\n`
          controller.enqueue(new TextEncoder().encode(reconnect))
          controller.close()
        } catch {
          // Already closed
        }
        if (subscriberRef) subscribers.delete(subscriberRef)
      }, maxDuration)
    },
    cancel() {
      if (subscriberRef) subscribers.delete(subscriberRef)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  })
}
