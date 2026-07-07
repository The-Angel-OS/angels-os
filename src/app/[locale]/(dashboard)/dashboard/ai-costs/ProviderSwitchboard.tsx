'use client'

/**
 * ProviderSwitchboard — the "green dots" board. Live reachability of every AI
 * provider + Vercel Blob, from /api/provision-ops/ai-status. Distinct from the
 * "Providers in play" panel (which shows what was USED): this shows what's UP,
 * whether or not it's the one currently chosen. The selected provider (first
 * configured in the binding order) is flagged.
 */

import React from 'react'
import { RefreshCw, Radio } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { cn } from '@/utilities/cn'

interface ProviderProbe {
  kind: string
  label: string
  configured: boolean
  reachable: boolean | null
  latencyMs: number | null
  selected: boolean
  note?: string
}
interface OpsStatus {
  probedAt: string
  order: string[]
  providers: ProviderProbe[]
  blob: { configured: boolean; reachable: boolean | null; latencyMs: number | null; note?: string }
}

type Dot = 'green' | 'amber' | 'red' | 'gray'

function dotFor(configured: boolean, reachable: boolean | null): Dot {
  if (!configured) return 'gray'
  if (reachable === true) return 'green'
  if (reachable === false) return 'red'
  return 'amber' // configured but unprobed (e.g. gateway)
}

const DOT_CLASS: Record<Dot, string> = {
  green: 'bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/60',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  gray: 'bg-muted-foreground/30',
}
const DOT_LABEL: Record<Dot, string> = { green: 'Up', amber: 'Configured', red: 'Down', gray: 'Not set' }

function StatusRow({
  label,
  configured,
  reachable,
  latencyMs,
  selected,
  note,
}: {
  label: string
  configured: boolean
  reachable: boolean | null
  latencyMs: number | null
  selected?: boolean
  note?: string
}) {
  const dot = dotFor(configured, reachable)
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2',
        selected ? 'border-primary/40 bg-primary/5' : 'border-border',
      )}
      title={note}
    >
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT_CLASS[dot])} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{label}</span>
          {selected && (
            <span className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Radio className="h-2.5 w-2.5" /> In use
            </span>
          )}
        </div>
        {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-medium">{DOT_LABEL[dot]}</div>
        {latencyMs != null && <div className="text-[10px] text-muted-foreground">{latencyMs}ms</div>}
      </div>
    </div>
  )
}

export default function ProviderSwitchboard() {
  const [data, setData] = React.useState<OpsStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const probe = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/provision-ops/ai-status', { credentials: 'same-origin' })
      if (!res.ok) throw new Error(`Probe failed (${res.status})`)
      setData((await res.json()) as OpsStatus)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Probe failed')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void probe()
  }, [probe])

  const upCount = data?.providers.filter((p) => p.reachable === true).length ?? 0
  const configuredCount = data?.providers.filter((p) => p.configured).length ?? 0

  return (
    <Panel
      id="provider-switchboard"
      title="Provider Switchboard"
      icon={<Radio className="h-4 w-4 text-emerald-500" />}
      loading={loading && !data}
      error={error}
      onRetry={probe}
      headerRight={
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-xs text-muted-foreground">
              {upCount} up · {configuredCount} configured
            </span>
          )}
          <button
            type="button"
            onClick={probe}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> Probe
          </button>
        </div>
      }
    >
      {data && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {data.providers.map((p) => (
              <StatusRow
                key={p.kind}
                label={p.label}
                configured={p.configured}
                reachable={p.reachable}
                latencyMs={p.latencyMs}
                selected={p.selected}
                note={p.note}
              />
            ))}
          </div>

          {/* Blob storage — the other always-on dependency. */}
          <div>
            <div className="mb-1 mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Storage</div>
            <StatusRow
              label="Vercel Blob"
              configured={data.blob.configured}
              reachable={data.blob.reachable}
              latencyMs={data.blob.latencyMs}
              note={data.blob.note}
            />
          </div>

          <p className="text-[10px] text-muted-foreground">
            Binding order: {data.order.join(' → ')} · probed {new Date(data.probedAt).toLocaleTimeString()}
          </p>
        </div>
      )}
    </Panel>
  )
}
