import type { CollectionAfterChangeHook } from 'payload'
import { checksumDocument } from '@/utilities/signatureHash'

/**
 * createFormSignatures — turn Form Builder "signature" field values into immutable,
 * tamper-evident rows in the Signatures collection.
 *
 * The frontend Signature field stores its capture as a JSON value
 * ({ __signature, type, data, signerName, agreement }) in the submission. This hook
 * (afterChange on form-submissions) detects those values and, with proper tenant
 * context, creates a Signatures record per signature — documentRef
 * `form-submission:<id>`, documentChecksum from the agreement terms (or the form
 * title). The Signatures collection's own beforeChange hook computes contentHash.
 *
 * Non-blocking: all errors are caught — never fails the submission.
 *
 * @see src/blocks/Form/Signature/index.tsx  @see src/collections/Signatures
 */
export const createFormSignatures: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc

  try {
    const payload = req.payload
    const submissionData = doc.submissionData as Array<{ field: string; value: unknown }> | undefined
    if (!submissionData?.length) return doc

    // Parse out the signature fields (value is JSON with __signature: true).
    const signatures = submissionData
      .map((f) => {
        if (typeof f.value !== 'string' || !f.value.includes('__signature')) return null
        try {
          const parsed = JSON.parse(f.value) as {
            __signature?: boolean
            type?: 'typed' | 'drawn'
            data?: string
            signerName?: string
            agreement?: string
          }
          if (!parsed.__signature || !parsed.data || !parsed.signerName) return null
          return { field: f.field, ...parsed }
        } catch {
          return null
        }
      })
      .filter(Boolean) as Array<{
        field: string
        type?: 'typed' | 'drawn'
        data?: string
        signerName?: string
        agreement?: string
      }>

    if (!signatures.length) return doc

    // Resolve the form (title) + tenant context.
    const formRef = doc.form
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formId = typeof formRef === 'object' ? (formRef as any)?.id : formRef

    let formTitle = 'Form'
    let tenantId: number | string | undefined
    if (formId) {
      try {
        const form = await payload.findByID({ collection: 'forms', id: formId, depth: 0, overrideAccess: true })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formTitle = (form as any)?.title || 'Form'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = (form as any)?.tenant
        if (t != null) tenantId = typeof t === 'object' ? t.id : t
      } catch {
        /* continue */
      }
    }

    // Fallbacks for tenant (form not tenant-scoped in the plugin): served tenant,
    // active membership, then x-tenant-id header.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = req.user as any
    if (tenantId == null && user?.servesTenant) {
      tenantId = typeof user.servesTenant === 'object' ? user.servesTenant?.id : user.servesTenant
    }
    if (tenantId == null) {
      const headerTenant = req.headers?.get?.('x-tenant-id')
      if (headerTenant) {
        try {
          const tenants = await payload.find({
            collection: 'tenants', where: { slug: { equals: String(headerTenant) } },
            limit: 1, depth: 0, overrideAccess: true,
          })
          tenantId = tenants.docs[0]?.id as number | undefined
        } catch {
          /* continue */
        }
      }
    }
    if (tenantId == null) {
      payload.logger?.warn?.(`[createFormSignatures] no tenant for submission ${doc.id} — skipping`)
      return doc
    }

    const signedAt = (doc.createdAt as string) || new Date().toISOString()

    for (const s of signatures) {
      try {
        const agreement = s.agreement || ''
        await payload.create({
          collection: 'signatures',
          data: {
            tenant: tenantId,
            signerName: s.signerName,
            signer: (user as { id?: number | string } | null)?.id ?? null,
            documentType: 'form',
            documentRef: `form-submission:${doc.id}`,
            documentTitle: `${formTitle} — ${s.field}`,
            documentChecksum: checksumDocument(agreement || `${formTitle}:${s.field}`),
            signatureType: s.type === 'drawn' ? 'drawn' : 'typed',
            signatureData: s.data,
            signedAt,
            metadata: { formId, submissionId: doc.id, field: s.field },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          overrideAccess: true,
        })
      } catch (e) {
        payload.logger?.error?.(`[createFormSignatures] failed for field ${s.field}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  } catch (err) {
    req.payload.logger?.error?.({ err, msg: `[createFormSignatures] failed for submission ${doc.id}` })
  }

  return doc
}
