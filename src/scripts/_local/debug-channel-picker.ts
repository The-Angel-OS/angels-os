/** Debug: replay the MediaPicker channel query AS user 145, without overrideAccess. */
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })

const u = await payload.findByID({ collection: 'users', id: 145, depth: 0, overrideAccess: true })
console.log('user', (u as any).email, 'roles', JSON.stringify((u as any).roles))

for (const [label, spaceId] of [['community(6)', 6], ['aibus(18)', 18]] as Array<[string, number]>) {
  try {
    const res = await payload.find({
      collection: 'messages',
      where: { and: [{ space: { equals: spaceId } }, { channel: { equals: 'general' } }] },
      sort: '-createdAt',
      limit: 60,
      depth: 2,
      overrideAccess: false,
      user: u as never,
    })
    let imageHits = 0
    for (const msg of res.docs as any[]) {
      for (const att of msg.attachments || []) {
        const m = att?.media
        if (m && typeof m === 'object' && (m.mimeType || '').startsWith('image/') && m.url) imageHits++
      }
    }
    console.log(`${label}: totalDocs=${res.totalDocs} returned=${res.docs.length} imageHits=${imageHits}`)
  } catch (e) {
    console.log(`${label}: THREW ${(e as Error).message}`)
  }
}
process.exit(0)
