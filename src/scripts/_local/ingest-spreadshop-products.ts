import { getPayload } from 'payload'
import config from '@payload-config'
import fs from 'fs'
import path from 'path'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
  createRichParagraphNode,
  createLinkNode,
  createTextNode,
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

async function ensureMediaFromUrl(
  rawUrl: string,
  filename: string,
  alt: string,
  mimetype = 'image/jpeg',
) {
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
        Referer: 'https://my-lunch-break.myspreadshop.com/',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await (payload.create as any)({
      collection: 'media',
      data: { alt, tenant: tenantId },
      file: { data: buf, mimetype, name: filename, size: buf.length },
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

  // 1. Front View (main product image)
  const legacyFilename = `mlb-merch-${slug.slice(0, 30)}.jpg`
  const frontId = await ensureMediaFromUrl(item.imageUrl, legacyFilename, `${item.title} - Front View`)

  // 2. Back View
  const backUrl = item.imageUrl.replace('/views/1', '/views/2')
  const backFilename = `mlb-merch-${slug.slice(0, 30)}-back.jpg`
  const backId = await ensureMediaFromUrl(backUrl, backFilename, `${item.title} - Back View`)

  // 3. Composition / Graphic Zoom View
  const compUrl = item.imageUrl.replace('/products/', '/compositions/')
  const compFilename = `mlb-merch-${slug.slice(0, 30)}-zoom.jpg`
  const compId = await ensureMediaFromUrl(compUrl, compFilename, `${item.title} - Graphic Zoom`)

  // 4. Source Artwork Graphic (transparent PNG)
  const designMatch = item.imageUrl.match(/D(\d+)/)
  const designId = designMatch ? designMatch[1] : null
  let designGraphicId: number | null = null
  if (designId) {
    const designUrl = `https://image.spreadshirtmedia.com/image-server/v1/designs/${designId},width=800,height=800/graphic.png`
    const designFilename = `mlb-artwork-design-${designId}.png`
    designGraphicId = await ensureMediaFromUrl(
      designUrl,
      designFilename,
      `${item.title} - Source Artwork Graphic`,
      'image/png',
    )
  }

  const galleryIds = [frontId, backId, compId, designGraphicId].filter(
    (id): id is number => typeof id === 'number',
  )

  const descriptionRichText = createLexicalContent([
    createHeadingNode(item.title, 'h2'),
    createParagraphNode(
      `Official My Lunch Break Merchandise. High quality ${item.category} featuring original Old World and Tartarian investigative channel emblems.`,
    ),
    createRichParagraphNode([
      createTextNode(`Price: ${item.price} · `),
      createLinkNode(item.productUrl, 'Order Direct on Spreadshop →', true),
    ]),
    createRichParagraphNode([
      createTextNode('⚡ Want your own creator merchandise hub? '),
      createLinkNode('https://spacesangels.com', 'Open your free Angel OS Shop Now →', true),
    ]),
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
    gallery: galleryIds.map((id) => ({ image: id })),
    meta: {
      title: `${item.title} | My Lunch Break Merch`,
      description: `Official My Lunch Break apparel and accessories. ${item.category} priced at ${item.price}.`,
      image: frontId || undefined,
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
