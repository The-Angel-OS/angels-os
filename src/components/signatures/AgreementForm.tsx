'use client'

/**
 * <AgreementForm> — the generic human-consent surface. Renders the terms being
 * agreed to, requires an explicit acknowledgment, captures a signature via
 * <SignaturePad>, and POSTs to /api/sign-ops/capture (which computes the document
 * checksum + tamper-evidence hash server-side and writes the immutable record).
 *
 * Mount it anywhere consent is needed: a rental agreement, a waiver, ToS
 * acceptance, the human constitution acceptance, a booking confirmation. Pass the
 * exact `terms` so the server checksums what the signer actually saw.
 */
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SignaturePad, type SignatureValue } from './SignaturePad'

export interface AgreementFormProps {
  /** Stable reference to the thing being signed, e.g. 'booking:42', 'agreement:tos-v3'. */
  documentRef: string
  /** agreement | waiver | booking | tos | constitution | form | other. */
  documentType?: string
  /** Human label, shown as the heading and stored on the record. */
  documentTitle?: string
  /** The exact terms text. Sent as documentBody so the server computes the checksum. */
  terms: string
  /** Tenant context (else the request's x-tenant-id header is used). */
  tenantId?: number | string
  tenantSlug?: string
  /** Prefill the signer's name (e.g. the logged-in user). */
  defaultName?: string
  /** Label of the acknowledgment checkbox. */
  acknowledgeLabel?: string
  submitLabel?: string
  /** Called with the capture result on success. */
  onSigned?: (result: { id: string | number; contentHash?: string; signedAt: string }) => void
  className?: string
}

export const AgreementForm: React.FC<AgreementFormProps> = ({
  documentRef,
  documentType = 'agreement',
  documentTitle,
  terms,
  tenantId,
  tenantSlug,
  defaultName = '',
  acknowledgeLabel = 'I have read and agree to the terms above.',
  submitLabel = 'Sign & Agree',
  onSigned,
  className,
}) => {
  const [signerName, setSignerName] = useState(defaultName)
  const [signature, setSignature] = useState<SignatureValue>({ type: 'typed', data: defaultName })
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const signatureProvided =
    signature.type === 'typed' ? signature.data.trim().length > 0 : signature.data.length > 0
  // For a typed signature the name IS the signature; keep them in sync if blank.
  const effectiveName = signerName.trim() || (signature.type === 'typed' ? signature.data.trim() : '')
  const canSubmit = acknowledged && signatureProvided && effectiveName.length > 0 && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/sign-ops/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          tenantSlug,
          signerName: effectiveName,
          documentRef,
          documentType,
          documentTitle,
          documentBody: terms,
          signatureType: signature.type,
          signatureData: signature.data,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        signature?: { id: string | number; contentHash?: string; signedAt: string }
      }
      if (!res.ok || !json.ok || !json.signature) {
        throw new Error(json.error || `Request failed (${res.status})`)
      }
      setDone(true)
      onSigned?.(json.signature)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record signature')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className={className}>
        <div className="rounded-md border border-green-600/30 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-medium">Signed — thank you, {effectiveName}.</p>
          <p className="mt-1">Your agreement has been recorded.</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {documentTitle && <h3 className="mb-2 text-lg font-semibold">{documentTitle}</h3>}

      <div className="mb-4 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-input bg-muted/30 p-4 text-sm leading-relaxed">
        {terms}
      </div>

      <div className="mb-4 flex items-start gap-2">
        <input
          id={`ack-${documentRef}`}
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <Label htmlFor={`ack-${documentRef}`} className="text-sm font-normal leading-snug">
          {acknowledgeLabel}
        </Label>
      </div>

      <div className="mb-4 space-y-2">
        <Label htmlFor={`name-${documentRef}`}>Full legal name</Label>
        <Input
          id={`name-${documentRef}`}
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Your full legal name"
          autoComplete="name"
        />
      </div>

      <div className="mb-4">
        <Label className="mb-2 block">Signature</Label>
        <SignaturePad value={signature} onChange={setSignature} defaultName={defaultName} />
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <Button type="submit" disabled={!canSubmit} size="lg">
        {submitting ? 'Recording…' : submitLabel}
      </Button>
    </form>
  )
}

export default AgreementForm
