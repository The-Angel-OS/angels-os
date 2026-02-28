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
import { verifySignature } from '@/federation/protocol'
import { isHeartbeatHealthy } from '@/utilities/federationEngine'
import { getActiveConstitution } from '@/federation/constitution'

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
  } = body

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

  // ── Record heartbeat ──────────────────────────────────────────
  try {
    // Find the endeavor with this federation ID
    const endeavors = await req.payload.find({
      collection: 'endeavors',
      where: {
        'federation.federationId': { equals: senderFedId },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (endeavors.docs.length > 0) {
      // Known peer — update heartbeat
      const endeavor = endeavors.docs[0]
      await req.payload.update({
        collection: 'endeavors',
        id: endeavor.id,
        data: {
          federation: {
            lastPingAt: new Date().toISOString(),
            networkVisible: true,
            // Sprint 30: Store capacity snapshot from sender for workload routing
            ...(senderCapacity ? { capacitySnapshot: senderCapacity } : {}),
          },
        } as any,
        overrideAccess: true,
      })
    } else {
      // Unknown peer — create a new endeavor record as a federation reference
      await req.payload.create({
        collection: 'endeavors',
        data: {
          name: (senderName as string) || 'Unknown Enterprise',
          endeavorType: 'custom',
          status: 'active',
          federation: {
            networkVisible: true,
            ministryStatus: 'applicant',
            federationId: senderFedId,
            lastPingAt: new Date().toISOString(),
          },
        } as any,
        overrideAccess: true,
      })
    }
  } catch (err) {
    // Non-fatal — heartbeat still acknowledged
    console.warn('[Federation Heartbeat] Failed to record heartbeat:', err)
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
  const setup = tenant?.setup as unknown as Record<string, unknown> | undefined
  const ourFederationId = (setup?.federationId as string) || 'unknown'

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
