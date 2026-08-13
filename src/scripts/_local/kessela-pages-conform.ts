/**
 * Conform /how-to-use-belt and /results-testimonials — the two pages after home
 * with the most flattening.
 *
 * Both are the same story as the homepage: the words came across from WordPress,
 * the structure didn't. Specifically:
 *
 *   how-to-use-belt  — the video sat at the BOTTOM of a page whose first line is
 *                      "watch our video", the trust badges appeared TWICE (once as
 *                      three bare text blocks, once as the real trustRow), and the
 *                      closing offer was a heading and a paragraph rather than a cta.
 *   results-testimonials — six loose mediaBlocks interleaved with the copy they
 *                      belong to, and every section heading living in its own
 *                      content block above the body it heads.
 *
 * Copy is carried over verbatim, disclaimer included. Nothing here invents a claim.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-pages-conform.ts
 * Idempotent — rebuilds both layouts from the definitions below every run.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { updatePageLayout, type LayoutBlock } from './_updatePageLayout'
import { h, p, rich, column } from './_lexical'

const HOW_TO_VIDEO = 450 // kessela-ht2.mp4
const PHOTO = { oneWeek: 441, science: 442, ems: 440 }

const payload = await getPayload({ config })

const tenants = await payload.find({
  collection: 'tenants', where: { slug: { equals: 'kessela' } }, limit: 1, depth: 0, overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) throw new Error('No kessela tenant.')

type PageDoc = { id: number; _status?: string | null; layout?: LayoutBlock[] }

const load = async (slug: string): Promise<PageDoc> => {
  const res = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  const doc = res.docs?.[0] as unknown as PageDoc | undefined
  if (!doc) throw new Error(`No page /${slug}`)
  return doc
}

/** Carry a block over unchanged — we're moving it, not rewriting it. */
const keeper = (layout: LayoutBlock[]) => (blockType: string, contains?: string): LayoutBlock | null => {
  const hit = layout.find((b) => {
    if ((b as { blockType?: string }).blockType !== blockType) return false
    return contains ? JSON.stringify(b).includes(contains) : true
  })
  return hit ? ({ ...hit, id: undefined } as LayoutBlock) : null
}

/** A content column that is also a link — the "click to read" teaser card. */
const linkedColumn = (size: 'half' | 'full', children: unknown[], label: string, url: string) => ({
  ...column(size, children),
  enableLink: true,
  link: { type: 'custom', url, label, appearance: 'default', newTab: false },
})

const cta = (heading: string, body: string, label: string, url: string): LayoutBlock => ({
  blockType: 'cta',
  blockName: label,
  richText: rich([h('h2', heading), p(body)]),
  links: [{ link: { type: 'custom', label, url, appearance: 'default', newTab: false } }],
})

// ── /how-to-use-belt ───────────────────────────────────────────────────────
{
  const page = await load('how-to-use-belt')
  const existing = page.layout ?? []
  const keep = keeper(existing)

  const intro = keep('content', 'Watch our video and follow')
  const watchCopy = keep('content', 'Watch the Video')
  // Was the LAST block on the page. A page that opens "watch our video" and makes
  // you scroll past nine sections to reach it is the flattening in one artefact.
  const video = keep('mediaText') ?? {
    blockType: 'mediaText', eyebrow: 'Watch', heading: 'How to Use the Belt',
    body: 'A real player: it waits for you to press play.', media: HOW_TO_VIDEO,
    aspect: '16/9', caption: 'Kessela how-to', videoOnRight: true,
    ctaLabel: 'Buy Now', ctaUrl: '/buy-kessela-now',
  }

  // Two "PBM Tips" teasers, each previously a heading block plus a body block,
  // both ending in "click" with nothing to click. They point at the blog now.
  const tips: LayoutBlock = {
    blockType: 'content',
    blockName: 'PBM Tips',
    columns: [
      column('full', [h('h2', 'PBM Tips')]),
      linkedColumn('half', [
        h('h3', 'Hydration 101'),
        p('We’re spilling the secret sauce on hydration and how it can supercharge your results with the Kessela Red Light Belt!'),
        p('Click to uncover our exclusive hydration tips that are key to maximizing your fat loss and muscle toning. Learn how staying properly hydrated can elevate your workout effectiveness and overall wellness.'),
      ], 'Read the hydration tips', '/studies-blog'),
      linkedColumn('half', [
        h('h3', 'Diet hacks'),
        p('We’ve got the ultimate secret to turbocharging your results with the Kessela Red Light Belt! Click to access our exclusive diet tips that are designed to amplify your fat loss and muscle toning efforts.'),
        p('Discover how simple changes in your diet can make a massive difference in your journey to better abs.'),
      ], 'Read the diet hacks', '/studies-blog'),
    ],
  }

  const trust = keep('trustRow')

  const layout = [
    intro, watchCopy, video, tips,
    cta(
      'Lighten Your Workout Load, Electrify Your Results!',
      'Start your journey to a better you! Our products come with a full one year warranty. We’ll replace it if any issues arise from product defects.',
      'Buy Kessela Now!',
      '/buy-kessela-now',
    ),
    trust,
  ].filter(Boolean) as LayoutBlock[]

  await updatePageLayout(payload, page, layout)
  console.log(`how-to-use-belt: ${existing.length} → ${layout.length}`)
  console.log('  ' + layout.map((b) => (b as { blockType: string }).blockType).join(' · '))
}

