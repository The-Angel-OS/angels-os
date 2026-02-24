/**
 * Federation Ping Endpoint — POST /api/federation/ping
 *
 * Receives a ping from a Diocese announcing its presence to the Angel OS
 * federation network. In production this endpoint would be hosted by the
 * central Archdiocese registry and validate signatures before recording
 * the ping. In development / self-hosted mode it acts as a local registry.
 *
 * Request body:
 *   { dioceseName, domain, endeavorType, publicKey, federationId?, signature }
 *
 * Response:
 *   { success, ministryStatus, federationId, registryUrl, message }
 *
 * Called by:
 *   - Leo wizard tool `ping_federation` (step 7)
 *   - Future: scheduled cron to keep registry heartbeat alive
 */

import type { PayloadHandler } from 'payload'
import { verifySignature } from '@/federation/protocol'

export const federationPingHandler: PayloadHandler = async (req) => {
  // Parse body
  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    dioceseName,
    domain,
    endeavorType,
    publicKey,
    federationId,
    signature,
  } = body

  if (!dioceseName || typeof dioceseName !== 'string') {
    return Response.json(
      { success: false, error: 'dioceseName is required' },
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
      const payload = JSON.stringify({ dioceseName, domain, endeavorType, publicKey })
      signatureValid = verifySignature(payload, signature, publicKey)
    } catch {
      // Non-fatal — log and continue
      console.warn('[Federation Ping] Signature verification failed for:', dioceseName)
    }
  }

  // Record the ping in the Endeavors collection if a matching endeavor is found
  try {
    const existingEndeavors = await req.payload.find({
      collection: 'endeavors',
      where: {
        and: [
          { name: { equals: dioceseName } },
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

  return Response.json({
    success: true,
    ministryStatus: 'applicant',
    federationId: resolvedFederationId,
    registryUrl,
    signatureValid,
    message: signatureValid
      ? `Welcome to the network, ${dioceseName}! Your constitution signature is verified. 90-day probation begins now.`
      : `${dioceseName} registered in the federation network. Signature verification skipped (development mode).`,
  })
}
