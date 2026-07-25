/** Verify ensureBaselineMemberships: grants platform + guardian angel, and is idempotent. */
import { getPayload } from 'payload'
import config from '@payload-config'
import { ensureBaselineMemberships } from '@/utilities/ensureBaselineMemberships'

const payload = await getPayload({ config })

const platform = await payload.find({
  collection: 'tenants', where: { slug: { equals: 'platform' } }, limit: 1, depth: 0, overrideAccess: true,
})
const platformId = (platform.docs[0] as { id: number }).id

// Find a real user WITHOUT platform membership — the case this fixes.
const users = await payload.find({ collection: 'users', limit: 200, depth: 0, overrideAccess: true })
let target: { id: number; email?: string; name?: string } | undefined
for (const u of users.docs as Array<{ id: number; email?: string; name?: string }>) {
  const tm = await payload.find({
    collection: 'tenant-memberships',
    where: { and: [{ user: { equals: u.id } }, { tenant: { equals: platformId } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  if (tm.totalDocs === 0 && u.email) { target = u; break }
}
if (!target) { console.log('ALL users already have platform membership — nothing to prove'); process.exit(0) }

console.log('target user', target.id, target.email)
const r1 = await ensureBaselineMemberships(payload, target)
console.log('run1', JSON.stringify(r1))
const r2 = await ensureBaselineMemberships(payload, target)
console.log('run2 (idempotency)', JSON.stringify(r2))

const after = await payload.find({
  collection: 'tenant-memberships',
  where: { and: [{ user: { equals: target.id } }, { tenant: { equals: platformId } }] },
  limit: 5, depth: 0, overrideAccess: true,
})
console.log('platform memberships after (expect exactly 1):', after.totalDocs)
process.exit(0)
