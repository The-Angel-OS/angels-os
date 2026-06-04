'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignCrew, updateCrewAssignment, removeCrewAssignment } from './actions'

interface CrewRow {
  id: string
  membershipId: string
  name: string
  department: string
  rank: string
  station: string
  dutyStatus: string
  watchSection: string
}
interface Assignable {
  membershipId: string
  name: string
  role: string
}

const DEPARTMENTS: { value: string; label: string }[] = [
  { value: 'bridge', label: 'Bridge (Command)' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'operations', label: 'Operations' },
  { value: 'science', label: 'Science' },
  { value: 'communications', label: 'Communications' },
  { value: 'medical', label: 'Medical' },
  { value: 'security', label: 'Security' },
  { value: 'logistics', label: 'Logistics' },
]
const RANKS: { value: string; label: string }[] = [
  { value: 'captain', label: 'Captain' },
  { value: 'commander', label: 'Commander' },
  { value: 'lt_commander', label: 'Lt. Commander' },
  { value: 'lieutenant', label: 'Lieutenant' },
  { value: 'ensign', label: 'Ensign' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'cadet', label: 'Cadet' },
]
const DUTY: { value: string; label: string }[] = [
  { value: 'active_duty', label: 'Active Duty' },
  { value: 'shore_leave', label: 'Shore Leave' },
  { value: 'detached', label: 'Detached Service' },
  { value: 'reserve', label: 'Reserve' },
]
const WATCH: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
  { value: 'gamma', label: 'Gamma' },
  { value: 'delta', label: 'Delta' },
]
const labelOf = (list: { value: string; label: string }[], v: string) =>
  list.find((o) => o.value === v)?.label || v || '—'

const DUTY_STYLE: Record<string, string> = {
  active_duty: 'bg-green-500/10 text-green-500 border-green-500/20',
  shore_leave: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  detached: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  reserve: 'bg-muted text-muted-foreground border-border',
}

export function CrewManager({
  crew,
  assignable,
  endeavorName,
  hasEndeavor,
}: {
  crew: CrewRow[]
  assignable: Assignable[]
  endeavorName: string
  hasEndeavor: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showAssign, setShowAssign] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const notify = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }
  const run = (fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) => {
    startTransition(async () => {
      const res = await fn()
      if (res.success) {
        notify(okMsg, 'success')
        setShowAssign(false)
        setEditingId(null)
        router.refresh()
      } else {
        notify(res.error || 'Something went wrong', 'error')
      }
    })
  }

  const byDept = DEPARTMENTS.map((d) => ({
    ...d,
    members: crew.filter((c) => c.department === d.value),
  })).filter((d) => d.members.length > 0)

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg border px-4 py-2 text-sm shadow-lg ${
            toast.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-600'
              : 'border-red-500/30 bg-red-500/10 text-red-600'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Crew Relations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Muster roll for <span className="font-medium text-foreground">{endeavorName}</span> —{' '}
            {crew.length} crew assigned across {byDept.length} department{byDept.length !== 1 ? 's' : ''}.
          </p>
        </div>
        {hasEndeavor && assignable.length > 0 && (
          <button
            onClick={() => setShowAssign((v) => !v)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {showAssign ? 'Cancel' : 'Assign Crew'}
          </button>
        )}
      </div>

      {!hasEndeavor && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          This tenant has no Endeavor yet — crew are assigned to an Endeavor (the ship). Set one up
          first under Endeavor Setup.
        </div>
      )}

      {showAssign && <AssignForm assignable={assignable} pending={pending} onSubmit={run} />}

      {hasEndeavor && crew.length === 0 && !showAssign && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No crew assigned yet. Use <span className="font-medium">Assign Crew</span> to muster your first hand.
        </div>
      )}

      {byDept.map((dept) => (
        <section key={dept.value}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {dept.label}
          </h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <tbody className="divide-y divide-border">
                {dept.members.map((c) =>
                  editingId === c.id ? (
                    <EditRow key={c.id} row={c} pending={pending} onSave={run} onCancel={() => setEditingId(null)} />
                  ) : (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{labelOf(RANKS, c.rank)}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">{c.station || <span className="text-muted-foreground">—</span>}</td>
                      <td className="hidden px-4 py-3 text-sm sm:table-cell">
                        {c.watchSection ? `${labelOf(WATCH, c.watchSection)} Watch` : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${DUTY_STYLE[c.dutyStatus] || DUTY_STYLE.reserve}`}>
                          {labelOf(DUTY, c.dutyStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setEditingId(c.id)} className="text-xs font-medium text-primary hover:underline">
                          Edit
                        </button>
                        <button
                          onClick={() => run(() => removeCrewAssignment(c.id), `${c.name} stood down`)}
                          disabled={pending}
                          className="ml-3 text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function AssignForm({
  assignable,
  pending,
  onSubmit,
}: {
  assignable: Assignable[]
  pending: boolean
  onSubmit: (fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) => void
}) {
  const [membershipId, setMembershipId] = useState(assignable[0]?.membershipId || '')
  const [department, setDepartment] = useState('operations')
  const [rank, setRank] = useState('specialist')
  const [station, setStation] = useState('')
  const [dutyStatus, setDutyStatus] = useState('active_duty')
  const [watchSection, setWatchSection] = useState('')

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Assign Crew</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Member
          <Select value={membershipId} onChange={setMembershipId} options={assignable.map((a) => ({ value: a.membershipId, label: a.name }))} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Department
          <Select value={department} onChange={setDepartment} options={DEPARTMENTS} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Rank
          <Select value={rank} onChange={setRank} options={RANKS} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Station
          <input
            value={station}
            onChange={(e) => setStation(e.target.value)}
            placeholder="e.g. Helm, Tactical, Sick Bay"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Watch
          <Select value={watchSection} onChange={setWatchSection} options={WATCH} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Duty Status
          <Select value={dutyStatus} onChange={setDutyStatus} options={DUTY} />
        </label>
      </div>
      <div className="mt-4">
        <button
          disabled={pending || !membershipId}
          onClick={() => onSubmit(() => assignCrew({ membershipId, department, rank, station, dutyStatus, watchSection }), 'Crew assigned')}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? 'Assigning…' : 'Assign to station'}
        </button>
      </div>
    </div>
  )
}

function EditRow({
  row,
  pending,
  onSave,
  onCancel,
}: {
  row: CrewRow
  pending: boolean
  onSave: (fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) => void
  onCancel: () => void
}) {
  const [department, setDepartment] = useState(row.department)
  const [rank, setRank] = useState(row.rank)
  const [station, setStation] = useState(row.station)
  const [dutyStatus, setDutyStatus] = useState(row.dutyStatus)
  const [watchSection, setWatchSection] = useState(row.watchSection)

  return (
    <tr className="bg-muted/20">
      <td colSpan={5} className="px-4 py-3">
        <p className="mb-2 text-sm font-medium">{row.name}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={department} onChange={setDepartment} options={DEPARTMENTS} />
          <Select value={rank} onChange={setRank} options={RANKS} />
          <input
            value={station}
            onChange={(e) => setStation(e.target.value)}
            placeholder="Station"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <Select value={watchSection} onChange={setWatchSection} options={WATCH} />
          <Select value={dutyStatus} onChange={setDutyStatus} options={DUTY} />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            disabled={pending}
            onClick={() => onSave(() => updateCrewAssignment(row.id, { department, rank, station, dutyStatus, watchSection }), 'Assignment updated')}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Save
          </button>
          <button onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}
