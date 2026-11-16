import { getPayload } from 'payload'
import config from '@payload-config'
import fs from 'fs'
import path from 'path'

const payload = await getPayload({ config })
const tenantSlug = 'mlb'

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: tenantSlug } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenant = tenants.docs?.[0] as { id: number; branding?: Record<string, unknown> } | undefined
if (!tenant) {
  console.error('No mlb tenant found.')
  process.exit(1)
}

const faviconPath = 'C:/Users/kenne/.gemini/antigravity/brain/4b1137a9-10ed-46c9-bc25-8b056f28966b/scratch/mlb-data/mlb-favicon.png'
const logoPath = 'C:/Users/kenne/.gemini/antigravity/brain/4b1137a9-10ed-46c9-bc25-8b056f28966b/scratch/mlb-data/mlb-logo.png'

async function uploadMedia(filePath: string, filename: string, mimetype: string, alt: string) {
  const buf = fs.readFileSync(filePath)
  const existing = await payload.find({
    collection: 'media',
    where: { and: [{ tenant: { equals: tenant!.id } }, { filename: { equals: filename } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs?.[0]) {
    console.log(`Reused media #${existing.docs[0].id} for ${filename}`)
    return existing.docs[0].id as number
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await (payload.create as any)({
    collection: 'media',
    data: { alt, tenant: tenant!.id },
    file: { data: buf, mimetype, name: filename, size: buf.length },
    overrideAccess: true,
  })
  console.log(`Uploaded media #${doc.id} for ${filename}`)
  return doc.id as number
}

const faviconId = await uploadMedia(faviconPath, 'mlb-favicon-180.png', 'image/png', 'My Lunch Break Favicon')
const logoId = await uploadMedia(logoPath, 'mlb-official-logo.png', 'image/png', 'My Lunch Break Official Logo')

await payload.update({
  collection: 'tenants',
  id: tenant.id,
  data: {
    branding: {
      ...(tenant.branding || {}),
      siteName: 'My Lunch Break',
      tagline: 'Old World Architecture, Satan’s Little Season & Global Investigation Archive',
      primaryColor: '#D4AF37',
      secondaryColor: '#38BDF8',
      defaultTheme: 'dark',
      favicon: faviconId,
      logo: logoId,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  overrideAccess: true,
})

console.log('Successfully set MLB tenant favicon and logo!')
process.exit(0)
