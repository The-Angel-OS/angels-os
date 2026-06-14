/**
 * Federation Heartbeat Endpoint — POST /api/federation/heartbeat
 *
 * Receives heartbeats from other Enterprises in the Angel OS federation.
 * Verifies Ed25519 signature, updates the sender's last heartbeat timestamp,
 * and returns this Enterprise's health summary.
 *
 * This is the pulse of the federation — every 5 minutes, healthy nodes
 * exchange heartbeats. If a node goes silent for > 300 seconds, it's marked
 * unhealthy by its peers.
 *
 * Request headers (federation auth):
 *   X-Federation-Id: sender's federation UUID
 *   X-Federation-Signature: Ed25519 signature of timestamp + body
 *   X-Federation-Key: sender's public key (hex-encoded SPKI DER)
 *   X-Federation-Timestamp: ISO timestamp of the request
 *
 * Request body:
 *   { federationId, domain, name, timestamp, constitutionVersion, status, capabilities, catalogEntryCount }
 *
 * Response:
 *   { acknowledged, theirStatus, theirFederationId, message }
 *
 * Constitutional Reference: Article VII — Federation heartbeat protocol
 */

import type { PayloadHandler } from 'payload'
import { randomUUID } from 'crypto'
import { verifySignature } from '@/federation/protocol'
import { isHeartbeatHealthy } from '@/utilities/federationEngine'
import { getActiveConstitution } from '@/federation/constitution'
import { mergeStreetSignsForPeer, type StreetSignsPayload } from '@/utilities/streetSigns'

