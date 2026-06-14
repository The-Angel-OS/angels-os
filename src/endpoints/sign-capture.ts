/**
 * Sign Capture — POST /api/sign-ops/capture
 *
 * The one chokepoint that writes a human e-signature. The Signatures collection is
 * create:false, so every signature flows through here, where the document checksum
 * and the tamper-evidence contentHash are computed SERVER-side (the collection's
 * beforeChange hook recomputes contentHash too — defense in depth). A client can
 * never supply or forge the seal.
 *
 * Open to authenticated AND anonymous signers (a renter signing a rental agreement
 * may not have an account). The signer relationship is set from req.user when
 * present. IP + user-agent are captured from the request for the audit record.
 *
 * Body: {
 *   tenantId? | tenantSlug?,        // else resolved from x-tenant-id header
 *   signerName: string,             // typed legal name / name on the drawn mark
 *   documentRef: string,            // 'booking:42', 'agreement:tos-v3', ...
 *   documentType?: string,          // agreement|waiver|booking|tos|constitution|form|other
 *   documentTitle?: string,
 *   documentBody?: string,          // exact terms → server computes the checksum
 *   documentChecksum?: string,      // OR pass a precomputed checksum directly
 *   signatureType: 'typed'|'drawn',
 *   signatureData: string,          // typed string, or PNG data-URL for drawn
 *   metadata?: object,
 * }
 *
 * NOT a collection slug prefix (route-shadowing rule): uses /sign-ops/*.
 */
import type { PayloadHandler } from 'payload'
import { checksumDocument } from '@/utilities/signatureHash'

const VALID_TYPES = ['typed', 'drawn'] as const
const VALID_DOC_TYPES = ['agreement', 'waiver', 'booking', 'tos', 'constitution', 'form', 'other']

export const signCaptureHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* empty body → validation below */
  }

  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

  const signerName = str(body.signerName)
  const documentRef = str(body.documentRef)
  const documentTitle = str(body.documentTitle)
  const signatureType = str(body.signatureType) as (typeof VALID_TYPES)[number]
  const signatureData = typeof body.signatureData === 'string' ? body.signatureData : ''
  const documentType = VALID_DOC_TYPES.includes(str(body.documentType))
    ? str(body.documentType)
    : 'agreement'

  if (!signerName) return Response.json({ error: 'signerName is required' }, { status: 400 })
  if (!documentRef) return Response.json({ error: 'documentRef is required' }, { status: 400 })
  if (!VALID_TYPES.includes(signatureType)) {
    return Response.json({ error: `signatureType must be one of ${VALID_TYPES.join(', ')}` }, { status: 400 })
  }
  if (!signatureData) return Response.json({ error: 'signatureData is required' }, { status: 400 })

  // Document checksum: prefer hashing the exact body server-side; else accept a
  // precomputed checksum (e.g. a versioned agreement whose body lives elsewhere).
  const documentBody = typeof body.documentBody === 'string' ? body.documentBody : null
  const documentChecksum = documentBody
    ? checksumDocument(documentBody)
    : str(body.documentChecksum)
  if (!documentChecksum) {
    return Response.json(
      { error: 'documentBody or documentChecksum is required (to pin the signature to specific terms)' },
      { status: 400 },
    )
  }

  try {
    // Resolve the tenant: explicit id / slug, else the request's x-tenant-id header.
    let tenantId: number | string | undefined
    if (body.tenantId != null) {
      tenantId = body.tenantId as number | string
    } else if (str(body.tenantSlug)) {
      const t = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: str(body.tenantSlug) } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      tenantId = (t.docs?.[0] as { id: number | string } | undefined)?.id
    } else {
      const headerTenant = req.headers?.get('x-tenant-id')
      if (headerTenant) tenantId = headerTenant
    }
    if (tenantId == null) {
      return Response.json({ error: 'tenant could not be resolved (pass tenantId/tenantSlug or x-tenant-id)' }, { status: 400 })
    }

    const signedAt = new Date().toISOString()
    const ipAddress =
      req.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers?.get('x-real-ip') ||
      undefined
    const userAgent = req.headers?.get('user-agent') || undefined

    const created = await payload.create({
      collection: 'signatures',
      data: {
        tenant: tenantId,
        signerName,
        signer: (user as { id?: number | string } | null)?.id ?? null,
        documentType,
        documentRef,
        documentTitle: documentTitle || undefined,
        documentChecksum,
        signatureType,
        signatureData,
        signedAt,
        ipAddress,
        userAgent,
        metadata: (body.metadata as Record<string, unknown>) ?? undefined,
        // contentHash is computed by the collection's beforeChange hook.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
    })

    return Response.json({
      ok: true,
      signature: {
        id: created.id,
        contentHash: (created as { contentHash?: string }).contentHash,
        documentRef,
        documentChecksum,
        signedAt,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[sign-capture] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
