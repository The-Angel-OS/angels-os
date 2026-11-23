'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
} from '@/utilities/ticketHelpers'

export interface AssigneeOption {
  id: string
  label: string
}

/**
 * ServiceNow-Lite Incident Workbench Controls:
 * Status, Priority, Assignee (with 1-click Assign to me), Customer-Visible
 * Resolution, and Staff-Only Internal Work Notes — persisted via
 * POST /api/tickets-ops/update.
 */
export function TicketStatusControls({
  ticketId,
  status,
  priority,
  assigneeId,
  currentUserId,
  assignees = [],
  initialResolution = '',
  initialInternalNotes = '',
}: {
  ticketId: string
  status: string
  priority: string
  assigneeId?: string | null
  currentUserId?: string | null
  assignees?: AssigneeOption[]
  initialResolution?: string
  initialInternalNotes?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const [localStatus, setLocalStatus] = useState(status)
  const [localPriority, setLocalPriority] = useState(priority)
  const [localAssignee, setLocalAssignee] = useState(assigneeId || '')
  const [resolution, setResolution] = useState(initialResolution)
  const [internalNotes, setInternalNotes] = useState(initialInternalNotes)

  const patchTicket = (
    patch: Partial<{
      status: string
      priority: string
      assignee: string | null
      resolution: string
      internalNotes: string
    }>,
    label = 'Saved',
  ) => {
    setError(null)
    setSavedMsg(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/tickets-ops/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ticketId, ...patch }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || `HTTP ${res.status}`)
        }
        setSavedMsg(label)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save update.')
      }
    })
  }

  const select =
    'rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary disabled:opacity-50'

  return (
    <div className="space-y-5">
      {/* Triage Control Strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            State
          </span>
          <select
            className={select}
            value={localStatus}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value
              setLocalStatus(next)
              patchTicket({ status: next }, 'State updated')
            }}
          >
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TICKET_STATUS_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Priority
          </span>
          <select
            className={select}
            value={localPriority}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value
              setLocalPriority(next)
              patchTicket({ priority: next }, 'Priority updated')
            }}
          >
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TICKET_PRIORITY_LABELS[p] ?? p}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Assignee
          </span>
          <select
            className={select}
            value={localAssignee}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value
              setLocalAssignee(next)
              patchTicket({ assignee: next || null }, 'Assignee updated')
            }}
          >
            <option value="">Unassigned</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        {currentUserId && localAssignee !== currentUserId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              setLocalAssignee(currentUserId)
              patchTicket({ assignee: currentUserId }, 'Assigned to you')
            }}
          >
            Assign to me
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs">
          {pending && <span className="text-muted-foreground">Saving…</span>}
          {!pending && savedMsg && <span className="font-medium text-emerald-500">{savedMsg}</span>}
          {error && <span className="text-red-500">{error}</span>}
        </div>
      </div>

      {/* Customer-Visible Resolution vs Staff-Only Internal Work Notes */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Customer-Visible Resolution</h2>
            <span className="text-[11px] text-muted-foreground">Shown to requester</span>
          </div>
          <textarea
            className="min-h-28 w-full rounded-md border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Describe what fixed the issue, next steps, or refund/replacement details..."
            disabled={pending}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => patchTicket({ resolution }, 'Resolution saved')}
            >
              Save Resolution
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => {
                setLocalStatus('resolved')
                patchTicket({ resolution, status: 'resolved' }, 'Marked resolved')
              }}
            >
              Save &amp; Mark Resolved
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Internal Work Notes</h2>
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Staff-only · hidden from requester
            </span>
          </div>
          <textarea
            className="min-h-28 w-full rounded-md border border-amber-500/30 bg-background p-2.5 text-sm outline-none focus:border-primary"
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Investigation logs, debug findings, internal handoff notes..."
            disabled={pending}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => patchTicket({ internalNotes }, 'Work notes saved')}
            >
              Save Work Notes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
