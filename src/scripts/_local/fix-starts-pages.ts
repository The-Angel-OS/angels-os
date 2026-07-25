/** One-off: delete start-s (tenant 24) pages left broken by rolled-back media, so provision can recreate them. */
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })
const pages = await payload.find({ collection: 'pages', where: { tenant: { equals: 24 } }, limit: 50, depth: 0, overrideAccess: true })
for (const p of pages.docs) {
  await payload.delete({ collection: 'pages', id: p.id, overrideAccess: true })
  console.log('deleted page', p.id, (p as { slug?: string }).slug)
}
console.log('DONE')
process.exit(0)
