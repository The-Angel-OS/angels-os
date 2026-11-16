import { getPayload } from 'payload'
import config from '@payload-config'
import fs from 'fs'
import path from 'path'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'

const payload = await getPayload({ config })
const tenantSlug = 'mlb'

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: tenantSlug } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenant = tenants.docs?.[0] as { id: number } | undefined
if (!tenant) {
  console.error('No mlb tenant found.')
  process.exit(1)
}
const tenantId = tenant.id

const productsPath = path.resolve(process.cwd(), 'src/data/spreadshop-products.json')
const rawProducts = JSON.parse(fs.readFileSync(productsPath, 'utf8')) as Array<{
  title: string
  category: string
  price: string
  productUrl: string
  imageUrl: string
}>

console.log(`Ingesting ${rawProducts.length} Spreadshop products for tenant #${tenantId}...`)

// Cache media uploads by URL
const mediaCache = new Map<string, number>()

async function ensureMediaFromUrl(rawUrl: string, filename: string, alt: string) {
  const url = rawUrl.replace('width=1200,height=1200', 'width=500,height=500')
  if (mediaCache.has(url)) return mediaCache.get(url)!

  // Check if media already exists by filename
  const existing = await payload.find({
    collection: 'media',
    where: { and: [{ tenant: { equals: tenantId } }, { filename: { equals: filename } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs?.[0]) {
    mediaCache.set(url, existing.docs[0].id as number)
    return existing.docs[0].id as number
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await (payload.create as any)({
      collection: 'media',
      data: { alt, tenant: tenantId },
      file: { data: buf, mimetype: 'image/jpeg', name: filename, size: buf.length },
      overrideAccess: true,
    })
    mediaCache.set(url, doc.id as number)
    return doc.id as number
  } catch (err) {
    console.warn(`Failed to upload media for ${filename}:`, (err as Error).message)
    return null
  }
}

let count = 0
for (const item of rawProducts) {
  count++
  const slug = item.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  const numPrice = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 24.99
  const centsPrice = Math.round(numPrice * 100)

  // Upload or reuse product image
  const imgFilename = `mlb-merch-${slug.slice(0, 30)}.jpg`
  const mediaId = await ensureMediaFromUrl(item.imageUrl, imgFilename, item.title)

  const descriptionRichText = createLexicalContent([
    createHeadingNode(item.title, 'h2'),
    createParagraphNode(
      `Official My Lunch Break Merchandise. High quality ${item.category} featuring original Old World and Tartarian investigative channel emblems.`,
    ),
    createParagraphNode(
      `Available on Spreadshop: ${item.price}. Direct order link: ${item.productUrl}`,
    ),
  ])

  const existingProd = await payload.find({
    collection: 'products',
    where: { and: [{ slug: { equals: slug } }, { tenant: { equals: tenantId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const prodData = {
    title: item.title,
    slug,
    _status: 'published',
    tenant: tenantId,
    priceInUSD: centsPrice,
    priceInUSDEnabled: true,
    inventory: 999,
    description: descriptionRichText,
    gallery: mediaId ? [{ image: mediaId }] : [],
    meta: {
      title: `${item.title} | My Lunch Break Merch`,
      description: `Official My Lunch Break apparel and accessories. ${item.category} priced at ${item.price}.`,
      image: mediaId || undefined,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any

  if (existingProd.docs[0]) {
    await payload.update({
      collection: 'products',
      id: existingProd.docs[0].id,
      data: prodData,
      depth: 0,
      overrideAccess: true,
    })
    console.log(`[${count}/${rawProducts.length}] Updated product: ${item.title} ($${numPrice})`)
  } else {
    await payload.create({
      collection: 'products',
      data: prodData,
      depth: 0,
      overrideAccess: true,
    })
    console.log(`[${count}/${rawProducts.length}] Created product: ${item.title} ($${numPrice})`)
  }
}

console.log(`\nSuccessfully ingested all ${rawProducts.length} Spreadshop products for MLB!`)
process.exit(0)
