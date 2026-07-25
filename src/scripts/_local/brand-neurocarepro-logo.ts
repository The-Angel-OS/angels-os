/**
 * One-off: fetch NeuroCare Pro's wordmark and set it as tenant 22's branding.logo
 * so the site header shows their logo instead of the Angel OS default.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const TENANT = 22
const LOGO_URL = 'https://neurocarepro.com/wp-content/uploads/2024/01/Neurocare-Pro-Logo-400px.png'
const FILENAME = 'neurocarepro-logo.png'

const payload = await getPayload({ config })

let mediaId: number | string
const existing = await payload.find({
  collection: 'media',
  where: { and: [{ tenant: { equals: TENANT } }, { filename: { equals: FILENAME } }] },
  limit: 1, depth: 0, overrideAccess: true,
})
if (existing.docs[0]) {
  mediaId = (existing.docs[0] as any).id
  console.log('LOGO reused', mediaId)
} else {
  const res = await fetch(LOGO_URL)
  if (!res.ok) { console.log('FETCH_FAILED', res.status); process.exit(1) }
  const buf = Buffer.from(await res.arrayBuffer())
  const created = await (payload.create as any)({
    collection: 'media',
    data: { alt: 'NeuroCare Pro', tenant: TENANT },
    file: { data: buf, mimetype: 'image/png', name: FILENAME, size: buf.length },
    overrideAccess: true,
  })
  mediaId = created.id
  console.log('LOGO uploaded', mediaId, created.url)
}

// Merge into existing branding so siteName/tagline/colors are preserved.
const tenant = await payload.findByID({ collection: 'tenants', id: TENANT, depth: 0, overrideAccess: true })
const branding = { ...((tenant as any).branding || {}), logo: mediaId }
await payload.update({
  collection: 'tenants',
  id: TENANT,
  data: { branding } as any,
  overrideAccess: true,
})
console.log('BRANDING_SET tenant', TENANT, 'logo', mediaId)
process.exit(0)
