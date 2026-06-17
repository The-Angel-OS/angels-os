import type { Payload } from 'payload'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
  createUnorderedListNode,
} from '@/utilities/lexicalHelpers'
import { ensurePolicyPages } from '@/utilities/ensurePolicyPages'

/**
 * provisionMarketVendorSite — the generic MARKET-VENDOR / SMALL-RETAIL TEMPLATE.
 *
 * One template for every maker/grower/baker who sells at local markets: a hero, what
 * they make, where to find them (a calendar of recurring market dates), a few guide
 * posts, a product catalog, and an about/contact. They differ in vocabulary, not
 * structure. Stamps standard pages from EXISTING blocks (content/cta/calendar) — zero
 * new tables — plus fleshes out blog posts and ensures a product catalog.
 *
 * This is the SEED that replicate_site clones: pass a different MarketVendorProfile to
 * stand up the next Pinellas market vendor. Hays Cactus Farm is the reference profile
 * (HAYS_PROFILE below).
 *
 * Idempotent: skips a page/post/product whose slug already exists (overwrite replaces
 * page/post layout, keeping the doc id).
 *
 * @see src/utilities/provisionFitnessSite.ts (the sibling template)
 * @see docs/strategy/MARKET_VENDOR_VERTICAL.md
 */

export interface MarketStop {
  /** Display title, e.g. "Coachman Park — Market Marie". */
  title: string
  /** Human-readable cadence, never goes stale: "2nd Saturday monthly · 9am–2pm". */
  cadence: string
  venue?: string
  /** "Clearwater, FL" */
  location?: string
  time?: string
  /** 0=Sun … 6=Sat — used to compute concrete upcoming dates for the calendar. */
  weekday: number
  /** Nth occurrence in the month (1–4). Omit for a WEEKLY market. */
  nth?: number
}

export interface MarketVendorProduct {
  title: string
  slug: string
  description: string[]
  /** Price in whole US dollars (market rate). */
  priceUSD: number
  productionType?: 'ready_made' | 'custom_order'
}

export interface VendorPost {
  title: string
  slug: string
  /** Article body — paragraphs and (optional) "## " / "- " lines for headings/lists. */
  body: string[]
}

export interface MarketVendorProfile {
  vendorName: string
  tagline?: string
  /** One-paragraph origin story for the About page. */
  story?: string
  /** Short bullets of what they make, shown on Home. */
  whatWeMake?: string[]
  markets?: MarketStop[]
  products?: MarketVendorProduct[]
  posts?: VendorPost[]
  /** YouTube channel — every endeavor has one (we help them set it up). */
  youtubeUrl?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
}

/**
 * Next `count` concrete dates matching a market's recurrence, from `from` forward.
 * Weekly (no nth) → the next `count` matching weekdays. Monthly nth → that nth weekday
 * across the coming months. Keeps the interactive calendar populated without a
 * recurrence engine.
 */
export function upcomingMarketDates(stop: MarketStop, from: Date, count = 3): Date[] {
  const out: Date[] = []
  if (stop.nth == null) {
    // Weekly: walk day-by-day collecting matching weekdays.
    const d = new Date(from)
    while (out.length < count) {
      if (d.getDay() === stop.weekday && d >= from) out.push(new Date(d))
      d.setDate(d.getDate() + 1)
    }
    return out
  }
  // Monthly nth-weekday: scan months starting at `from`'s month.
  let y = from.getFullYear()
  let m = from.getMonth()
  while (out.length < count) {
    const first = new Date(y, m, 1)
    const offset = (stop.weekday - first.getDay() + 7) % 7
    const day = 1 + offset + (stop.nth - 1) * 7
    const date = new Date(y, m, day)
    if (date.getMonth() === m && date >= from) out.push(date)
    m += 1
    if (m > 11) { m = 0; y += 1 }
  }
  return out
}

const DEFAULTS: Required<Omit<MarketVendorProfile, 'vendorName'>> = {
  tagline: 'Handmade, local, and worth the trip.',
  story: 'We are a small local maker proud to bring our craft to markets across the Bay area.',
  whatWeMake: ['Handmade goods', 'Made fresh, sold local'],
  markets: [],
  products: [],
  posts: [],
  youtubeUrl: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
}

