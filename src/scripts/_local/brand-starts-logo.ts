/**
 * One-off: generate + upload the Start-S wordmark SVG and set it as tenant 24's
 * branding.logo. Red badge "S" + wrench, wordmark, trade subtitle. Idempotent.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const TENANT = 24
const FILENAME = 'start-s-logo.svg'

// ponytail: hand-built SVG wordmark — no image-gen dependency, crisp at any size
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 96" width="460" height="96">
  <rect x="4" y="8" width="80" height="80" rx="16" fill="#B91C1C"/>
  <text x="44" y="66" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="52" font-weight="900" fill="#FFFFFF">S</text>
  <!-- wrench accent -->
  <g transform="translate(60,16) rotate(45 8 8)">
    <path d="M8 0a6 6 0 0 0-5.6 8.2L0 10.6V16h5.4l2.4-2.4A6 6 0 1 0 8 0zm0 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" fill="#FCA5A5"/>
  </g>
  <text x="100" y="52" font-family="Arial Black, Arial, sans-serif" font-size="40" font-weight="900" fill="#B91C1C" letter-spacing="2">START-S</text>
  <text x="102" y="78" font-family="Arial, sans-serif" font-size="17" font-weight="600" fill="#6B7280" letter-spacing="4">MOBILE AUTO MECHANIC</text>
</svg>`

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
  const buf = Buffer.from(SVG, 'utf8')
  const created = await (payload.create as any)({
    collection: 'media',
    data: { alt: 'Start-S Mobile Auto Mechanic', tenant: TENANT },
    file: { data: buf, mimetype: 'image/svg+xml', name: FILENAME, size: buf.length },
    overrideAccess: true,
  })
  mediaId = created.id
  console.log('LOGO uploaded', mediaId, created.url)
}

const tenant = await payload.findByID({ collection: 'tenants', id: TENANT, depth: 0, overrideAccess: true })
const branding = { ...((tenant as any).branding || {}), logo: mediaId }
await payload.update({ collection: 'tenants', id: TENANT, data: { branding } as any, overrideAccess: true })
console.log('BRANDING_SET tenant', TENANT, 'logo', mediaId)
process.exit(0)