// ── /results-testimonials ──────────────────────────────────────────────────
{
  const page = await load('results-testimonials')
  const existing = page.layout ?? []
  const keep = keeper(existing)

  const intro = keep('content', 'Check out our results')
  // Already two columns of customer quotes — the one block on the page that was
  // doing its job.
  const wall = keep('content', 'Real stories, real people')
  const trust = keep('trustRow')

  const section = (
    eyebrow: string,
    heading: string,
    body: string[],
    media: number,
    mediaRight: boolean,
  ): LayoutBlock => ({
    blockType: 'mediaText',
    blockName: eyebrow,
    eyebrow,
    heading,
    body: body.join('\n\n'),
    media,
    aspect: '4/3',
    videoOnRight: mediaRight,
  })

  const layout = [
    intro,
    section(
      'Journey of One Week',
      'When applied consistently and managing, it just works wonders.',
      [
        '“I can’t believe the difference I’ve seen in just one week! After using the Kessela red light belt, I already feel more toned and energized. I see much more definition and my abs feel stronger! Thank you, Kessela, for this amazing product!”',
        'See more before & after pictures and testimonials below. All Results Represents 2 Weeks to the Day!',
        'Disclaimer: Results may vary based on individual factors, including environment, diet, and other conditions beyond our control.',
      ],
      PHOTO.oneWeek,
      true,
    ),
    section(
      'Scientifically proven',
      'To burn fat',
      [
        'Red light therapy has been extensively studied and proven by medical research to effectively trim fat.',
        'Clinical trials have shown that red light therapy can reduce the size of adipocytes (fat cells) by triggering the release of triglycerides, leading to a decrease in overall fat volume.',
        'Studies have demonstrated measurable fat loss and improved body contouring in participants using red light therapy. This non-invasive method provides a safe and scientifically backed alternative to traditional fat reduction techniques.',
      ],
      PHOTO.science,
      false,
    ),
    section(
      'Stimulate muscles',
      'Target your abs',
      [
        'Electro Muscle Stimulation (EMS) is an effective method for trimming abs by delivering electrical pulses that contract and stimulate the abdominal muscles.',
        'This process replicates the effects of traditional abdominal workouts, targeting all major muscle groups, including the transversus and rectus abdominis, as well as the internal and external obliques.',
        'EMS helps build muscle mass, enhance muscle tone, and improve overall abdominal strength. By cycling through different workout modes, EMS ensures a comprehensive and efficient abdominal workout, contributing to a slimmer and more defined waistline.',
      ],
      PHOTO.ems,
      true,
    ),
    cta(
      'Get paid to share your story',
      'We want to hear your success story! Share your journey with us, and we’ll reward you with a $150 credit towards your next purchase. It’s our way of saying thank you for trusting us and celebrating your progress.',
      'Share your story',
      '/contact',
    ),
    wall,
    cta(
      'Lighten Your Workout Load, Electrify Your Results!',
      'Start your journey to a better you! Our products come with a full one year warranty.',
      'Buy Kessela Now!',
      '/buy-kessela-now',
    ),
    trust,
  ].filter(Boolean) as LayoutBlock[]

  await updatePageLayout(payload, page, layout)
  console.log(`results-testimonials: ${existing.length} → ${layout.length}`)
  console.log('  ' + layout.map((b) => (b as { blockType: string }).blockType).join(' · '))
}
