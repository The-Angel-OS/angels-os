'use client'

import React, { useRef, useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

type TicketType = 'warranty' | 'return' | 'support' | 'question'

export type TicketFormProps = {
  type?: TicketType | null
  heading?: string | null
  intro?: string | null
  showOrderFields?: boolean | null
  confirmation?: string | null
}

const DEFAULT_HEADING: Record<TicketType, string> = {
  warranty: 'Make a warranty claim',
  return: 'Request a return',
  support: 'Get support',
  question: 'Ask a question',
}

const DEFAULT_SUBMIT: Record<TicketType, string> = {
  warranty: 'Submit claim',
  return: 'Request return',
  support: 'Send request',
  question: 'Send question',
}

type Attachment = { mediaId: number | string; name: string; url: string }

/**
 * Upload-only file control.
 *
 * The dashboard's media control offers "Choose existing" beside "Upload". That
 * affordance must NOT exist here: a customer filing a claim is signed in but is
 * NOT a member of the seller's tenant, and a picker would invite them to browse
 * the tenant's media library. So this control has one button, and the only
 * images it can ever show are the ones this person just uploaded.
 *
 * ponytail: no drag-and-drop, no reordering, no client-side image compression.
 * Add them when someone actually complains — the job here is "photograph the
 * fault and send it", and a file input does that on every phone.
 */
function UploadOnly({
  attachments,
  onChange,
  disabled,
}: {
  attachments: Attachment[]
  onChange: (next: Attachment[]) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: FileList) {
    setUploading(true)
    setError(null)
    const added: Attachment[] = []
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        // Media.alt is required, and Payload reads non-file fields from _payload.
        const alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Attachment'
        fd.append('_payload', JSON.stringify({ alt }))
        const res = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.errors?.[0]?.message || 'Upload failed')
        const doc = data.doc || data
        if (!doc?.id) throw new Error('Upload returned no media')
        added.push({ mediaId: doc.id, name: file.name, url: doc.url || '' })
      }
      onChange([...attachments, ...added])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Photos or video of the issue</label>
      <p className="mb-2 text-xs text-muted-foreground">
        A clear photo of the fault settles most claims without a phone call.
      </p>

      {attachments.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <li
              key={`${a.mediaId}-${i}`}
              className="relative h-20 w-20 overflow-hidden rounded-md border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(attachments.filter((_, j) => j !== i))}
                className="absolute right-0 top-0 bg-background/90 px-1 text-xs leading-4"
                aria-label={`Remove ${a.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Uploading…' : attachments.length ? 'Add another' : 'Add a photo'}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}

export const TicketFormBlockComponent: React.FC<TicketFormProps> = ({
  type,
  heading,
  intro,
  showOrderFields,
  confirmation,
}) => {
  const ticketType: TicketType = (type as TicketType) || 'warranty'
  const showOrder = showOrderFields !== false && ticketType !== 'question'

  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [sellerName, setSellerName] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setNeedsAuth(false)
    try {
      const res = await fetch('/api/tickets-ops/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: ticketType,
          subject,
          description,
          ...(showOrder ? { orderNumber, purchaseDate, sellerName } : {}),
          attachments: attachments.map((a) => a.mediaId),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setNeedsAuth(true)
        return
      }
      if (!res.ok) throw new Error(data?.message || 'Could not submit — please try again.')
      setDone(data?.reference ? String(data.reference) : '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done !== null) {
    return (
      <section className="container my-16">
        <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="mb-3 text-2xl font-bold">Received</h2>
          <p className="text-muted-foreground">
            {confirmation ||
              'Thanks — this is with the team. You’ll get a reply on this claim, and you can check it any time from your account.'}
          </p>
          {done && (
            <p className="mt-4 text-sm">
              Reference <span className="font-mono font-medium">#{done}</span>
            </p>
          )}
        </div>
      </section>
    )
  }

  const field = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary'
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'

  return (
    <section className="container my-16">
      <div className="mx-auto max-w-xl">
        <h2 className="mb-2 text-2xl font-bold">{heading || DEFAULT_HEADING[ticketType]}</h2>
        {intro && <p className="mb-6 text-muted-foreground">{intro}</p>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Subject</label>
            <input
              className={field}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={140}
              placeholder={ticketType === 'warranty' ? 'Belt stopped heating on one side' : 'Short summary'}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">What happened</label>
            <textarea
              className={`${field} min-h-32`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={5000}
              placeholder="In your own words — when it started, what you were doing, what it does now."
            />
          </div>

          {showOrder && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Order number</label>
                <input className={field} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Purchase date</label>
                <input type="date" className={field} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Where you bought it</label>
                <input
                  className={field}
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="Direct, Amazon, a clinic, a distributor…"
                />
              </div>
            </div>
          )}

          <UploadOnly attachments={attachments} onChange={setAttachments} disabled={submitting} />

          {needsAuth && (
            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
              <p className="mb-3">
                Please sign in so this claim is attached to you — that’s how you track it and how we
                reply.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/login?redirect=${encodeURIComponent(path)}`}>Sign in</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/create-account?redirect=${encodeURIComponent(path)}`}>
                    Create an account
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? 'Sending…' : DEFAULT_SUBMIT[ticketType]}
          </Button>
        </form>
      </div>
    </section>
  )
}
