/** One-off: append the 4 van screenshots (media 411-414) as a gallery on the van post (67), tenant 24. Idempotent. */
import { getPayload } from 'payload'
import config from '@payload-config'

const POST = 67
const MEDIA = [411, 412, 413, 414]

const payload = await getPayload({ config })
const post = (await payload.findByID({ collection: 'posts', id: POST, depth: 0, overrideAccess: true })) as any
const layout: any[] = Array.isArray(post.layout) ? post.layout : []
if (layout.some((b) => b.blockType === 'gallery')) {
  console.log('EXISTS — gallery already on post', POST)
  process.exit(0)
}
layout.push({ blockType: 'gallery', columns: '2', images: MEDIA.map((id) => ({ image: id })) })
await (payload.update as any)({
  collection: 'posts',
  id: POST,
  data: { layout, hero: { type: 'highImpact', media: MEDIA[0] }, meta: { ...(post.meta || {}), image: MEDIA[0] } },
  overrideAccess: true,
})
console.log('OK — gallery of', MEDIA.length, 'images added to post', POST)
process.exit(0)
