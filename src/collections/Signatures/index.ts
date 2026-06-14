/**
 * Signatures — human e-signature consent records (rental agreements, waivers,
 * bookings, ToS acceptance, the constitution-for-humans).
 *
 * Each row is an immutable, independently tamper-evident record: a beforeChange
 * hook computes `contentHash` (SHA-256 binding signer + document checksum +
 * captured mark + timestamp) on the server, so the integrity seal can never be
 * supplied or forged by the client. Distinct from the Ed25519 federation
 * constitution signing (tenant.setup.*) — this is the human consent primitive.
 *
 * Written programmatically (create/update closed) via /api/sign-ops/capture, the
 * <SignaturePad> component, and <AgreementForm>. NOT in the multiTenantPlugin
 * list — it carries its own `tenant` field (matches Wallets/TokenLedger).
 *
 * @see src/utilities/signatureHash.ts
 */
import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { hashSignature, type SignatureContent } from '@/utilities/signatureHash'

const computeContentHash: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  // Stamp signedAt once, at creation.
  if (operation === 'create' && !data.signedAt) {
    // ISO string supplied by the caller/endpoint when available; otherwise the
    // DB createdAt covers ordering. We require signedAt at the field level, so
    // this is a safety net only.
    data.signedAt = data.signedAt || originalDoc?.signedAt
  }

  const content: SignatureContent = {
    signerName: data.signerName ?? originalDoc?.signerName,
    signerUserId: (data.signer ?? originalDoc?.signer) ?? null,
    documentRef: data.documentRef ?? originalDoc?.documentRef,
    documentChecksum: data.documentChecksum ?? originalDoc?.documentChecksum,
    signatureType: data.signatureType ?? originalDoc?.signatureType,
    signatureData: data.signatureData ?? originalDoc?.signatureData,
    signedAt: data.signedAt ?? originalDoc?.signedAt,
  }

  // Only (re)compute when we have the full content (all required fields present).
  if (
    content.signerName &&
    content.documentRef &&
    content.documentChecksum &&
    content.signatureType &&
    content.signatureData &&
    content.signedAt
  ) {
    data.contentHash = hashSignature(content)
  }

  return data
}

export const Signatures: CollectionConfig = {
  slug: 'signatures',
  admin: {
    group: 'Trust',
    useAsTitle: 'signerName',
    defaultColumns: ['signerName', 'documentType', 'documentRef', 'signedAt', 'tenant'],
    description: 'Immutable, tamper-evident human e-signature consent records.',
  },
  access: {
    // Programmatic-write-only: captured through /api/sign-ops/capture (overrideAccess),
    // which computes the hash server-side. The collection itself is immutable.
    read: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      if (roles.includes('super_admin') || roles.includes('admin')) return true
      // A member sees signatures they made.
      return { signer: { equals: (user as { id?: number | string }).id } }
    },
    create: () => false,
    update: () => false,
    delete: ({ req: { user } }) =>
      Boolean(user && ((user as { roles?: string[] }).roles ?? []).includes('super_admin')),
  },
  hooks: {
    beforeChange: [computeContentHash],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    {
      name: 'signerName',
      type: 'text',
      required: true,
      admin: { description: 'Typed legal name, or the name accompanying a drawn mark.' },
    },
    {
      name: 'signer',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: { description: 'Authenticated signer, when known. Blank for anonymous signing.' },
    },
    {
      name: 'documentType',
      type: 'select',
      index: true,
      defaultValue: 'agreement',
      options: [
        { label: 'Rental / Service Agreement', value: 'agreement' },
        { label: 'Waiver / Release', value: 'waiver' },
        { label: 'Booking', value: 'booking' },
        { label: 'Terms of Service', value: 'tos' },
        { label: 'Constitution (human acceptance)', value: 'constitution' },
        { label: 'Form Consent', value: 'form' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'documentRef',
      type: 'text',
      required: true,
      index: true,
      admin: { description: "Stable reference to the signed thing, e.g. 'booking:42', 'agreement:tos-v3'." },
    },
    {
      name: 'documentTitle',
      type: 'text',
      admin: { description: 'Human label of what was signed (shown in the record + receipts).' },
    },
    {
      name: 'documentChecksum',
      type: 'text',
      required: true,
      admin: { description: 'SHA-256 of the exact document terms agreed to — pins the signature to specific content.' },
    },
    {
      name: 'signatureType',
      type: 'select',
      required: true,
      defaultValue: 'typed',
      options: [
        { label: 'Typed name', value: 'typed' },
        { label: 'Drawn mark', value: 'drawn' },
      ],
    },
    {
      name: 'signatureData',
      type: 'textarea',
      required: true,
      admin: { description: 'Typed string (typed) or PNG data-URL of the drawn mark (drawn).' },
    },
    {
      name: 'contentHash',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        description: 'SHA-256 tamper-evidence seal — computed server-side; do not edit.',
      },
    },
    {
      name: 'signedAt',
      type: 'date',
      required: true,
      admin: { description: 'Moment of signing (ISO).' },
    },
    { name: 'ipAddress', type: 'text', admin: { readOnly: true } },
    { name: 'userAgent', type: 'text', admin: { readOnly: true } },
    {
      name: 'metadata',
      type: 'json',
      admin: { description: 'Optional extra context (e.g. agreement version, witnessed-by).' },
    },
  ],
  timestamps: true,
}
