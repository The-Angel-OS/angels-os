/**
 * Federation Ping Endpoint — POST /api/federation/ping
 *
 * Receives a ping from an Enterprise announcing its presence to the Angel OS
 * federation network. Any sentinel (active + full trust) can receive pings —
 * the mesh has no single point of entry (Edenist model).
 *
 * In the distributed mesh, new Enterprises can ping ANY healthy sentinel.
 * The sentinel records the ping locally and the next governance sync
 * propagates the new member to all other sentinels.
 *
 * Request body:
 *   { enterpriseName, domain, endeavorType, publicKey, federationId?, signature }
 *
 * Response:
 *   { success, ministryStatus, federationId, registryUrl, meshPeers?, message }
 *
 * Called by:
 *   - Leo wizard tool `ping_federation` (step 7)
 *   - Future: scheduled cron to keep registry heartbeat alive
 */

import type { PayloadHandler } from 'payload'
import { verifySignature } from '@/federation/protocol'
import { getCachedGovernance } from './federation-governance-sync'

export const federationPingHandler: PayloadHandler = async (req) => {
  // Parse body
  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    enterpriseName,
    domain,
    endeavorType,
    publicKey,
    federationId,
    signature,
  } = body

  if (!enterpriseName || typeof enterpriseName !== 'string') {
    return Response.json(
      { success: false, error: 'enterpriseName is required' },
      { status: 400 },
    )
  }

  // Verify the Ed25519 signature if provided (non-fatal — development pings may lack it)
  let signatureValid = false
  if (
    signature &&
    publicKey &&
    typeof signature === 'string' &&
    typeof publicKey === 'string'
  ) {
    try {
      const payload = JSON.stringify({ enterpriseName, domain, endeavorType, publicKey })
      signatureValid = verifySignature(payload, signature, publicKey)
    } catch {
      // Non-fatal — log and continue
      console.warn('[Federation Ping] Signature verification failed for:', enterpriseName)
    }
  }

  // Record the ping in the Endeavors collection if a matching endeavor is found
  try {
    const existingEndeavors = await req.payload.find({
      collection: 'endeavors',
      where: {
        and: [
          { name: { equals: enterpriseName } },
          ...(federationId ? [{ 'federation.federationId': { equals: federationId } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existingEndeavors.docs.length > 0) {
      const endeavor = existingEndeavors.docs[0]
      await req.payload.update({
        collection: 'endeavors',
        id: endeavor.id,
        data: {
          federation: {
            lastPingAt: new Date().toISOString(),
            networkVisible: true,
            ministryStatus: 'applicant',
          },
        } as any,
        overrideAccess: true,
      })
    }
  } catch (recordErr) {
    // Non-fatal — don't fail the ping over a record error
    console.warn('[Federation Ping] Failed to record ping:', recordErr)
  }

  // Issue the response
  const resolvedFederationId =
    typeof federationId === 'string' ? federationId : `fed_${Date.now().toString(36)}`

  const registryUrl =
    process.env.FEDERATION_REGISTRY_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'http://localhost:3000'

  // ── Mesh peer discovery ─────────────────────────────────────
  // Provide new members with a list of known healthy sentinels so they
  // can sync governance data from any node (Edenist resilience).
  let meshPeers: Array<{ domain: string; name: string }> = []
  try {
    const governance = getCachedGovernance()
    if (governance?.ministries) {
      meshPeers = governance.ministries
        .filter((m) => m.status === 'active' && m.domain)
        .map((m) => ({ domain: m.domain, name: m.name }))
        .slice(0, 10) // Cap at 10 peers for initial discovery
    }
  } catch {
    // Non-fatal — new member can discover peers later via heartbeat
  }

  return Response.json({
    success: true,
    ministryStatus: 'applicant',
    federationId: resolvedFederationId,
    registryUrl,
    signatureValid,
    meshPeers,
    message: signatureValid
      ? `Welcome to the network, ${enterpriseName}! Your constitution signature is verified. 90-day probation begins now.`
      : `${enterpriseName} registered in the federation network. Signature verification skipped (development mode).`,
  })
}
