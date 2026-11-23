'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/Auth'
import {
  formatIncidentId,
  TICKET_PRIORITY_BADGE,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_BADGE,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  type RequesterTicketView,
} from '@/utilities/ticketHelpers'

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
  support: 'Submit a support ticket',
  question: 'Ask a question',
}

const DEFAULT_SUBMIT: Record<TicketType, string> = {
  warranty: 'Submit claim',
  return: 'Request return',
  support: 'Submit incident ticket',
  question: 'Send question',
}

type Attachment = { mediaId: number | string; name: string; url: string }

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
      <label className="mb-1 block text-sm font-medium">Screenshots, photos, or video (optional)</label>
      <p className="mb-2 text-xs text-muted-foreground">
        Attach a screenshot or photo to help our team resolve your request faster.
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
        {uploading ? 'Uploading…' : attachments.length ? 'Add another file' : 'Attach photo / screenshot'}
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
  const { user } = useAuth()
  const initialType: TicketType = (type as TicketType) || 'support'

  const [selectedType, setSelectedType] = useState<TicketType>(initialType)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [sellerName, setSellerName] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [doneRef, setDoneRef] = useState<{ id: string; incidentNumber: string } | null>(null)

  const [myTickets, setMyTickets] = useState<RequesterTicketView[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  const fetchMyTickets = useCallback(async () => {
    if (!user?.id) {
      setMyTickets([])
      return
    }
    setLoadingTickets(true)
    try {
      const res = await fetch('/api/tickets-ops/mine', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      if (Array.isArray(data?.tickets)) {
        setMyTickets(data.tickets)
      }
    } catch {
      /* fail soft */
    } finally {
      setLoadingTickets(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchMyTickets()
  }, [fetchMyTickets])

  const showOrder =
    selectedType === 'warranty' ||
    selectedType === 'return' ||
    (showOrderFields === true && selectedType === initialType && initialType !== 'question')

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
          type: selectedType,
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
      const refId = data?.reference ? String(data.reference) : ''
      const inc = data?.incidentNumber || (refId ? formatIncidentId(refId) : '')
      setDoneRef({ id: refId, incidentNumber: inc })
      setSubject('')
      setDescription('')
      setAttachments([])
      void fetchMyTickets()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const field =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary'
  const path = typeof window !== 'undefined' ? window.location.pathname : '/dashboard/support'

  return (
    <section className="mx-auto max-w-4xl px-4 py-6 space-y-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        {doneRef ? (
          <div className="py-6 text-center">
            {doneRef.incidentNumber && (
              <span className="inline-block rounded-md bg-primary/10 px-3 py-1 font-mono text-sm font-bold text-primary">
                {doneRef.incidentNumber}
              </span>
            )}
            <h2 className="mt-3 mb-2 text-2xl font-bold">Ticket Logged</h2>
            <p className="text-sm text-muted-foreground">
              {confirmation ||
                'Thanks — your ticket is in the queue. Track its live status and resolution below anytime.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button type="button" variant="outline" onClick={() => setDoneRef(null)}>
                Submit Another Ticket
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mb-2 text-2xl font-bold">{heading || DEFAULT_HEADING[selectedType]}</h2>
            {intro && <p className="mb-6 text-sm text-muted-foreground">{intro}</p>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium">Category</label>
                <select
                  className={field}
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as TicketType)}
                  disabled={submitting}
                >
                  <option value="support">Support / Technical Incident</option>
                  <option value="question">General Question</option>
                  <option value="warranty">Warranty Claim</option>
                  <option value="return">Return Request</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Subject</label>
                <input
                  className={field}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  maxLength={140}
                  placeholder={
                    selectedType === 'warranty'
                      ? 'Belt stopped heating on one side'
                      : 'Short summary of what you need help with'
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Details</label>
                <textarea
                  className={`${field} min-h-32`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  maxLength={5000}
                  placeholder="Describe what happened, the portal/page URL affected, or your question in your own words."
                />
              </div>

              {showOrder && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Order number</label>
                    <input
                      className={field}
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Purchase date</label>
                    <input
                      type="date"
                      className={field}
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                    />
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
                    Please sign in so this ticket is attached to your account — that’s how you track
                    live status and receive replies.
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
                {submitting ? 'Sending…' : DEFAULT_SUBMIT[selectedType]}
              </Button>
            </form>
          </>
        )}
      </div>

      {/* Requester's Own Ticket Tracker */}
      <div id="my-tickets" className="mx-auto max-w-3xl scroll-mt-20">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">My Submitted Tickets</h3>
            <p className="text-xs text-muted-foreground">
              Live status and team resolutions for support requests raised from your account.
            </p>
          </div>
          {user && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchMyTickets()}
              disabled={loadingTickets}
            >
              {loadingTickets ? 'Refreshing…' : 'Refresh'}
            </Button>
          )}
        </div>

        {!user ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            <Link href={`/login?redirect=${encodeURIComponent('/dashboard/support#my-tickets')}`} className="font-semibold text-primary underline">
              Sign in
            </Link>{' '}
            to view your open and resolved support tickets.
          </div>
        ) : loadingTickets && myTickets.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            Loading your tickets…
          </div>
        ) : myTickets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            You haven&apos;t submitted any support tickets yet.
          </div>
        ) : (
          <div className="space-y-3">
            {myTickets.map((t) => (
              <div key={String(t.id)} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                      {t.incidentNumber}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${TICKET_STATUS_BADGE[t.status] ?? 'bg-muted border-border'}`}
                    >
                      {TICKET_STATUS_LABELS[t.status] ?? t.status}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${TICKET_PRIORITY_BADGE[t.priority] ?? TICKET_PRIORITY_BADGE.normal}`}
                    >
                      {TICKET_PRIORITY_LABELS[t.priority] ?? t.priority}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {TICKET_TYPE_LABELS[t.type] ?? t.type}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>

                <h4 className="mt-2 font-semibold text-foreground">{t.subject}</h4>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground line-clamp-3">
                  {t.description}
                </p>

                {t.resolution && (
                  <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Team Resolution
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{t.resolution}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
