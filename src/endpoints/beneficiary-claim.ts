/**
 * Beneficiary Claim Endpoint — POST /api/beneficiary/claim
 *
 * Allows a newly-onboarded user to verify themselves as a designated
 * beneficiary of an Endeavor by presenting their unique claim token.
 *
 * Flow:
 * 1. Endeavor operator designates a beneficiary (name, email, description)
 * 2. System generates a claimToken (UUID) — operator shares it with beneficiary
 * 3. Beneficiary creates an Angel OS account (standard signup)
 * 4. Beneficiary calls this endpoint with their claimToken
 * 5. System verifies the token, links the user, marks as verified
 *
 * Auth: authenticated users only.
 *
 * @see src/collections/Endeavors/index.ts — beneficiaries array
 */
import type { PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { logError } from '@/utilities/logError'

export const beneficiaryClaimHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rateLimited = applyRateLimit(req, 'default')
  if (rateLimited) return rateLimited

  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { claimToken } = body

  if (!claimToken || typeof claimToken !== 'string') {
    return Response.json({ error: 'claimToken is required.' }, { status: 400 })
  }

  let resolvedTenantId: number | undefined
  try {
    // Search all Endeavors for a beneficiary with this claim token
    const endeavors = await payload.find({
      collection: 'endeavors',
      where: {
        'beneficiaries.claimToken': { equals: claimToken },
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })

    if (endeavors.docs.length === 0) {
      return Response.json(
        { error: 'Invalid or expired claim token. Please check and try again.' },
        { status: 404 },
      )
    }

    const endeavor = endeavors.docs[0] as any
    {
      const tid = typeof endeavor.tenant === 'object' && endeavor.tenant ? endeavor.tenant.id : endeavor.tenant
      if (tid != null && Number.isFinite(Number(tid))) resolvedTenantId = Number(tid)
    }
    const beneficiaries = (endeavor.beneficiaries || []).slice()

    // Find the matching beneficiary entry
    const bi = beneficiaries.findIndex(
      (b: any) => b.claimToken === claimToken,
    )

    if (bi < 0) {
      return Response.json({ error: 'Claim token not found.' }, { status: 404 })
    }

    const beneficiary = beneficiaries[bi]

    // Check if already claimed
    if (beneficiary.verificationStatus === 'verified') {
      return Response.json(
        { error: 'This claim token has already been verified.' },
        { status: 409 },
      )
    }

    if (beneficiary.verificationStatus === 'declined') {
      return Response.json(
        { error: 'This beneficiary designation has been declined.' },
        { status: 409 },
      )
    }

    // Link the user and mark as verified
    beneficiaries[bi] = {
      ...beneficiary,
      verificationStatus: 'verified',
      linkedUser: user.id,
      verifiedAt: new Date().toISOString(),
    }

    await payload.update({
      collection: 'endeavors',
      id: endeavor.id,
      data: { beneficiaries } as any,
      overrideAccess: true,
    })

    return Response.json({
      success: true,
      message: `Welcome, ${beneficiary.name}! You've been verified as a beneficiary of "${endeavor.name}".`,
      endeavorName: endeavor.name,
      beneficiaryName: beneficiary.name,
      role: beneficiary.role || 'Beneficiary',
    })
  } catch (err) {
    console.error('[Beneficiary Claim] Error:', err)
    await logError({
      source: 'beneficiary-claim',
      message: `Failed to process beneficiary claim: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 500,
      tenantId: resolvedTenantId,
      userId: user.id,
    })
    return Response.json({ error: 'Failed to process claim.' }, { status: 500 })
  }
}
