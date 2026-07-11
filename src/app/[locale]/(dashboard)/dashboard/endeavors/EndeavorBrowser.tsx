'use client'

/**
 * EndeavorBrowser — a cross-federation endeavor directory, Nimue-style.
 *
 * Shows every endeavor reachable across the known Enterprise nodes. Each node's
 * `/api/federation/holons` is fetched FROM THE BROWSER (not server-side) so the
 * cross-node reads use the client's egress, dodging the serverless-WAF block that
 * defeats node-to-node discovery (see project_federation_discovery_finding). Peers
 * that fail (offline / CORS) degrade gracefully — the rest still render.
 *
 * v1 = the public directory across nodes + hop-to-storefront. Personalized "you're
 * a member" badges layer on once federated identity is resolved per node.
 */
import { useEffect, useMemo, useState } from 'react'

/** Known federation entry points — mirrors Nimue's enterprise seed. The empty
 *  base is THIS node (same-origin), which always answers. */
const NODES: Array<{ id: string; name: string; base: string }> = [
  { id: 'here', name: 'This node', base: '' },
  { id: 'platform', name: 'Spaces Angels', base: 'https://platform.spacesangels.com' },
  { id: 'federation', name: 'KenDev Federation', base: 'https://federation.kendev.co' },
]

interface Holon {
  id: number | string
  name: string
  tagline?: string
  description?: string
  endeavorType?: string
  region?: { city?: string; state?: string; country?: string }
  logo?: string | null
  storefrontUrl?: string | null
  tenant?: { slug?: string } | null
  _node?: string // which Enterprise surfaced it (client-tagged)
}

const regionLabel = (r?: Holon['region']) =>
  [r?.city, r?.state, r?.country].filter(Boolean).join(', ')

export function EndeavorBrowser() {
  const [holons, setHolons] = useState<Holon[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState<string[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const results = await Promise.allSettled(
        NODES.map(async (node) => {
          const res = await fetch(`${node.base}/api/federation/holons?limit=100`, {
            headers: { accept: 'application/json' },
            // same-origin sends the session; cross-origin is a plain public GET
            credentials: node.base ? 'omit' : 'include',
          })
          if (!res.ok) throw new Error(`${node.name}: HTTP ${res.status}`)
          const data = await res.json()
          const list: Holon[] = Array.isArray(data?.holons) ? data.holons : []
          return list.map((h) => ({ ...h, _node: node.name }))
        }),
      )
      if (!active) return
      const merged: Holon[] = []
      const seen = new Set<string>()
      const bad: string[] = []
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          for (const h of r.value) {
            // Dedup by storefront/tenant so the same endeavor gossiped by two nodes
            // shows once.
            const key = String(h.storefrontUrl || h.tenant?.slug || `${h._node}:${h.id}`)
            if (!seen.has(key)) { seen.add(key); merged.push(h) }
          }
        } else {
          bad.push(NODES[i].name)
        }
      })
      setHolons(merged)
      setFailed(bad)
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return holons
    return holons.filter((h) =>
      `${h.name} ${h.tagline || ''} ${regionLabel(h.region)} ${h.endeavorType || ''}`.toLowerCase().includes(term),
    )
  }, [holons, q])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Endeavors</h1>
        <p className="text-sm text-muted-foreground">
          Every endeavor across the federation you can reach
          {!loading && <> · {filtered.length} of {holons.length}</>}
        </p>
      </div>

      <div className="mb-5">
        <div className="relative max-w-md">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search endeavors, region, type…"
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/50"
            style={{ fontSize: '16px' }}
          />
        </div>
        {failed.length > 0 && (
          <p className="mt-2 text-xs text-amber-500">
            Couldn&apos;t reach {failed.join(', ')} — showing the rest.
          </p>
        )}
      </div>

      {loading ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Discovering endeavors across the federation…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {q ? 'No endeavors match your search.' : 'No endeavors are visible on the federation yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((h) => (
            <a
              key={`${h._node}-${h.id}`}
              href={h.storefrontUrl || '#'}
              target={h.storefrontUrl ? '_blank' : undefined}
              rel="noreferrer"
              className="group flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex items-center gap-3">
                {h.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.logo} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg">🏛️</div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold group-hover:text-primary">{h.name}</h3>
                  {h.tagline && <p className="truncate text-xs text-muted-foreground">{h.tagline}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
                {h.endeavorType && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{h.endeavorType}</span>}
                {regionLabel(h.region) && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{regionLabel(h.region)}</span>}
                <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-primary">{h._node}</span>
              </div>
              {h.storefrontUrl && (
                <span className="mt-3 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">Open →</span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
