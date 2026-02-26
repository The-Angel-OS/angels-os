/**
 * Federation Vouch Endpoint — POST /api/federation/vouch
 *
 * An active Enterprise vouches for a probationary one.
 * After 2 valid vouches + 90 days probation, the target auto-promotes to active.
 *
 * Request body (signed with federation headers):
 *   { voucherFederationId, voucherDomain, voucherName, targetFederationId, reason, vouchedAt }
 *
 * Constitutional Reference:
 *   Article VII — Federation trust chain
 *   Probation: 90 days + 2 vouches from active members = full membership
 */

import type { PayloadHandler } from 'payload'
import { verifyFederationRequest, createPeerLookup, type TrustRequirement } from '@/federation/trustGuard'
import { logFromVerification } from '@/federation/auditLog'
import { validateVouch, canPromoteToActive } from '@/utilities/federationEngine'
import type { Ministry, Vouch } from '@/utilities/federationEngine'

export const federationVouchHandler: PayloadHandler = async (req) => {
  const startTime = Date.now()

  // Parse body
  let rawBody: string
  let body: Record<string, unknown>
  try {
    rawBody = await (req as Request).text()
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return Response.json({ accepted: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    voucherFederationId,
    voucherDomain,
    voucherName,
    targetFederationId,
    reason,
  } = body

  if (!voucherFederationId || !targetFederationId || !reason) {
    return Response.json(
      { accepted: false, error: 'Missing required fields: voucherFederationId, targetFederationId, reason' },
      { status: 400 },
    )
  }

  // Verify federation request (trust guard) — vouching requires active trust
  const requirement: TrustRequirement = {
    minimumTrust: 'full', // Only active members can vouch
    action: 'vouch',
  }

  const verification = await verifyFederationRequest(
    req.headers as unknown as Headers,
    rawBody,
    requirement,
    createPeerLookup(req.payload),
  )

  // Audit log
  logFromVerification(req.payload, verification, 'vouch', {
    targetAction: `vouch for ${targetFederationId}`,
    responseTimeMs: Date.now() - startTime,
    metadata: { voucherFederationId, targetFederationId, reason },
  }).catch(() => {})

  if (!verification.verified) {
    const status = verification.reason.includes('Rate limit') ? 429 : 403
    return Response.json(
      { accepted: false, error: verification.reason },
      { status },
    )
  }

  try {
    // Find the target endeavor (the one being vouched for)
    const targetEndeavors = await req.payload.find({
      collection: 'endeavors',
      where: {
        'federation.federationId': { equals: targetFederationId },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (targetEndeavors.docs.length === 0) {
      return Response.json(
        { accepted: false, error: `Target Enterprise ${targetFederationId} not found` },
        { status: 404 },
      )
    }

    const targetDoc = targetEndeavors.docs[0] as unknown as Record<string, unknown>
    const targetFederation = targetDoc.federation as Record<string, unknown>

    // Build Ministry objects for validation
    const targetMinistry: Ministry = {
      id: targetFederationId as string,
      name: (targetDoc.name as string) || 'Unknown',
      domain: '',
      operator: '',
      status: (targetFederation?.ministryStatus as string) || 'applicant',
      appliedAt: (targetFederation?.constitutionSignedAt as string) || new Date().toISOString(),
      probationStartedAt: (targetFederation?.constitutionSignedAt as string) || undefined,
      vouchesReceived: ((targetDoc as any).vouchesReceived as Vouch[]) || [],
      constitutionVersion: (targetFederation?.constitutionVersion as string) || '1.1',
      capabilities: [],
    } as Ministry

    const voucherMinistry: Ministry = {
      id: voucherFederationId as string,
      name: (voucherName as string) || 'Unknown',
      domain: (voucherDomain as string) || '',
      operator: '',
      status: 'active', // Already verified by trust guard
      appliedAt: '',
      vouchesReceived: [],
      constitutionVersion: '1.1',
      capabilities: [],
    } as Ministry

    // Validate the vouch using federation engine
    const validation = validateVouch(
      voucherFederationId as string,
      targetMinistry,
      voucherMinistry,
    )

    if (!validation.valid) {
      return Response.json(
        { accepted: false, error: validation.reason },
        { status: 400 },
      )
    }

    // Record the vouch
    const newVouch: Vouch = {
      voucherId: voucherFederationId as string,
      voucherName: (voucherName as string) || 'Unknown Enterprise',
      vouchedAt: new Date().toISOString(),
      reason: reason as string,
      isValid: true,
    }

    const existingVouches = targetMinistry.vouchesReceived || []
    const updatedVouches = [...existingVouches, newVouch]

    // Update the target endeavor with the new vouch
    await req.payload.update({
      collection: 'endeavors',
      id: targetDoc.id as number,
      data: {
        vouchesReceived: updatedVouches,
      } as any,
      overrideAccess: true,
    })

    // Check if the target can now be promoted to active
    const updatedMinistry: Ministry = {
      ...targetMinistry,
      vouchesReceived: updatedVouches,
    }

    const promotion = canPromoteToActive(updatedMinistry)

    if (promotion.canPromote) {
      // Auto-promote to active!
      await req.payload.update({
        collection: 'endeavors',
        id: targetDoc.id as number,
        data: {
          federation: {
            ministryStatus: 'active',
          },
        } as any,
        overrideAccess: true,
      })

      return Response.json({
        accepted: true,
        promoted: true,
        message: `Vouch accepted. ${targetDoc.name} has been promoted to ACTIVE membership! They now have full federation trust.`,
        vouchCount: updatedVouches.length,
      })
    }

    return Response.json({
      accepted: true,
      promoted: false,
      message: `Vouch accepted from ${voucherName}. ${promotion.reason || 'Awaiting more vouches or probation period.'}`,
      vouchCount: updatedVouches.length,
    })
  } catch (err) {
    console.error('[Federation Vouch] Error:', err)
    return Response.json(
      { accepted: false, error: 'Internal error processing vouch' },
      { status: 500 },
    )
  }
}
