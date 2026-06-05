'use client'

/**
 * FederationPulse — a community widget. Right on the dashboard, you see you're
 * part of a living network: the Dioceses in the federation, who's active. Reuses
 * the (anonymous-safe) governance-sync endpoint; framework-managed (collapse/hide).
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Radio, Loader2, ArrowRight } from 'lucide-react'
import { DashboardWidget } from '@/components/dashboard/widgets'

interface Ministry {
  id: string
  name: string
  domain?: string
  status?: string
  lastHeartbeat?: string
}

const dot = (status?: string) => {
  if (status === 'active') return 'bg-emerald-500'
  if (status === 'probation') return 'bg-amber-500'
  if (status === 'suspended' || status === 'revoked') return 'bg-red-500'
  return 'bg-muted-foreground/40'
}

export function FederationPulse() {
  const [ministries, setMinistries] = useState<Ministry[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/federation/governance-sync', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setMinistries((d?.governance?.ministries as Ministry[]) ?? [])
      })
      .catch(() => {
        if (!cancelled) setMinistries([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const count = ministries?.length ?? 0
  const activeCount = useMemo(() => (ministries ?? []).filter((m) => m.status === 'active').length, [ministries])

  return (
    <DashboardWidget id="federation-pulse" title="The Network" icon={<Radio className="h-4 w-4 text-primary" />}>
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading the mesh…
        </div>
      ) : count === 0 ? (
        <p className="py-1 text-sm text-muted-foreground">
          Standing by — no federation peers yet. Connect to the mesh to see who else is out there.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You&apos;re part of a federation of{' '}
            <span className="font-semibold text-foreground">
              {count} {count === 1 ? 'Diocese' : 'Dioceses'}
            </span>{' '}
            · {activeCount} active.
          </p>
          <ul className="space-y-1.5">
            {(ministries ?? []).slice(0, 8).map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot(m.status)}`} />
                <span className="truncate font-medium">{m.name}</span>
                {m.domain && <span className="truncate text-xs text-muted-foreground">· {m.domain}</span>}
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/federation-network"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open the Federation Command Center <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </DashboardWidget>
  )
}
