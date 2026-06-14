'use client'

import type { FieldErrorsImpl, FieldValues, UseFormRegister, UseFormSetValue } from 'react-hook-form'
import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Width } from '../Width'
import { FormItem } from '@/components/forms/FormItem'
import { FormError } from '@/components/forms/FormError'
import { SignaturePad, type SignatureValue } from '@/components/signatures/SignaturePad'

/**
 * Signature — a Form Builder field that captures a binding e-signature.
 *
 * Renders optional agreement terms + a <SignaturePad> (typed/drawn). The captured
 * signature is stored in the submission as a JSON value; a form-submission
 * afterChange hook (createFormSignatures) turns it into an immutable, tamper-evident
 * row in the Signatures collection with proper tenant context.
 *
 * @see src/hooks/createFormSignatures.ts
 */
type SignatureFieldProps = {
  name: string
  label?: string
  width?: number
  required?: boolean
  agreementText?: string
  errors: Partial<FieldErrorsImpl<{ [x: string]: unknown }>>
  register: UseFormRegister<FieldValues>
  setValue: UseFormSetValue<FieldValues>
}

export const Signature: React.FC<SignatureFieldProps> = ({
  name,
  label,
  width,
  required,
  agreementText,
  errors,
  register,
  setValue,
}) => {
  const [signerName, setSignerName] = useState('')
  const [sig, setSig] = useState<SignatureValue>({ type: 'typed', data: '' })

  // Register a hidden field so react-hook-form validates "must sign".
  useEffect(() => {
    register(name, {
      required: required ? `${label || 'Signature'} is required.` : undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mirror the captured signature into the form value as a compact JSON payload.
  useEffect(() => {
    const provided = sig.type === 'typed' ? sig.data.trim().length > 0 : sig.data.length > 0
    const effectiveName = signerName.trim() || (sig.type === 'typed' ? sig.data.trim() : '')
    const value =
      provided && effectiveName
        ? JSON.stringify({
            __signature: true,
            type: sig.type,
            data: sig.data,
            signerName: effectiveName,
            agreement: agreementText || '',
          })
        : ''
    setValue(name, value, { shouldValidate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, signerName])

  return (
    <Width width={width}>
      <FormItem>
        {label && <Label htmlFor={name}>{label}</Label>}

        {agreementText && (
          <div className="mb-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border border-input bg-muted/30 p-3 text-sm leading-relaxed">
            {agreementText}
          </div>
        )}

        <div className="mb-2">
          <Label htmlFor={`${name}-signer`} className="text-sm font-normal">
            Full legal name
          </Label>
          <input
            id={`${name}-signer`}
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Your full legal name"
            autoComplete="name"
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <SignaturePad value={sig} onChange={setSig} defaultName={signerName} />

        {errors?.[name]?.message && typeof errors?.[name]?.message === 'string' && (
          <FormError message={errors?.[name]?.message as string} />
        )}
      </FormItem>
    </Width>
  )
}
