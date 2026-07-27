/**
 * Move Kessela's 8 study articles from Pages onto the Posts engine.
 *
 * They arrived as Pages because their source paths are page-shaped
 * (`/hydration-101-extremely-important-for-pbm/`). Their WordPress site never
 * had a blog engine; ours does — and a blog is the shape that sells a $599
 * medical device, because a study is dated, listed, related and syndicable in a
 * way a flat page never is.
 *
 * Run AFTER:
 *   pnpm payload run src/scripts/_local/import-site.ts -- \
 *     --tenant=kessela --base=https://kessela.com --collection=posts --paths=<the 8>
 *
 * Run: pnpm payload run src/scripts/_local/kessela-studies.ts
 *
 * Idempotent. `payload run` will not await a floating main() — top-level await.
 * @see docs/FOOTGUNS.md
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const SLUGS = [
  'kessela-advanced-pbm-red-light-nir-ems-belt-your-first-two-weeks',
  'what-advanced-science-studies-from-harvard-stanford-published-medical-journals-say-about-red-light-therapy',
  'science-research-on-the-ability-of-red-light-therapy-to-improve-the-appearance-of-cellulite-yes-it-works',
  'hydration-101-extremely-important-for-pbm',
  'efficacy-of-low-level-laser-therapy-for-body-contouring-and-spot-fat-reduction',
  'medical-studies-prove-pbm-can-help-eliminate-fat',
  'led-light-therapy-clinically-proven-to-reduce-waist-hip-and-thigh-circumference',
  'studies-show-additional-weight-loss-benefits-with-red-light-therapy',
]

const payload = await getPayload({ config })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const update = payload.update.bind(payload) as any

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: 'kessela' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) {
  console.error('No kessela tenant.')
  process.exit(1)
}

const findOne = async (collection: 'pages' | 'posts', slug: string) => {
  const res = await payload.find({
    collection,
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs?.[0] as { id: number; _status?: string } | undefined
}

for (const slug of SLUGS) {
  const post = await findOne('posts', slug)
  if (!post) {
    console.log(`  MISSING post /${slug} — re-run import-site.ts --collection=posts`)
    continue
  }

  // publishedOn fills itself from the Posts beforeChange hook on first publish.
  if (post._status !== 'published') {
    await update({ collection: 'posts', id: post.id, data: { _status: 'published' }, overrideAccess: true })
    console.log(`  published post /${slug}`)
  }

  // ponytail: the duplicate Page is UNPUBLISHED, not deleted. A draft 404s on
  // the public route, which is the whole point, and it costs nothing to keep the
  // original around while David is still being shown the site. Delete them once
  // the posts have been live for a while.
  const page = await findOne('pages', slug)
  if (page && page._status === 'published') {
    await update({ collection: 'pages', id: page.id, data: { _status: 'draft' }, overrideAccess: true })
    console.log(`  retired page /${slug} (draft)`)
  }
}

console.log('\nStudies live at /posts. Re-run kessela-nav.ts to point "Studies" there.')
process.exit(0)
