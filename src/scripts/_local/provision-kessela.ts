/**
 * Provision the Kessela endeavor.
 *
 * kessela.com is a WordPress brochure site carrying a $599 price and NO cart —
 * the "Buy Kessela Now!" link points at the page you are already on. So this
 * portal is not a mirror of a store, it becomes the only place the product can
 * actually be bought.
 *
 * Uses the platform's own provisioning helpers rather than raw inserts, so the
 * tenant gets its default pages, navigation and space like any other — a
 * half-formed tenant row is how the empty-Community-space class of bug starts.
 *
 * Run:  pnpm payload run src/scripts/_local/provision-kessela.ts
 * Then: pnpm payload run src/scripts/_local/import-site.ts -- --tenant=kessela --base=https://kessela.com
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { findOrCreateTenant } from '@/endpoints/seed/seed-helpers'
import { createDefaultTenantPages } from '@/utilities/createDefaultTenantPages'
import { createDefaultTenantNavigation } from '@/utilities/createDefaultTenantNavigation'

const payload = await getPayload({ config })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const req = { payload } as any

const tenant = await findOrCreateTenant(payload, req, {
  name: 'Kessela',
  slug: 'kessela',
  domain: 'kessela.spacesangels.com',
  type: 'tenant',
  branding: {
    siteName: 'Kessela',
    tagline: 'Red light therapy + EMS core contouring',
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any)

const tenantId = tenant.id as number
console.log(`tenant: ${tenant.name} (${tenant.slug}) id=${tenantId}`)

await payload.update({
  collection: 'tenants',
  id: tenantId,
  data: {
    status: 'active',
    businessType: 'retail',
    storefront: { description: 'Kessela Elite Core Contouring Belt — PBM (red/NIR) + EMS.' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  overrideAccess: true,
})

await createDefaultTenantPages(
  payload,
  tenantId,
  { siteName: 'Kessela', tagline: 'Red light therapy + EMS core contouring' },
  req,
)
await createDefaultTenantNavigation(payload, tenantId, req)

console.log(`\nDone. https://kessela.spacesangels.com`)
console.log('Next: import-site.ts to mirror the brochure pages, then add the product + Stripe.')
process.exit(0)
