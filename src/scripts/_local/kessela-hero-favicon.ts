/**
 * Apply Kessela's own hero background and favicon.
 *
 * The hero had been running their product VIDEO, which is fine but busy behind
 * copy. Ken pulled their actual hero still, which is what their own page uses —
 * so the split-panel gradient sits over the same image they designed it for.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-hero-favicon.ts
 *      [-- --hero=<path>]
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { readFileSync, existsSync } from 'fs'
import { basename } from 'path'

const arg = (name: string, fallback = ''): string => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const HERO = arg('hero', 'C:/Users/kenne/Downloads/kessela-hero-3-new.jpg')
const FAVICON_URL = 'https://kessela.com/wp-content/uploads/2024/07/favi.png'

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

/** Upload once, reuse thereafter — keyed on filename within the tenant. */
async function ensureMedia(name: string, buf: Buffer, mimetype: string, alt: string) {
  const existing = await payload.find({
    collection: 'media',
    where: { and: [{ tenant: { equals: tenant!.id } }, { filename: { equals: name } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const hit = (existing.docs?.[0] as { id: number } | undefined)?.id
  if (hit) {
    console.log(`${name}: reused media ${hit}`)
    return hit
  }
  const doc = await create({
    collection: 'media',
    data: { alt, tenant: tenant!.id },
    file: { data: buf, mimetype, name, size: buf.length },
    overrideAccess: true,
  })
  console.log(`${name}: uploaded → media ${doc.id}`)
  return doc.id as number
}

// ── Hero background ─────────────────────────────────────────────────────────
if (!existsSync(HERO)) {
  console.error(`Hero not found at ${HERO}`)
  process.exit(1)
}
const heroId = await ensureMedia(
  basename(HERO),
  readFileSync(HERO),
  'image/jpeg',
  'Kessela Elite Core Contouring Belt',
)

const home = await payload.find({
  collection: 'pages',
  where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: 'home' } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const homeDoc = home.docs?.[0] as unknown as { id: number; hero?: Record<string, unknown> } | undefined

if (homeDoc) {
  await update({
    collection: 'pages',
    id: homeDoc.id,
    // Merge, so the headline, squiggle and CTAs already on the hero survive —
    // only the background changes.
    data: { hero: { ...(homeDoc.hero || {}), type: 'splitPanel', media: heroId } },
    overrideAccess: true,
  })
  console.log('home: hero background set')
}

// ── Favicon ─────────────────────────────────────────────────────────────────
try {
  const res = await fetch(FAVICON_URL, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const faviconId = await ensureMedia('kessela-favicon.png', buf, 'image/png', 'Kessela')

  await update({
    collection: 'tenants',
    id: tenant.id,
    data: { branding: { ...(tenant.branding || {}), favicon: faviconId } },
    overrideAccess: true,
  })
  console.log('branding: favicon set')
} catch (err) {
  console.error(`favicon: FAILED — ${err instanceof Error ? err.message : String(err)}`)
}

console.log('\nDone. Restart core to clear the cached tenant/header.')
process.exit(0)
