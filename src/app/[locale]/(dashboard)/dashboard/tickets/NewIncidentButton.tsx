'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITIES,
  TICKET_TYPE_LABELS,
  TICKET_TYPES,
} from '@/utilities/ticketHelpers'

export function NewIncidentButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<string>('support')
  const [priority, setPriority] = useState<string>('normal')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/tickets-ops/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, priority, subject, description }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(data?.message || `Failed to log incident (HTTP ${res.status}).`)
        return
      }
      setSubject('')
      setDescription('')
      setType('support')
      setPriority('normal')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Incident
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log New Support Incident</DialogTitle>
          <DialogDescription>
            Create a tracked INC ticket in the portal support queue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
              <select
                className={inputClass}
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={submitting}
              >
                {TICKET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TICKET_TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
              <select
                className={inputClass}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={submitting}
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {TICKET_PRIORITY_LABELS[p] ?? p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Subject</label>
            <input
              className={inputClass}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={140}
              placeholder="Short summary of the incident"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              className={`${inputClass} min-h-28`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={5000}
              placeholder="Steps to reproduce, affected portal/order, or customer details..."
              disabled={submitting}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Logging...
                </>
              ) : (
                'Create Incident'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
