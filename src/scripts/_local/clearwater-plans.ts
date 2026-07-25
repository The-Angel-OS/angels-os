/**
 * Clearwater Cruisin Ministries — membership plans.
 *
 * Spitballed price points, meant to be edited from the dashboard. The structure
 * is the deliberate part:
 *
 *  - A $1 door. The Founding Dollar exists to be said yes to without thinking.
 *    Its job is not revenue, it is converting a viewer into a MEMBER — after
 *    which the good-standing gate, the member content and the renewal all work.
 *    One dollar a month from a YouTube audience beats three $25 pledges you
 *    never get.
 *  - A middle tier that is the actual ask ($10 — the "I watch this every week"
 *    price).
 *  - A high tier for the people who would give more if you let them ($25).
 *  - An annual at a two-month discount ($100/yr vs $120), because ministry
 *    giving is often a once-a-year decision.
 *
 * These are DUES, not Patreon tiers: every level unlocks the same member
 * content. Per-tier entitlement does not exist yet and shouldn't until someone
 * actually wants to sell two levels of access.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { executeToolCall } from '@/utilities/leo-data-tools'

const payload = await getPayload({ config })
const SLUG = 'clearwater-cruisin'
const ctx = { payload, userId: 3, roles: ['super_admin'] }

const t = await payload.find({
  collection: 'tenants', where: { slug: { equals: SLUG } }, limit: 1, depth: 0, overrideAccess: true,
})
const tenantId = Number((t.docs[0] as { id: number }).id)

const plans = [
  {
    name: 'Founding Dollar',
    amountUsd: 1,
    interval: 'month',
    description: 'A dollar a month. You are on the crew manifest, and you keep the Soul Van rolling.',
  },
  {
    name: 'Crew',
    amountUsd: 10,
    interval: 'month',
    description: 'For the regulars. Member updates from the road, and you fund a pantry run every month.',
  },
  {
    name: 'Navigator',
    amountUsd: 25,
    interval: 'month',
    description: 'For those who want to push it further — fuel, gear, and the next leg of the quest.',
  },
  {
    name: 'Pilgrim (Annual)',
    amountUsd: 100,
    interval: 'year',
    description: 'A year at once, two months on us. For people who prefer to decide it once.',
  },
]

// configure via LEO's own tool so the same call works from a chat message.
for (const p of plans) {
  const out = await executeToolCall('create_membership_plan', { ...p, tenantSlug: SLUG }, ctx)
  console.log(`${p.name}: ${out.split('\n')[0]}`)
  if (/^Error/i.test(out)) console.log(out.slice(0, 300))
}

const { getMembershipPlans } = await import('@/utilities/membershipPlans')
const saved = await getMembershipPlans(payload, tenantId)
console.log('\nplans now:', saved.map((p) => `${p.id}=$${(p.amountCents / 100).toFixed(2)}/${p.interval}`).join('  '))