interface PageSpec {
  slug: string
  title: string
  navOrder: number
  heroHeading: string
  heroSub?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout: any[]
  meta: { title: string; description: string }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const content = (nodes: any[]) => ({ blockType: 'content', columns: [{ size: 'full' as const, richText: createLexicalContent(nodes) }] })
const cta = (heading: string, body: string, links: Array<{ label: string; url: string; appearance?: 'default' | 'outline' }>) => ({
  blockType: 'cta',
  richText: createLexicalContent([createHeadingNode(heading, 'h2'), createParagraphNode(body)]),
  links: links.map((l) => ({ link: { type: 'custom' as const, label: l.label, url: l.url, appearance: l.appearance || 'default' } })),
})

function buildPages(p: Required<MarketVendorProfile>, now: Date): PageSpec[] {
  const name = p.vendorName

  // "Where to Find Us" — recurring schedule as text (never stale) + a populated calendar.
  const scheduleLines = p.markets.map((s) =>
    [s.title, s.cadence, [s.venue, s.location].filter(Boolean).join(', ')].filter(Boolean).join(' — '),
  )
  const calendarEvents = p.markets.flatMap((s) =>
    upcomingMarketDates(s, now, 3).map((d) => ({
      title: s.title,
      date: d.toISOString(),
      time: s.time || '',
      venue: s.venue || '',
      location: s.location || '',
      description: s.cadence,
      featured: false,
    })),
  )

  const guideLinks = p.posts.map((post) => `${post.title} — /posts/${post.slug}`)

  const pages: PageSpec[] = [
    {
      slug: 'home',
      title: 'Home',
      navOrder: 0,
      heroHeading: name,
      heroSub: p.tagline,
      layout: [
        content([
          createParagraphNode(`Welcome to ${name}. ${p.story}`),
          createHeadingNode('What We Make', 'h2'),
          createUnorderedListNode(p.whatWeMake),
        ]),
        cta('Shop & Find Us', 'Browse what we grow, or catch us at a market near you.', [
          { label: 'Shop', url: '/shop' },
          { label: 'Where to Find Us', url: '/find-us', appearance: 'outline' },
        ]),
      ],
      meta: { title: name, description: p.tagline },
    },
    {
      slug: 'find-us',
      title: 'Find Us',
      navOrder: 1,
      heroHeading: 'Where to Find Us',
      heroSub: 'Catch us at these local markets.',
      layout: [
        content([
          createHeadingNode('Our Market Schedule', 'h2'),
          ...(scheduleLines.length
            ? [createUnorderedListNode(scheduleLines)]
            : [createParagraphNode('Market dates are posted here — check back soon.')]),
        ]),
        {
          blockType: 'calendar',
          heading: 'Upcoming Market Dates',
          description: createLexicalContent([createParagraphNode('Come say hi — bring cash or card.')]),
          sourceType: 'manual',
          defaultView: 'list',
          events: calendarEvents,
        },
      ],
      meta: { title: `Find Us — ${name}`, description: 'Our recurring local market schedule.' },
    },
    {
      slug: 'guides',
      title: 'Guides',
      navOrder: 2,
      heroHeading: 'Guides & Tips',
      heroSub: 'Get the most out of what we make.',
      layout: [
        content([
          createParagraphNode('Helpful reads from us to you.'),
          ...(guideLinks.length ? [createUnorderedListNode(guideLinks)] : []),
        ]),
      ],
      meta: { title: `Guides — ${name}`, description: 'Care guides and tips.' },
    },
    {
      slug: 'about',
      title: 'About',
      navOrder: 3,
      heroHeading: 'Our Story',
      heroSub: p.tagline,
      layout: [
        content([
          createParagraphNode(p.story),
          ...(p.youtubeUrl ? [createHeadingNode('Follow Along', 'h3'), createParagraphNode(`Watch and subscribe: ${p.youtubeUrl}`)] : []),
        ]),
      ],
      meta: { title: `About — ${name}`, description: p.story },
    },
    {
      slug: 'contact',
      title: 'Contact',
      navOrder: 4,
      heroHeading: 'Contact Us',
      heroSub: 'We would love to hear from you.',
      layout: [
        content([
          createParagraphNode(`Get in touch with ${name}.`),
          ...(p.address ? [createHeadingNode('Visit Us', 'h3'), createParagraphNode(p.address)] : []),
          ...(p.contactEmail || p.contactPhone
            ? [createHeadingNode('Reach Us', 'h3'), createUnorderedListNode([
                ...(p.contactEmail ? [`Email: ${p.contactEmail}`] : []),
                ...(p.contactPhone ? [`Phone: ${p.contactPhone}`] : []),
              ])]
            : []),
        ]),
      ],
      meta: { title: `Contact — ${name}`, description: `Get in touch with ${name}.` },
    },
  ]

  pages.forEach((pg, i) => { pg.navOrder = i })
  return pages
}

// Build a post's lexical layout from body lines ("## h", "- item", plain paragraph).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPostLayout(body: string[]): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodes: any[] = []
  let listBuf: string[] = []
  const flush = () => { if (listBuf.length) { nodes.push(createUnorderedListNode(listBuf)); listBuf = [] } }
  for (const line of body) {
    if (line.startsWith('## ')) { flush(); nodes.push(createHeadingNode(line.slice(3), 'h2')) }
    else if (line.startsWith('- ')) { listBuf.push(line.slice(2)) }
    else { flush(); nodes.push(createParagraphNode(line)) }
  }
  flush()
  return [
    { blockType: 'content', columns: [{ size: 'full' as const, richText: createLexicalContent(nodes) }] },
    { blockType: 'comments', heading: 'Comments' },
  ]
}

