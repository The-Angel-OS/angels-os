/**
 * Prove the purchase rail against the LIVE database, without a live card.
 *
 * The one step this cannot do is put a real card into Stripe (live keys — a
 * real charge, and not mine to make). Everything downstream of Stripe saying
 * "succeeded" IS exercised here: an order in exactly the shape the ecommerce
 * plugin's confirmOrder writes → resolveTrainingAccess → the course opens.
 *
 * That is the half that was broken: the order the plugin writes lands at
 * `processing`, and every reader in this codebase was asking for a `paid`
 * status the enum has never contained.
 *
 * Creates a throwaway user + order, asserts, then deletes both and re-queries
 * to confirm they are gone.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTrainingAccess } from '@/utilities/trainingAccess'

const payload = await getPayload({ config })
const stamp = Date.now()
const email = `purchase-proof-${stamp}@example.invalid`

const work = (await payload.find({
  collection: 'works',
  where: { slug: { equals: 'angel-os-handbook' } },
  limit: 1, depth: 0, overrideAccess: true,
})).docs[0] as unknown as { id: number; access: string; product: number; owner: string }

console.log('work:', work.id, work.access, 'product', work.product)

const user = await payload.create({
  collection: 'users',
  data: { email, password: `pw-${stamp}-${Math.random()}`, name: 'Purchase Proof' } as never,
  overrideAccess: true,
})

const before = await resolveTrainingAccess(payload, { id: user.id }, work)
console.log('before buying :', before)

const order = await payload.create({
  collection: 'orders',
  data: {
    amount: 4900,
    currency: 'USD',
    customer: user.id,
    status: 'processing', // what confirmOrder actually writes after Stripe succeeds
    items: [{ product: work.product, quantity: 1 }],
  } as never,
  overrideAccess: true,
})

const after = await resolveTrainingAccess(payload, { id: user.id }, work)
console.log('after buying  :', after)

// Clean up, then RE-QUERY — a delete that resolves is not a delete that happened.
await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true })
await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
const leftOrders = await payload.count({ collection: 'orders', where: { id: { equals: order.id } }, overrideAccess: true })
const leftUsers = await payload.count({ collection: 'users', where: { id: { equals: user.id } }, overrideAccess: true })
console.log('cleanup: orders left', leftOrders.totalDocs, '/ users left', leftUsers.totalDocs)

const ok =
  before.allowed === false && before.reason === 'purchase_required' &&
  after.allowed === true && after.reason === 'purchased' &&
  leftOrders.totalDocs === 0 && leftUsers.totalDocs === 0
console.log(ok ? 'PASS — buying opens the training' : 'FAIL')
process.exit(ok ? 0 : 1)