export const federationHeartbeatHandler: PayloadHandler = async (req) => {
  // ── Parse body ────────────────────────────────────────────────
  let body: Record<string, unknown>
  let rawBody: string
  try {
    rawBody = await (req as Request).text()
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return Response.json(
      { acknowledged: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  // ── Verify federation signature ───────────────────────────────
  const federationId = req.headers.get('x-federation-id')
  const signature = req.headers.get('x-federation-signature')
  const publicKey = req.headers.get('x-federation-key')
  const timestamp = req.headers.get('x-federation-timestamp')

  if (!federationId || !signature || !publicKey || !timestamp) {
    return Response.json(
      { acknowledged: false, error: 'Missing federation auth headers' },
      { status: 401 },
    )
  }

  // Verify timestamp is within 5 minutes (replay prevention)
  const requestTime = new Date(timestamp).getTime()
  const now = Date.now()
  if (isNaN(requestTime) || Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return Response.json(
      { acknowledged: false, error: 'Timestamp expired or invalid' },
      { status: 401 },
    )
  }

  // Verify Ed25519 signature
  const signable = `${timestamp}\n${rawBody}`
  const signatureValid = verifySignature(signable, signature, publicKey)
  if (!signatureValid) {
    return Response.json(
      { acknowledged: false, error: 'Invalid signature' },
      { status: 403 },
    )
  }

  // ── Validate heartbeat payload ────────────────────────────────
  const {
    federationId: senderFedId,
    domain: senderDomain,
    name: senderName,
    status: senderStatus,
    capabilities: senderCapabilities,
    catalogEntryCount,
    capacity: senderCapacity,
    endeavors: senderEndeavors,
  } = body
  // Endeavor gossip — cache the sender's network-visible endeavors so Discovery
  // can list them locally (no render-time cross-node fetch). Cap defensively.
  const cachedEndeavors = Array.isArray(senderEndeavors) ? senderEndeavors.slice(0, 200) : undefined

  if (!senderFedId || typeof senderFedId !== 'string') {
    return Response.json(
      { acknowledged: false, error: 'Missing federationId in body' },
      { status: 400 },
    )
  }

  // Verify header federationId matches body federationId
  if (federationId !== senderFedId) {
    return Response.json(
      { acknowledged: false, error: 'Federation ID mismatch between header and body' },
      { status: 400 },
    )
  }

  // ── Record heartbeat (Diocese model — peer is a remote Enterprise) ────────
  try {
    const now = new Date().toISOString()
    const peers = await req.payload.find({
      collection: 'federation-peers',
      where: { federationId: { equals: senderFedId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (peers.docs.length > 0) {
      // Known Diocese — refresh liveness + capacity. Don't downgrade an active peer.
      await req.payload.update({
        collection: 'federation-peers',
        id: peers.docs[0]!.id,
        data: {
          lastHeartbeatAt: now,
          networkVisible: true,
          consecutiveFailures: 0,
          ...(typeof senderName === 'string' ? { name: senderName } : {}),
          ...(typeof senderDomain === 'string' ? { domain: senderDomain } : {}),
          ...(senderCapacity ? { capacitySnapshot: senderCapacity } : {}),
          ...(cachedEndeavors ? { endeavors: cachedEndeavors } : {}),
        } as any,
        overrideAccess: true,
      })
    } else {
      // No federationId match. Before creating, check whether this DOMAIN already has
      // a peer — a node that rotated its federationId (e.g. its tenant `setup` was
      // reset and the id regenerated) would otherwise spawn a duplicate enterprise.
      // If the domain is known, ADOPT the new id onto the existing row so trust and
      // first-seen carry over (the row stays a single, stable peer). Only a genuinely
      // new domain joins fresh — on PROBATION (Article VII; bootstrap admits as active).
      const existingByDomain =
        typeof senderDomain === 'string' && senderDomain
          ? await req.payload.find({
              collection: 'federation-peers',
              where: { domain: { equals: senderDomain } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
          : { docs: [] as { id: string | number }[] }

      if (existingByDomain.docs.length > 0) {
        await req.payload.update({
          collection: 'federation-peers',
          id: existingByDomain.docs[0]!.id,
          data: {
            federationId: senderFedId, // adopt the rotated id — same node, same domain
            lastHeartbeatAt: now,
            networkVisible: true,
            consecutiveFailures: 0,
            ...(typeof senderName === 'string' ? { name: senderName } : {}),
            ...(senderCapacity ? { capacitySnapshot: senderCapacity } : {}),
            ...(cachedEndeavors ? { endeavors: cachedEndeavors } : {}),
          } as any,
          overrideAccess: true,
        })
      } else {
        await req.payload.create({
          collection: 'federation-peers',
          data: {
            federationId: senderFedId,
            name: (senderName as string) || `Diocese · ${(senderDomain as string) || senderFedId}`,
            ministryStatus: 'probation',
            trustLevel: 'probationary',
            networkVisible: true,
            firstSeenAt: now,
            probationStartedAt: now,
            lastHeartbeatAt: now,
            ...(typeof senderDomain === 'string' ? { domain: senderDomain } : {}),
            ...(senderCapacity ? { capacitySnapshot: senderCapacity } : {}),
            ...(cachedEndeavors ? { endeavors: cachedEndeavors } : {}),
          } as any,
          overrideAccess: true,
        })
      }
    }
  } catch (err) {
    // Non-fatal — heartbeat still acknowledged
    console.warn('[Federation Heartbeat] Failed to record heartbeat:', err)
  }

  // ── Cache incoming Street Signs gossip (Sprint 39) ─────────────
  if (body.streetSigns && typeof body.streetSigns === 'object') {
    try {
      mergeStreetSignsForPeer(
        senderFedId,
        body.streetSigns as StreetSignsPayload,
        typeof senderName === 'string' ? senderName : undefined,
        typeof senderDomain === 'string' ? senderDomain : undefined,
      )
    } catch {
      // Non-fatal — gossip cache failure does not affect heartbeat acknowledgement
    }
  }

  // ── Build our health response ─────────────────────────────────
  const constitution = getActiveConstitution()

  // Get our own federation identity
  const tenants = await req.payload.find({
    collection: 'tenants',
    limit: 1,
    depth: 0,
    overrideAccess: true,
    sort: 'createdAt',
  })

  const tenant = tenants.docs[0] as unknown as Record<string, unknown> | undefined
  const setup = (tenant?.setup as Record<string, unknown>) || {}
  // Lazily mint our federation identity so a peer is never recorded as "unknown"
  // when it makes first contact before we've federated ourselves.
  let ourFederationId = setup.federationId as string | undefined
  if (!ourFederationId && tenant) {
    ourFederationId = randomUUID()
    try {
      await req.payload.update({
        collection: 'tenants',
        id: tenant.id as number,
        data: { setup: { ...setup, federationId: ourFederationId } } as never,
        overrideAccess: true,
      })
    } catch {
      /* non-fatal — fall back to the generated id for this response */
    }
  }
  ourFederationId = ourFederationId || 'unknown'

  // Check our own health
  const ourEndeavors = await req.payload.find({
    collection: 'endeavors',
    where: { 'federation.networkVisible': { equals: true } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const ourEndeavor = ourEndeavors.docs[0] as unknown as Record<string, unknown> | undefined
  const ourFederation = ourEndeavor?.federation as unknown as Record<string, unknown> | undefined
  const ourLastPing = ourFederation?.lastPingAt as string | undefined
  const ourHealthy = isHeartbeatHealthy(ourLastPing) || true // We're alive if we're responding

  return Response.json({
    acknowledged: true,
    theirStatus: ourHealthy ? 'healthy' : 'degraded',
    theirFederationId: ourFederationId,
    theirName: (tenant?.name as string) || 'Angel OS Instance',
    constitutionVersion: constitution.version,
    message: `Heartbeat received from ${senderName || senderFedId}. Welcome, sibling.`,
  })
}
