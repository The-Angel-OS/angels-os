import Link from 'next/link'
import type { EarnReadiness } from '@/utilities/earnReadiness'

/**
 * "Ready to Earn" — surfaces the earn-loop readiness (utilities/earnReadiness) so an
 * owner never flies blind on whether their portal can take a real dollar. Shows a
 * green all-clear or the FIRST blocker with its next action + checklist.
 * Presentational: the dashboard page computes the readiness server-side and passes it.
 */
export function EarnReadinessCard({ readiness }: { readiness: EarnReadiness }) {
  const { ready, billingMode, checks, nextAction } = readiness

  const connectGate = !checks.connectRequired || (checks.connectOnboarded && checks.chargesEnabled)
  const gates: Array<{ label: string; done: boolean }> = [
    ...(checks.connectRequired ? [{ label: 'Square Payouts', done: connectGate }] : []),
    { label: 'Membership plan', done: checks.planCount > 0 },
    { label: 'Webhook secret', done: checks.webhookConfigured },
  ]

  const accent = ready ? '#22cc88' : '#f5a623'
  const fixHref =
    !checks.providersConfigured || (checks.connectRequired && !connectGate)
      ? '/dashboard/admin/settings?tab=payments'
      : checks.planCount === 0
        ? '/dashboard/memberships'
        : '/dashboard/admin/settings?tab=payments'

  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: `${accent}44`, background: `${accent}0d` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: `${accent}22`, color: accent }}
          >
            {ready ? '✓' : '!'}
          </span>
          <div>
            <div className="text-sm font-semibold" style={{ color: accent }}>
              {ready ? 'Ready to earn' : 'One step from earning'}
            </div>
            <div className="text-xs text-muted-foreground">
              {ready
                ? `Your site is ready to accept recurring payments (${billingMode} mode).`
                : 'Your monetization setup is almost ready.'}
            </div>
          </div>
        </div>
        <Link
          href={ready ? '/dashboard/memberships' : fixHref}
          className="shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-white/5"
          style={{ borderColor: `${accent}55`, color: accent }}
        >
          {ready ? 'Manage plans →' : 'Complete setup →'}
        </Link>
      </div>

      {!ready && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium" style={{ color: accent }}>Next:</span> {nextAction}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {gates.map((g) => (
          <span key={g.label} className="inline-flex items-center gap-1.5" style={{ color: g.done ? '#22cc88' : '#7788aa' }}>
            <span>{g.done ? '✓' : '○'}</span>
            {g.label}
          </span>
        ))}
      </div>
    </div>
  )
}
