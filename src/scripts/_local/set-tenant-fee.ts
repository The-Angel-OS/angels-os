/**
 * Set (or clear) a tenant's platform-fee override.
 *
 * Kenneth's deal with Kessela is 10% of everything sold, and he is the platform —
 * so the cut and the platform fee are one pocket. Collected as Stripe's
 * `application_fee_amount` it is deducted at checkout, which means getting paid
 * needs no invoice and no monthly conversation.
 *
 *   pnpm payload run src/scripts/_local/set-tenant-fee.ts -- --tenant=kessela --bps=1000
 *   pnpm payload run src/scripts/_local/set-tenant-fee.ts -- --tenant=kessela --clear
 *
 * ⚠️ This is inert until that tenant completes Stripe Connect. With no connected
 * account there is no split to take a fee from — the money simply lands in the
 * platform's own Stripe.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { getPlatformFeeBps, setTenantPlatformFeeBps, bpsToPercent } from '@/utilities/platformFee'

const arg = (name: string, fallback = ''): string => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const has = (name: string) => process.argv.includes(`--${name}`)

const slug = arg('tenant')
if (!slug) {
  console.error('Usage: --tenant=<slug> (--bps=1000 | --clear)')
  process.exit(1)
}

const payload = await getPayload({ config })

const found = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: slug } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenant = found.docs?.[0] as { id: number; name?: string; stripeConnect?: Record<string, unknown> } | undefined
if (!tenant) {
  console.error(`No tenant "${slug}".`)
  process.exit(1)
}

const before = await getPlatformFeeBps(payload, tenant.id)
const nodeRate = await getPlatformFeeBps(payload)

if (has('clear')) {
  await setTenantPlatformFeeBps(payload, tenant.id, null)
} else {
  // ⚠️ Check the flag is PRESENT before parsing it. `Number('')` is 0 and 0 is
  // finite, so `Number.isFinite(Number(arg('bps')))` happily accepts a missing
  // flag and sets the tenant's fee to zero. Running this with neither --bps nor
  // --clear (to READ a rate) silently zeroed two live tenants. FOOTGUNS §2.3:
  // absent is not zero, and a guard that only validates the parsed value cannot
  // tell the difference.
  const raw = arg('bps')
  if (!raw.trim()) {
    console.error('Pass --bps=<n> to set, or --clear to remove. Neither given — nothing changed.')
    process.exit(1)
  }
  const bps = Number(raw)
  if (!Number.isFinite(bps) || bps < 0) {
    console.error(`--bps must be a non-negative number (1000 = 10%), got "${raw}"`)
    process.exit(1)
  }
  await setTenantPlatformFeeBps(payload, tenant.id, bps)
}

const after = await getPlatformFeeBps(payload, tenant.id)
console.log(`${slug}: ${bpsToPercent(before)}%  ->  ${bpsToPercent(after)}%   (node rate ${bpsToPercent(nodeRate)}%)`)

const connected = (tenant.stripeConnect as { stripeAccountId?: string } | undefined)?.stripeAccountId
if (!connected) {
  console.log(
    `\n⚠️  ${slug} has NO connected Stripe account, so this rate is inert:\n` +
      `    every sale currently lands in the platform's own Stripe, unsplit.\n` +
      `    Complete Stripe Connect for this tenant before relying on it.`,
  )
}
process.exit(0)
