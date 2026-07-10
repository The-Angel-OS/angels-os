import { setRequestLocale } from 'next-intl/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getSolvencySnapshot } from '@/utilities/solvency'

/**
 * Solvency — /dashboard/solvency
 *
 * The one screen Kenneth has to watch: is THE PLATFORM money-positive? Revenue
 * the platform actually keeps (Justice Fund allocations) minus what it spends to
 * run (cost-events). One big green/red number, the verdict in a sentence, and the
 * biggest cost lever if it ever goes red. super_admin only. The human floor
 * beneath the self-healing organism. @see src/utilities/solvency.ts
 */
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`

export default async function SolvencyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  let isSuperAdmin = false
  let snapshot: Awaited<ReturnType<typeof getSolvencySnapshot>> | null = null
  try {
    const payload = await getPayload({ config: configPromise })
    const headersList = await nextHeaders()
    const { user } = await payload.auth({ headers: headersList })
    isSuperAdmin = Boolean((user as { roles?: string[] } | null)?.roles?.includes('super_admin'))
    if (isSuperAdmin) snapshot = await getSolvencySnapshot(payload, { windowDays: 30 }).catch(() => null)
  } catch {
    /* fail-soft — render the restricted / unavailable state below */
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Solvency</h1>
        <p className="text-muted-foreground">
          This is the platform-wide money view — restricted to super_admin.
        </p>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Solvency</h1>
        <p className="text-muted-foreground">Ledgers unavailable on this node right now.</p>
      </div>
    )
  }

  const s = snapshot
  const color =
    s.status === 'positive' ? 'text-emerald-500' : s.status === 'watch' ? 'text-amber-500' : 'text-red-500'
  const ring =
    s.status === 'positive'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : s.status === 'watch'
        ? 'border-amber-500/30 bg-amber-500/5'
        : 'border-red-500/30 bg-red-500/5'
  const icon = s.status === 'positive' ? '🟢' : s.status === 'watch' ? '🟡' : '🔴'
  const net = s.lifetime.operationalNetCents

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Solvency</h1>
        <p className="text-sm text-muted-foreground">
          Is The Angel OS money-positive? Kept vs. spent — the one line to keep in the green.
        </p>
      </div>

      {/* The number */}
      <div className={`rounded-2xl border p-8 text-center ${ring}`}>
        <div className="text-sm uppercase tracking-wide text-muted-foreground">Operational net · lifetime</div>
        <div className={`mt-2 text-6xl font-bold tabular-nums ${color}`}>
          {net >= 0 ? '+' : '−'}
          {usd(Math.abs(net))}
        </div>
        <div className="mt-4 text-base">
          {icon} {s.verdict}
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Kept (covers infra)" value={usd(s.lifetime.platformRetainedCents)} sub={`${s.lifetime.revenueEvents} charge${s.lifetime.revenueEvents !== 1 ? 's' : ''} · gross ${usd(s.lifetime.grossProcessedCents)}`} />
        <Stat label="Infra spent" value={usd(s.lifetime.infraCostCents)} sub={`${s.lifetime.costEvents} event${s.lifetime.costEvents !== 1 ? 's' : ''}`} />
        <Stat
          label={`Last ${s.windowDays} days · net`}
          value={`${s.window.operationalNetCents >= 0 ? '+' : '−'}${usd(Math.abs(s.window.operationalNetCents))}`}
          sub={`kept ${usd(s.window.platformRetainedCents)} · infra ${usd(s.window.infraCostCents)}`}
        />
      </div>

      {(s.lifetime.disbursedCents > 0 || s.topCostCategory) && (
        <div className="rounded-xl border p-4 text-sm text-muted-foreground space-y-1">
          {s.lifetime.disbursedCents > 0 && (
            <div>Justice Fund disbursed (mission, not infra): {usd(s.lifetime.disbursedCents)}</div>
          )}
          {s.topCostCategory && (
            <div>
              Biggest cost lever: <span className="font-medium text-foreground">{s.topCostCategory.category}</span> ({usd(s.topCostCategory.costCents)} lifetime)
            </div>
          )}
        </div>
      )}

      {(!s.available.revenue || !s.available.cost) && (
        <p className="text-xs text-muted-foreground">
          Note: {!s.available.revenue ? 'revenue' : 'cost'} ledger unavailable on this node — figure may be partial.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}
