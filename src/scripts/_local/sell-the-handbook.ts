/**
 * Put one training on sale, end to end — the first thing this platform has
 * ever actually offered for money.
 *
 * The entitlement rail shipped 260826 and nothing was bound to it: no Work had
 * a `product`, none had `access` set to anything but `public`, so the three
 * ways in resolved to "everyone, free" every time. This binds The Angel OS
 * Handbook to a priced product so the rail carries a real load.
 *
 * Idempotent — re-running finds the product by slug instead of making a second.
 *
 * Run:  DATABASE_URI=<live> npx payload run src/scripts/_local/sell-the-handbook.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })

const WORK_SLUG = 'angel-os-handbook'
const PRODUCT_SLUG = 'angel-os-handbook-training'
const PRICE_USD = 49

const work = (await payload.find({
  collection: 'works',
  where: { slug: { equals: WORK_SLUG } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})).docs[0]
if (!work) throw new Error(`no work ${WORK_SLUG}`)

const tenant = (await payload.find({
  collection: 'tenants',
  where: { slug: { equals: 'platform' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})).docs[0]
if (!tenant) throw new Error('no platform tenant')

const existing = (await payload.find({
  collection: 'products',
  where: { slug: { equals: PRODUCT_SLUG } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})).docs[0]

const data = {
  title: 'The Angel OS Handbook — Training',
  slug: PRODUCT_SLUG,
  tenant: tenant.id,
  priceInUSD: PRICE_USD,
  _status: 'published',
} as never

const product = existing
  ? await payload.update({
      collection: 'products',
      id: existing.id,
      data: { ...(data as object), _status: 'published' } as never,
      draft: false,
      overrideAccess: true,
    })
  : await payload.create({ collection: 'products', data, overrideAccess: true })

await payload.update({
  collection: 'works',
  id: work.id,
  data: { access: 'purchase', product: product.id } as never,
  overrideAccess: true,
})

// Verify by RE-QUERYING — a returned doc is not proof it was written.
const check = (await payload.findByID({
  collection: 'works',
  id: work.id,
  depth: 0,
  overrideAccess: true,
})) as unknown as { access?: string; product?: number }
console.log('work', work.id, 'access', check.access, 'product', check.product, 'price', PRICE_USD)
if (check.access !== 'purchase' || Number(check.product) !== Number(product.id)) {
  throw new Error('binding did not stick')
}
process.exit(0)
