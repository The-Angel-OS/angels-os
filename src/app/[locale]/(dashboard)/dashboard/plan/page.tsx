/**
 * Your plan — /dashboard/plan
 *
 * The other end of the sidebar's "Upgrade plan" row. Says what this portal is on
 * today, what the paid tiers add, and how to move.
 *
 * The tiers are the PLATFORM's, not the tenant's. `membership-ops/plans` answers
 * "what does this tenant sell its own customers", which for a lawn-care portal is
 * an empty list — a different question with a confusingly similar shape. These
 * three are what a portal pays US, and they live here because the copy on
 * /pricing is the same three and must not drift from it.
 *
 * ponytail: checkout is a link to the apex, not a Stripe session minted here.
 * Charging is one flow that should exist once, and it already exists there.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { resolveActiveTenant } from '@/utilities/resolveActiveTenant'
import { planOf, PLAN_PRICE_CENTS, PLAN_FEE_BPS } from '@/utilities/portalPlan'

/** One price, one place — the map decides, this page renders it. */
const priceOf = (id: Tier['id']) =>
  PLAN_PRICE_CENTS[id] === 0 ? '$0' : `$${PLAN_PRICE_CENTS[id] / 100}/mo`

export const dynamic = 'force-dynamic'

type Tier = {
  id: 'free' | 'site' | 'business'
  name: string
  price: string
  /** The booking fee this plan pays. The monthly buys the rate down — that IS the pitch. */
  fee: string
  summary: string
  adds: string[]
}

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    price: priceOf('free'),
    fee: `${PLAN_FEE_BPS.free / 100}% of each deposit, never more than $9.99`,
    summary: 'Your website, live, on a spacesangels.com address. Keep it as long as you like.',
    adds: [
      'Five-page website, built for you',
      'Hosting, SSL and security',
      'A contact form that reaches you',
      'Mobile-friendly, light and dark themes',
      'A small “Powered by The Angel OS” line in the footer',
    ],
  },
  {
    id: 'site',
    name: 'Site',
    price: priceOf('site'),
    fee: `${PLAN_FEE_BPS.site / 100}% of each deposit — half the free rate`,
    summary: 'Your own domain instead of ours, and the footer credit gone.',
    adds: [
      'Your own domain name, pointed and secured',
      'The footer credit removed',
      'Unlimited changes — ask Leo, or edit any page yourself',
      'New pages and posts whenever you want them',
      'Photos generated for you if you don’t have any',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: priceOf('business'),
    fee: 'No booking fee at all',
    summary: 'Everything above, plus the part that actually earns.',
    adds: [
      'Customers book online and leave a deposit that holds the slot',
      'Deposits credited to the final invoice',
      'Your customer list and follow-ups, kept for you',
      'An assistant that answers questions about your business',
      'Memberships and recurring billing for your own customers',
    ],
  },
]

export default async function PlanPage() {
  const payload = await getPayload({ config })
  const headers = await nextHeaders()
  const { user } = await payload.auth({ headers })
  // auth() can also return an API-key principal; only a real User resolves an
  // active endeavor.
  const authUser = user && (user as { collection?: string }).collection === 'users' ? (user as Parameters<typeof resolveActiveTenant>[0]) : null
  const { tenant } = await resolveActiveTenant(authUser)

  // `demo` is a real plan and it is NOT one of the three tiers — a demo portal
  // has everything, billed to nobody. Casting it to a Tier id made findIndex
  // return -1, so all eight demo portals were told they were on Free and shown
  // an upgrade button for a plan that would take features AWAY from them.
  const plan = planOf(tenant as { portalPlan?: string | null } | null)
  const isDemo = plan === 'demo'
  const current = (isDemo ? 'business' : plan) as Tier['id']
  const currentIndex = TIERS.findIndex((t) => t.id === current)

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">Your plan</h1>
      {isDemo ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {tenant?.name ? `${tenant.name} is a ` : 'This is a '}
          <strong className="text-foreground">demonstration portal</strong> — everything below is
          switched on and nothing is being billed. When you are ready to make it yours, the plans
          are here so you know what it costs; nothing gets rebuilt when you pick one.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {tenant?.name ? `${tenant.name} is on ` : 'This portal is on '}
          <strong className="text-foreground">{TIERS[currentIndex >= 0 ? currentIndex : 0]!.name}</strong>. Nothing
          gets rebuilt when you move up — a paid plan unlocks what is already sitting behind your
          site.
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {TIERS.map((tier, i) => {
          const isCurrent = !isDemo && tier.id === current
          const isUpgrade = i > currentIndex
          return (
            <div
              key={tier.id}
              className={`flex flex-col rounded-lg border p-5 ${
                isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{tier.name}</h2>
                <span className="text-sm font-medium text-muted-foreground">{tier.price}</span>
              </div>
              {isCurrent && (
                <span className="mt-1 self-start rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Current plan
                </span>
              )}
              <p className="mt-2 text-sm text-muted-foreground">{tier.summary}</p>
              <p className="mt-2 text-xs font-medium text-foreground/80">{tier.fee}</p>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm text-muted-foreground">
                {tier.adds.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span aria-hidden="true" className="text-primary">
                      ·
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
              {isUpgrade && !isDemo && (
                <a
                  href={`https://spacesangels.com/plans?portal=${tenant?.slug || ''}&plan=${tier.id}`}
                  className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Move to {tier.name}
                </a>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Prices are per site, per month, in US dollars. No setup fee, no contract, cancel any month. Full detail on{' '}
        <a className="underline" href="https://spacesangels.com/pricing" target="_blank" rel="noopener noreferrer">
          the pricing page
        </a>
        . Questions? <Link className="underline" href="/dashboard/spaces">Ask Leo</Link>.
      </p>
    </div>
  )
}
