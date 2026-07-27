/**
 * Put Kessela's own logo in the header.
 *
 * The header was showing the generic Angel OS mark, which is the one thing that
 * makes a portal read as "someone else's platform" rather than the company's own
 * site. Their logo is fetched deliberately as BRANDING, not as page content —
 * the importer now filters logos out of the body precisely because they were
 * rendering as empty boxes mid-article.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-brand.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const LOGO_URL = 'https://kessela.com/wp-content/uploads/2024/07/Kessela-logo.png'

const payload = await getPayload({ config })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const create = payload.create.bind(payload) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const update = payload.update.bind(payload) as any

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: 'kessela' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenant = tenants.docs?.[0] as { id: number; branding?: Record<string, unknown> } | undefined
if (!tenant) {
  console.error('No kessela tenant.')
  process.exit(1)
}

const filename = 'Kessela-logo.png'
const existing = await payload.find({
  collection: 'media',
  where: { and: [{ tenant: { equals: tenant.id } }, { filename: { equals: filename } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

let logoId = (existing.docs?.[0] as { id: number } | undefined)?.id

if (!logoId) {
  const res = await fetch(LOGO_URL, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) {
    console.error(`Logo fetch failed: HTTP ${res.status}`)
    process.exit(1)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const media = await create({
    collection: 'media',
    data: { alt: 'Kessela', tenant: tenant.id },
    file: { data: buf, mimetype: 'image/png', name: filename, size: buf.length },
    overrideAccess: true,
  })
  logoId = media.id
  console.log(`logo: uploaded → media ${logoId}`)
} else {
  console.log(`logo: reused media ${logoId}`)
}

// Merge, so anything already set is preserved.
//
// defaultTheme 'dark' is the load-bearing part. Their logo is white on
// transparent and their real site has a dark chrome — on our light header the
// logo was present in the DOM and invisible on the page. Switching the tenant
// to dark makes the logo work AND lands much closer to their look than any
// amount of per-element styling would.
await update({
  collection: 'tenants',
  id: tenant.id,
  data: {
    branding: {
      ...(tenant.branding || {}),
      logo: logoId,
      defaultTheme: 'dark',
      primaryColor: '#F0524A', // the coral their CTAs use
    },
  },
  overrideAccess: true,
})

console.log('branding: logo set, theme dark, primary #F0524A')
process.exit(0)
