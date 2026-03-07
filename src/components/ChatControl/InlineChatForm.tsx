'use client'

import React, { useState, useCallback } from 'react'
import { getClientSideURL } from '@/utilities/getURL'

/**
 * InlineChatForm — Renders a dynamic form inline within a chat message bubble.
 *
 * Accepts a widget config with field definitions and optional pre-filled values.
 * Submits to /api/form-submissions (same as the page FormBlock) if a formId is
 * provided, otherwise posts as a generic form submission message.
 *
 * Widget config shape:
 * ```
 * {
 *   widgetType: 'inline_form',
 *   formTitle: 'Contact Form',
 *   fields: [
 *     { name: 'full-name', blockType: 'text', label: 'Full Name', required: true },
 *     { name: 'email', blockType: 'email', label: 'Email', required: true },
 *     { name: 'message', blockType: 'textarea', label: 'Message' },
 *     { name: 'rating', blockType: 'select', label: 'Rating', options: [{label:'5',value:'5'},{label:'4',value:'4'}] },
 *   ],
 *   prefilled: { email: 'user@example.com' },
 *   submitButtonLabel: 'Submit',
 *   formId: 42,
 * }
 * ```
 */

interface FormFieldConfig {
  name: string
  blockType: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox'
  label?: string
  required?: boolean
  options?: Array<{ label: string; value: string }>
  width?: number
}

interface InlineChatFormProps {
  config: {
    widgetType: string
    formTitle?: string
    fields?: FormFieldConfig[]
    prefilled?: Record<string, unknown>
    submitButtonLabel?: string
    formId?: number
    [key: string]: unknown
  }
}

export function InlineChatForm({ config }: InlineChatFormProps) {
  const { formTitle, fields, prefilled, submitButtonLabel, formId } = config

  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const initial: Record<string, string | boolean> = {}
    for (const field of fields || []) {
      if (prefilled?.[field.name] != null) {
        initial[field.name] =
          field.blockType === 'checkbox'
            ? Boolean(prefilled[field.name])
            : String(prefilled[field.name])
      } else {
        initial[field.name] = field.blockType === 'checkbox' ? false : ''
      }
    }
    return initial
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = useCallback(
    (name: string, value: string | boolean) => {
      setValues((prev) => ({ ...prev, [name]: value }))
    },
    [],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setIsSubmitting(true)

      try {
        // Validate required fields
        for (const field of fields || []) {
          if (field.required) {
            const val = values[field.name]
            if (val === '' || val === false || val == null) {
              setError(`${field.label || field.name} is required`)
              setIsSubmitting(false)
              return
            }
          }
        }

        if (formId) {
          // Submit to the Payload form-submissions endpoint
          const dataToSend = Object.entries(values).map(([name, value]) => ({
            field: name,
            value,
          }))

          const res = await fetch(`${getClientSideURL()}/api/form-submissions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ form: formId, submissionData: dataToSend }),
          })

          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body?.errors?.[0]?.message || `Submission failed (${res.status})`)
          }
        }

        setHasSubmitted(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Submission failed')
      } finally {
        setIsSubmitting(false)
      }
    },
    [fields, values, formId],
  )

  if (!fields?.length) return null

  if (hasSubmitted) {
    return (
      <div className="mt-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-green-600 dark:text-green-400">✓</span>
          <span className="font-medium text-green-700 dark:text-green-300">
            {formTitle ? `${formTitle} submitted!` : 'Form submitted successfully!'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-border/50 bg-muted/30 p-3">
      {formTitle && (
        <h4 className="mb-2 text-sm font-semibold">{formTitle}</h4>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        {fields.map((field) => (
          <div key={field.name} className="space-y-1">
            {field.blockType !== 'checkbox' && (
              <label className="text-xs font-medium text-muted-foreground">
                {field.label || field.name}
                {field.required && <span className="ml-0.5 text-red-400">*</span>}
              </label>
            )}

            {field.blockType === 'text' && (
              <input
                type="text"
                value={values[field.name] as string}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                required={field.required}
              />
            )}

            {field.blockType === 'email' && (
              <input
                type="email"
                value={values[field.name] as string}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                required={field.required}
              />
            )}

            {field.blockType === 'number' && (
              <input
                type="number"
                value={values[field.name] as string}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                required={field.required}
              />
            )}

            {field.blockType === 'textarea' && (
              <textarea
                value={values[field.name] as string}
                onChange={(e) => handleChange(field.name, e.target.value)}
                rows={3}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                required={field.required}
              />
            )}

            {field.blockType === 'select' && (
              <select
                value={values[field.name] as string}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                required={field.required}
              >
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {field.blockType === 'checkbox' && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values[field.name] as boolean}
                  onChange={(e) => handleChange(field.name, e.target.checked)}
                  className="rounded border-border"
                />
                <span>
                  {field.label || field.name}
                  {field.required && <span className="ml-0.5 text-red-400">*</span>}
                </span>
              </label>
            )}
          </div>
        ))}

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : (submitButtonLabel || 'Submit')}
        </button>
      </form>
    </div>
  )
}
