'use client'

/**
 * FederationStar — the permanent five-pointed star, miniaturized for the dashboard
 * overview. The cosmology made glanceable: the pentagram is always drawn (the
 * ideal), with the live/simulated mesh overlaid. Click through to the full
 * Federation Command Center. Reads the pure, public /simulate topology so it's
 * always populated. [[project_rpe_cosmology]]
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Radio, ArrowRight } from 'lucide-react'
import { DashboardWidget } from '@/components/dashboard/widgets'

interface SimNode {
  id: string
  name: string
  status: string
  metadata?: { tier?: string; role?: string }
}

const TIER_COLOR: Record<string, string> = {
  substrate: '#f5a623',
  diocese: '#cc99cc',
  endeavor: '#99ccff',
  holon: '#22cc88',
}

// The permanent {5/2} pentagram — distinct points, one unbroken line, no center
// that rules. Drawn faint behind the live mesh regardless of node count.
const STAR = Array.from({ length: 5 }, (_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
  return { x: 50 + 42 * Math.cos(a), y: 50 + 42 * Math.sin(a) }
})
const PENTAGRAM = [0, 2, 4, 1, 3].map((i) => `${STAR[i].x.toFixed(1)},${STAR[i].y.toFixed(1)}`).join(' ')

export function FederationStar() {
  const [nodes, setNodes] = useState<SimNode[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/federation/simulate?dispatch=0', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setNodes((d?.nodes as SimNode[]) ?? [])
      })
      .catch(() => {
        if (!cancelled) setNodes([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Substrate at center; everyone else evenly on a ring (thumbnail layout).
  const placed = useMemo(() => {
    const list = nodes ?? []
    const ring = list.filter((n) => n.metadata?.tier !== 'substrate')
    return list.map((n) => {
      if (n.metadata?.tier === 'substrate') return { n, x: 50, y: 50 }
      const i = ring.indexOf(n)
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, ring.length)
      return { n, x: 50 + 30 * Math.cos(a), y: 50 + 30 * Math.sin(a) }
    })
  }, [nodes])

  const online = (nodes ?? []).filter((n) => n.status === 'active').length

  return (
    <DashboardWidget
      id="federation-star"
      title="The Federation"
      icon={<Radio className="h-4 w-4 text-amber-500" />}
      headerRight={
        nodes ? (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">{online} online</span>
        ) : null
      }
    >
      <Link href="/dashboard/federation-network" className="group block">
        <svg viewBox="0 0 100 100" className="mx-auto h-44 w-44">
          <polygon points={PENTAGRAM} fill="none" stroke="#f5a62333" strokeWidth={0.5} strokeLinejoin="round" />
          {placed.map(({ n, x, y }) => {
            const color = TIER_COLOR[n.metadata?.tier ?? 'endeavor'] ?? '#99ccff'
            const r = n.metadata?.tier === 'substrate' ? 3.4 : n.metadata?.tier === 'diocese' ? 2.8 : 2
            return (
              <circle
                key={n.id}
                cx={x}
                cy={y}
                r={r}
                fill={`${color}cc`}
                stroke={color}
                strokeWidth={0.4}
                opacity={n.status === 'active' ? 1 : 0.4}
              >
                <title>{`${n.name} · ${n.metadata?.tier ?? 'node'}`}</title>
              </circle>
            )
          })}
          {!nodes && <text x={50} y={52} textAnchor="middle" fontSize={4} fill="#7788aa">loading…</text>}
        </svg>
        <span className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
          Open Command Center <ArrowRight className="h-3 w-3" />
        </span>
      </Link>
    </DashboardWidget>
  )
}
