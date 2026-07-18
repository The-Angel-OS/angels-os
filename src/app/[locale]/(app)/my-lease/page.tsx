import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { getMembershipPlans } from '@/utilities/membershipPlans'
import { AutopayButton } from './AutopayButton'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { tenant } = await resolveTenantFromHeaders()
  const name =
    (tenant as { branding?: { siteName?: string }; name?: string })?.branding?.siteName ||
    (tenant as { name?: string })?.name ||
    'your rental'
  return { title: `My Lease | ${name}` }
}

const money = (cents?: number | null) =>
  typeof cents === 'number' ? `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

/**
 * Renter lease portal — the tenant-facing home for a rent Listing.
 *
 * Host-authoritative on the landlord's endeavor FQDN. A signed-in renter sees
 * their rent lease(s) — amount, cadence, status, next due — and sets up / manages
 * ACH autopay. A lease is a `memberships` row whose plan is kind:'rent' (created
 * when the renter starts autopay via the shared checkout link; the webhook syncs
 * status). @see docs/strategy/BOOKABLE_INVENTORY_PLAN.md §7 (Mode 3, Slice 2)
 */
export default async function MyLeasePage() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect('/login?redirect=/my-lease')

  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) redirect('/')

  // Which plans on this endeavor are rent (leases)?
  const plans = await getMembershipPlans(payload, tenantId)
  const rentPlanIds = new Set(plans.filter((p) => p.kind === 'rent').map((p) => p.id))

  // This renter's memberships on this endeavor (by linked user OR email).
  const email = (user as { email?: string }).email || ''
  const memberships = await payload.find({
    collection: 'memberships',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        {
          or: [
            { member: { equals: user.id } },
            ...(email ? [{ memberEmail: { equals: email } }] : []),
          ],
        },
      ],
    },
    limit: 25,
    depth: 0,
    overrideAccess: true,
    sort: '-startedAt',
  })

  // Leases = rent-kind memberships (fall back to all if no plan is tagged yet).
  const leases = (memberships.docs as unknown as Array<Record<string, unknown>>).filter(
    (m) => rentPlanIds.size === 0 || rentPlanIds.has(String(m.planId)),
  )

  const activeStatuses = new Set(['active', 'trialing'])

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">My lease</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your rent and autopay, all in one place.</p>

      {leases.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No lease is on file for your account yet. If your landlord sent you an autopay link,
            open it to get set up — or reach out to them.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {leases.map((m) => {
            const status = String(m.status || 'incomplete')
            const autopayOn = activeStatuses.has(status)
            const pastDue = status === 'past_due'
            return (
              <div key={String(m.id)} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{String(m.planName || 'Rent')}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {money(m.amountCents as number)} / {String(m.interval || 'month')}
                    </p>
                  </div>
                  <span
                    className={[
                      'rounded-full px-3 py-1 text-xs font-semibold',
                      pastDue
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        : autopayOn
                          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                          : 'bg-muted text-muted-foreground',
                    ].join(' ')}
                  >
                    {pastDue ? 'Past due' : autopayOn ? 'Autopay on' : 'Autopay off'}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Next payment</dt>
                    <dd>{fmtDate(m.currentPeriodEnd as string)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Started</dt>
                    <dd>{fmtDate(m.startedAt as string)}</dd>
                  </div>
                </dl>

                {!autopayOn && (
                  <div className="mt-5">
                    <AutopayButton planId={String(m.planId)} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Pays by bank transfer (ACH) — no card fees. You’ll confirm your bank once;
                      rent then draws automatically each {String(m.interval || 'month')}.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
