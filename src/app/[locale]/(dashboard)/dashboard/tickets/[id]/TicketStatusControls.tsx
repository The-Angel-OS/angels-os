'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const STATUSES = ['submitted', 'reviewing', 'approved', 'denied', 'resolved'] as const
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const

/**
 * Move a ticket along. Two selects and nothing else — the whole reason this is
 * a record rather than a form is that somebody has to be able to change its
 * state, and that should take one click, not a trip to the admin panel.
 */
export function TicketStatusControls({
  ticketId,
  status,
  priority,
}: {
  ticketId: string
  status: string
  priority: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [local, setLocal] = useState({ status, priority })

  const save = (patch: Partial<{ status: string; priority: string }>) => {
    const next = { ...local, ...patch }
    setLocal(next)
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        router.refresh()
      } catch (err) {
        // Say what actually failed and put the control back where it was —
        // a silently reverted dropdown is how people lose trust in a queue.
        setLocal({ status, priority })
        setError(err instanceof Error ? err.message : 'Could not save that.')
      }
    })
  }

  const select =
    'rounded-md border border-border bg-background px-2.5 py-1.5 text-sm capitalize outline-none focus:border-primary disabled:opacity-50'

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status</span>
        <select
          className={select}
          value={local.status}
          disabled={pending}
          onChange={(e) => save({ status: e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Priority</span>
        <select
          className={select}
          value={local.priority}
          disabled={pending}
          onChange={(e) => save({ priority: e.target.value })}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      {pending && <span className="text-xs text-muted-foreground">Saving…</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
