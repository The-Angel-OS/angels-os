/**
 * Federation Message Endpoint — Cross-Tenant Message Receiver
 *
 * POST /api/federation/message
 *
 * Receives JWT-signed messages from federation peers, verifies trust,
 * routes to LEO, stores the message, and returns a response.
 *
 * Request body: { jwt: string, publicKey: string }
 *   jwt       — EdDSA-signed JWT with federation message claims
 *   publicKey — sender's hex-encoded SPKI DER public key
 *
 * Flow:
 *   1. Parse & validate body
 *   2. Resolve receiving tenant
 *   3. Verify JWT signature + expiry + audience
 *   4. Look up sender in federation peers → verify trust ≥ vouched
 *   5. Deduplicate by JWT jti
 *   6. Route to LEO
 *   7. Store message in Messages collection
 *   8. Return LEO's response
 *
 * @see src/utilities/federatedAIBus.ts — JWT creation/verification
 * @see src/utilities/leoProcessMessage.ts — LEO routing
 */

import type { PayloadHandler } from 'payload'
import {
  importPublicKey,
  verifyFederatedMessageJWT,
  statusToTrustLevel,
  meetsMinimumTrust,
} from '@/utilities/federatedAIBus'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the receiving tenant from headers */
async function resolveTenant(
  payload: any,
  headers: Headers,
): Promise<{ tenantId: string | number; domain: string } | null> {
  const host = headers.get('host') || headers.get('x-forwarded-host') || ''
  const tenantSlug = headers.get('x-tenant-id')

  // Try slug first
  if (tenantSlug) {
    const result = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (result.docs?.[0]) {
      return { tenantId: result.docs[0].id, domain: host }
    }
  }

  // Try domain match
  if (host) {
    const domain = host.split(':')[0] // strip port
    const result = await payload.find({
      collection: 'tenants',
      where: { domain: { equals: domain } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (result.docs?.[0]) {
      return { tenantId: result.docs[0].id, domain }
    }
  }

  // No fallback — federation messages MUST resolve to a specific tenant
  // via slug header or domain match. Falling back to 'default' would
  // route foreign messages to the wrong tenant.
  return null
}

/** Look up a federation peer by their federation ID */
async function lookupFederationPeer(
  payload: any,
  federationId: string,
): Promise<{ name: string; status: string; publicKey?: string } | null> {
  try {
    const result = await payload.find({
      collection: 'endeavors',
      where: {
        'federation.federationId': { equals: federationId },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const endeavor = result.docs?.[0] as any
    if (!endeavor) return null
    return {
      name: endeavor.name || 'Unknown Peer',
      status: endeavor.federation?.ministryStatus || endeavor.status || 'unknown',
      publicKey: endeavor.federation?.publicKey,
    }
  } catch {
    return null
  }
}

/** Check if a federation message has already been processed */
async function isMessageDuplicate(
  payload: any,
  tenantId: string | number,
  messageId: string,
): Promise<boolean> {
  try {
    const result = await payload.find({
      collection: 'messages',
      where: {
        'metadata.federationMessageId': { equals: messageId },
        tenant: { equals: tenantId },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return result.docs.length > 0
  } catch {
    return false // fail open — better to process than to silently drop
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export const federationMessageHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // 1. Parse body
  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const jwtToken = body.jwt as string
  const senderPublicKeyHex = body.publicKey as string

  if (!jwtToken || typeof jwtToken !== 'string') {
    return Response.json({ error: 'Missing or invalid jwt field' }, { status: 400 })
  }
  if (!senderPublicKeyHex || typeof senderPublicKeyHex !== 'string') {
    return Response.json({ error: 'Missing or invalid publicKey field' }, { status: 400 })
  }

  // 2. Resolve receiving tenant
  const tenant = await resolveTenant(payload, req.headers)
  if (!tenant) {
    return Response.json({ error: 'Could not resolve receiving tenant' }, { status: 404 })
  }

  // 3. Verify JWT
  let verified
  try {
    const publicKey = importPublicKey(senderPublicKeyHex)
    verified = await verifyFederatedMessageJWT(jwtToken, publicKey, tenant.domain)
  } catch (err) {
    return Response.json(
      {
        error: 'JWT verification failed',
        details: err instanceof Error ? err.message : 'Unknown',
      },
      { status: 401 },
    )
  }

  // 4. Look up sender's federation identity and trust level
  const peer = await lookupFederationPeer(payload, verified.federationId)
  if (!peer) {
    return Response.json(
      { error: 'Unknown federation peer', federationId: verified.federationId },
      { status: 403 },
    )
  }

  const trustLevel = statusToTrustLevel(peer.status)
  if (!meetsMinimumTrust(trustLevel)) {
    return Response.json(
      {
        error: 'Insufficient trust level',
        required: 'vouched',
        actual: trustLevel,
        peerStatus: peer.status,
      },
      { status: 403 },
    )
  }

  // 5. Deduplication
  const isDuplicate = await isMessageDuplicate(payload, tenant.tenantId, verified.jti)
  if (isDuplicate) {
    return Response.json({ duplicate: true, message: 'Message already processed' })
  }

  // 6. Route to LEO
  let leoResult
  try {
    leoResult = await leoProcessMessage({
      message: verified.message,
      conversationId: verified.conversationId,
      tenantId: tenant.tenantId,
      payload,
      userContext: {
        id: 0,
        name: verified.senderName || peer.name,
        email: `federation@${verified.senderDomain || 'peer'}`,
        roles: ['federation_peer'],
      },
      federatedContext: {
        peerName: peer.name,
        trustLevel,
        federationId: verified.federationId,
        peerDomain: verified.senderDomain,
      },
    })
  } catch (err) {
    console.error('[federation-message] LEO routing error:', err)
    return Response.json(
      { error: 'Message processing failed', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 },
    )
  }

  // 7. Store message (fire-and-forget)
  try {
    await payload.create({
      collection: 'messages',
      data: {
        content: verified.message,
        messageType: 'federation_message',
        tenant: tenant.tenantId,
        metadata: {
          federationMessageId: verified.jti,
          senderFederationId: verified.federationId,
          senderName: verified.senderName || peer.name,
          senderDomain: verified.senderDomain,
          conversationId: verified.conversationId,
        },
      } as any,
      overrideAccess: true,
    })
  } catch (err) {
    // Non-fatal — message was already processed by LEO
    console.warn('[federation-message] Failed to store message:', err)
  }

  // 8. Return LEO's response
  return Response.json({
    success: true,
    response: leoResult.text,
    conversationId: leoResult.conversationId,
    peerName: peer.name,
  })
}