export interface MarketVendorResult {
  pages: { created: string[]; updated: string[]; skipped: string[] }
  posts: { created: string[]; updated: string[]; skipped: string[] }
  products: { created: string[]; skipped: string[] }
}

export async function provisionMarketVendorSite(
  payload: Payload,
  tenantId: number | string,
  profile: MarketVendorProfile,
  opts: { overwrite?: boolean } = {},
): Promise<MarketVendorResult> {
  const p: Required<MarketVendorProfile> = { ...DEFAULTS, vendorName: profile.vendorName, ...stripUndefined(profile) }
  const now = new Date()

  // ── Pages ──────────────────────────────────────────────────
  const pages = { created: [] as string[], updated: [] as string[], skipped: [] as string[] }
  for (const spec of buildPages(p, now)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageData: any = {
      slug: spec.slug,
      title: spec.title,
      _status: 'published',
      tenant: tenantId,
      showInNav: true,
      navOrder: spec.navOrder,
      hero: {
        type: 'lowImpact',
        richText: createLexicalContent([
          createHeadingNode(spec.heroHeading, 'h1'),
          ...(spec.heroSub ? [createParagraphNode(spec.heroSub)] : []),
        ]),
      },
      layout: spec.layout,
      meta: spec.meta,
    }
    const existing = await payload.find({
      collection: 'pages',
      where: { and: [{ slug: { equals: spec.slug } }, { tenant: { equals: tenantId } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    const doc = existing.docs?.[0] as { id: number | string } | undefined
    if (doc) {
      if (!opts.overwrite) { pages.skipped.push(spec.slug); continue }
      await payload.update({ collection: 'pages', id: doc.id, depth: 0, overrideAccess: true, data: pageData })
      pages.updated.push(spec.slug)
    } else {
      await payload.create({ collection: 'pages', depth: 0, overrideAccess: true, data: pageData })
      pages.created.push(spec.slug)
    }
  }

  // ── Blog posts (the fleshed-out guides) ────────────────────
  const posts = { created: [] as string[], updated: [] as string[], skipped: [] as string[] }
  for (const post of p.posts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const postData: any = {
      title: post.title,
      slug: post.slug,
      _status: 'published',
      publishedOn: now.toISOString(),
      hero: { type: 'lowImpact', richText: createLexicalContent([createHeadingNode(post.title, 'h1')]) },
      layout: buildPostLayout(post.body),
      meta: { title: post.title, description: post.body[0]?.slice(0, 160) || post.title },
      tenant: tenantId,
    }
    const existing = await payload.find({
      collection: 'posts',
      where: { and: [{ slug: { equals: post.slug } }, { tenant: { equals: tenantId } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    const doc = existing.docs?.[0] as { id: number | string } | undefined
    if (doc) {
      if (!opts.overwrite) { posts.skipped.push(post.slug); continue }
      await payload.update({ collection: 'posts', id: doc.id, depth: 0, overrideAccess: true, data: postData })
      posts.updated.push(post.slug)
    } else {
      await payload.create({ collection: 'posts', depth: 0, overrideAccess: true, data: postData })
      posts.created.push(post.slug)
    }
  }

  // ── Products (ensure catalog; never overwrites priced inventory) ──
  const products = { created: [] as string[], skipped: [] as string[] }
  for (const prod of p.products) {
    const existing = await payload.find({
      collection: 'products',
      where: { and: [{ slug: { equals: prod.slug } }, { tenant: { equals: tenantId } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (existing.docs?.[0]) { products.skipped.push(prod.slug); continue }
    await payload.create({
      collection: 'products',
      depth: 0,
      overrideAccess: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        title: prod.title,
        slug: prod.slug,
        _status: 'published',
        priceInUSDEnabled: true,
        priceInUSD: Math.round(prod.priceUSD * 100),
        description: createLexicalContent(prod.description.map((d) => createParagraphNode(d))),
        vendor: tenantId,
        productionType: prod.productionType || 'ready_made',
        networkListing: true,
        fulfillmentMode: 'self',
        layout: [],
        gallery: [],
        meta: { title: `${prod.title} | ${p.vendorName}`, description: prod.description[0] },
        tenant: tenantId,
      } as any,
    })
    products.created.push(prod.slug)
  }

  // Retail collects payment + contact consent → standard legal pages.
  await ensurePolicyPages(payload, tenantId, {
    orgName: p.vendorName,
    contactEmail: p.contactEmail || undefined,
    takesPayments: true,
  }, { overwrite: opts.overwrite })

  return { pages, posts, products }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(out as any)[k] = v
  }
  return out
}

/**
 * HAYS_PROFILE — the reference market-vendor profile. Fleshes out the 4 guide articles,
 * dish-garden catalog at market rates, and a Pinellas market schedule. The endpoint
 * applies this by default for the hays-cactus tenant.
 */
export const HAYS_PROFILE: MarketVendorProfile = {
  vendorName: 'Hays Cactus Farm',
  tagline: 'Desert Beauty, Delivered',
  story:
    'Family-owned and growing desert beauty since 1987. From a windowsill succulent to a full xeriscape garden, we propagate over 200 varieties of cacti and succulents in our own greenhouses and bring them straight to you at local markets and online.',
  whatWeMake: [
    'Hand-grown cacti & succulents — 200+ varieties',
    'Ready-to-gift dish gardens at market rates',
    'Custom xeriscape arrangements and consulting',
  ],
  youtubeUrl: '',
  contactEmail: 'margaret@hayscactusfarm.com',
  markets: [
    { title: 'Coachman Park — Market Marie', cadence: '2nd Saturday monthly · 9am–2pm', venue: 'Coachman Park', location: 'Clearwater, FL', time: '9:00 AM', weekday: 6, nth: 2 },
    { title: 'Dunedin Downtown Market', cadence: 'Every Saturday · 9am–1pm', venue: '420 Main St', location: 'Dunedin, FL', time: '9:00 AM', weekday: 6 },
    { title: 'St. Pete Saturday Morning Market', cadence: 'Every Saturday · 9am–2pm', venue: 'Al Lang lot / Williams Park', location: 'St. Petersburg, FL', time: '9:00 AM', weekday: 6 },
  ],
  products: [
    { title: 'Dish Garden — Small (3 plants)', slug: 'dish-garden-small', priceUSD: 25, description: ['A ready-to-gift trio of hand-selected succulents in a small terracotta bowl with drainage layer and decorative top dressing.', 'Market rate — grab one off our table or order online. Low-water, bright-light, nearly impossible to kill.'] },
    { title: 'Dish Garden — Medium (5 plants)', slug: 'dish-garden-medium', priceUSD: 40, description: ['Five complementary succulents and cacti arranged in a ceramic planter. Our most popular market piece.', 'Includes premium cactus soil, drainage, and a care card. Perfect for a kitchen windowsill or a thoughtful gift.'] },
    { title: 'Dish Garden — Large (8 plants)', slug: 'dish-garden-large', priceUSD: 65, description: ['A statement arrangement of eight varieties in a large bowl — height, color, and texture balanced by hand.', 'Built to last for years with minimal care. Great centerpiece or corporate gift.'] },
  ],
  posts: [
    {
      title: 'Welcome to Hays Cactus Farm',
      slug: 'welcome-to-hays-cactus',
      body: [
        'Family-owned since 1987, Hays Cactus Farm grows over 200 varieties of cacti and succulents in our own climate-controlled greenhouses. What started as one greenhouse and a love of the desert is now a full working farm — and a regular table at markets across the Bay area.',
        '## Grown, not just sold',
        'Most of what you see at our table we propagated ourselves, from seed or cutting. That means healthier, better-rooted plants that travel well and settle into your home fast.',
        '## Come say hi',
        'We bring dish gardens, single specimens, and our custom-arrangement station to local markets every week. Bring a question about that plant on your windowsill — we love talking shop.',
        '- Hand-grown, 200+ varieties',
        '- Dish gardens at market rates',
        '- Custom arrangements while you wait',
      ],
    },
    {
      title: 'Beginner Guide to Cactus Care',
      slug: 'beginner-cactus-care',
      body: [
        'The number one way to kill a cactus is kindness — specifically, too much water. Here is everything a first-time plant parent needs to keep a prickly friend thriving.',
        '## Watering',
        'Soak thoroughly, then let the soil dry out completely before watering again. In summer that might be every 1–2 weeks; in winter, once a month or less. When in doubt, wait.',
        '## Light',
        'Most desert cacti want bright, direct light — a south- or west-facing window is ideal. Succulents are a little more forgiving but still want bright, indirect light to keep their color.',
        '## Soil & pots',
        'Use a fast-draining cactus mix and a pot with a drainage hole. Standard potting soil holds too much water and is the second most common killer after overwatering.',
        '- Let soil dry fully between waterings',
        '- Bright light, ideally direct',
        '- Fast-draining mix + a drainage hole',
      ],
    },
    {
      title: 'Seasonal Cactus Blooms Calendar',
      slug: 'seasonal-blooms',
      body: [
        'Yes — cacti bloom, and the flowers are spectacular. Knowing when each type flowers (and how to encourage it) turns a windowsill collection into a year-round show.',
        '## Spring',
        'Many barrel and pincushion cacti flower in spring as days lengthen. A cool, dry winter rest is the single biggest trigger for a strong spring bloom.',
        '## Summer',
        'Echinopsis and many night-blooming cereus put on dramatic, often fragrant summer displays — sometimes for just one night, so watch the buds closely.',
        '## Fall & winter',
        'Holiday cacti (Schlumbergera) bloom on shortening days and cool nights — give them 12–14 hours of darkness in fall to set buds for the holidays.',
        '- Cool, dry winter rest → spring blooms',
        '- Night-bloomers peak in summer',
        '- Long fall nights set holiday-cactus buds',
      ],
    },
    {
      title: 'Shipping Live Plants Safely',
      slug: 'shipping-live-plants',
      body: [
        'Cant make it to a market? We ship. Here is how we get a living plant to your door healthy and happy.',
        '## Bare-root and snug',
        'For most cacti we ship bare-root — the plant out of its pot, roots wrapped, body cushioned. It travels lighter, safer, and with far less risk of root rot in transit.',
        '## Seasonal heat & cold packs',
        'Plants are tropical-desert natives and hate temperature extremes. We add heat packs in winter and ship early-week in summer to avoid weekend warehouse heat.',
        '## When it arrives',
        'Unbox right away, let the plant rest a day, then pot it in fast-draining mix and wait a few days before the first light watering. A little travel stress is normal — it bounces back fast.',
        '- Bare-root packing for safe transit',
        '- Seasonal heat/cold packs included',
        '- Rest, repot, then water lightly',
      ],
    },
  ],
}
