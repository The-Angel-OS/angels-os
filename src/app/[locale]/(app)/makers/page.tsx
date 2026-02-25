import type { Metadata } from 'next'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getActiveTokensByCapability, type MakerOpportunity } from '@/utilities/angelTokens'

export const dynamic = 'force-dynamic'

export default async function MakersPage() {
  const payload = await getPayload({ config: configPromise })
  let opportunities: MakerOpportunity[] = []
  let totalRevenue = 0
  let totalOrders = 0

  try {
    opportunities = await getActiveTokensByCapability(payload)
    totalRevenue = opportunities.reduce((sum, o) => sum + o.estimatedVendorRevenue, 0)
    totalOrders = opportunities.reduce((sum, o) => sum + o.queuedOrders, 0)
  } catch {
    // Graceful fallback — page still renders
  }

  return (
    <div className="container py-12 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Makers Wanted
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {totalOrders > 0
            ? `${totalOrders} paid order${totalOrders !== 1 ? 's' : ''} waiting for makers. ~$${Math.round(totalRevenue).toLocaleString()} in vendor revenue available.`
            : 'Join our maker network and earn 60% of every order you fulfill. Register your workshop to get started.'}
        </p>
      </div>

      {/* Opportunity Grid */}
      {opportunities.length > 0 && (
        <div className="mb-12">
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground uppercase tracking-wider text-sm">
            Orders Waiting by Capability
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {opportunities.map((opp) => (
              <div
                key={opp.skill}
                className="rounded-lg border border-border bg-card p-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{formatSkillName(opp.skill)}</h3>
                    {opp.equipment && (
                      <p className="text-sm text-muted-foreground">{opp.equipment}</p>
                    )}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                    {opp.queuedOrders} order{opp.queuedOrders !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    ~${Math.round(opp.estimatedVendorRevenue).toLocaleString()} revenue
                  </span>
                  <span className="text-muted-foreground">
                    Waiting since {formatDate(opp.oldestQueuedAt)}
                  </span>
                </div>

                {opp.exampleProducts.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Examples: {opp.exampleProducts.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="mb-12">
        <h2 className="text-lg font-semibold mb-6 text-muted-foreground uppercase tracking-wider text-sm">
          How It Works
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-xl font-bold text-primary">1</span>
            </div>
            <h3 className="font-semibold mb-1">Register Equipment</h3>
            <p className="text-sm text-muted-foreground">
              Tell us what you can make — CNC, screen printing, 3D printing, laser cutting, whatever you&apos;ve got.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-xl font-bold text-primary">2</span>
            </div>
            <h3 className="font-semibold mb-1">Claim Orders</h3>
            <p className="text-sm text-muted-foreground">
              Browse waiting orders that match your skills. Claim the ones you want, or let your AI assistant handle it.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-xl font-bold text-primary">3</span>
            </div>
            <h3 className="font-semibold mb-1">Produce &amp; Ship</h3>
            <p className="text-sm text-muted-foreground">
              Make the product, ship it out, earn 60% of the sale. Fair, transparent, constitutional.
            </p>
          </div>
        </div>
      </div>

      {/* Fair Split Explainer */}
      <div className="rounded-lg border border-border bg-card p-6 mb-12">
        <h2 className="font-semibold mb-3">The Constitutional Fair Split</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Every transaction follows the Ultimate Fair Split — transparent, immutable, fair from day one.
        </p>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-emerald-600">60%</p>
            <p className="text-xs text-muted-foreground">You (the maker)</p>
          </div>
          <div>
            <p className="text-2xl font-bold">20%</p>
            <p className="text-xs text-muted-foreground">Platform partner</p>
          </div>
          <div>
            <p className="text-2xl font-bold">15%</p>
            <p className="text-xs text-muted-foreground">Operations</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">5%</p>
            <p className="text-xs text-muted-foreground">Justice Fund</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <p className="text-muted-foreground mb-4">
          Ready to start making? Talk to LEO in any space to register your workshop.
        </p>
        <p className="text-sm text-muted-foreground">
          Or ask: &quot;LEO, register my workshop as a print node&quot;
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSkillName(skill: string): string {
  return skill
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'recently'
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Become a Maker | Angel OS',
  description: 'Join the Angel OS maker network. Paid orders are waiting for makers with CNC, 3D printing, screen printing, and more. Earn 60% of every order you fulfill.',
  openGraph: mergeOpenGraph({
    title: 'Become a Maker | Angel OS',
    url: '/makers',
  }),
}
