import type { Payload } from 'payload'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
  createUnorderedListNode,
} from '@/utilities/lexicalHelpers'
import { upsertMembershipPlan, type MembershipPlan } from '@/utilities/membershipPlans'

/**
 * provisionChurchSite — the prototype CHURCH TEMPLATE.
 *
 * Stamps the standard set of parish pages (Home, Worship & Service Times, Sermons &
 * Livestream, Events, Giving, About & Clergy, Ministries, Contact, Prayer Requests)
 * onto a tenant, assembled entirely from EXISTING blocks (content/cta/calendar/
 * donation) — so it ships a complete church website with ZERO new block tables and
 * zero schema-rollout risk. Purpose-built upgrades (clergy-roster, video-embed and
 * bulletins blocks, recurring services, designated giving) layer on later.
 *
 * Idempotent: skips a page whose slug already exists for the tenant. Data-driven —
 * pass a ChurchProfile to fit any parish (defaults render a generic, complete site).
 *
 * @see src/utilities/createDefaultTenantPages.ts (the page+block authoring shape)
 * @see docs/planning/CHURCH_WEBSITE_GAP_ANALYSIS.md
 */

export interface ClergyMember {
  name: string
  role: string
}

export interface ServiceTime {
  /** e.g. "Sunday" */
  day: string
  /** e.g. "8:00 AM — Holy Eucharist Rite I" */
  service: string
}

export interface ChurchProfile {
  churchName: string
  tagline?: string
  /** Tradition line shown on About, e.g. "An Episcopal parish in the Diocese of …". */
  tradition?: string
  /** Public livestream URL (YouTube channel/stream) — linked from Worship/Sermons. */
  livestreamUrl?: string
  serviceTimes?: ServiceTime[]
  clergy?: ClergyMember[]
  ministries?: string[]
  /** Name of the giving fund shown on the Giving page. */
  givingFundName?: string
  contactEmail?: string
  contactPhone?: string
  /** Physical address, shown on Contact + footer. */
  address?: string
  /**
   * Optional recurring membership/pledge plans. When provided, a "Membership" page
   * with the Join block is stamped and the plans are written to the membership-plans
   * settings bag. Most parishes use one-time Giving instead — leave empty for that.
   */
  membershipPlans?: MembershipPlan[]
}

const DEFAULTS: Required<Omit<ChurchProfile, 'churchName'>> = {
  tagline: 'A community of faith, hope, and welcome.',
  tradition: 'A Christian congregation in the Angel OS federation.',
  livestreamUrl: '',
  serviceTimes: [
    { day: 'Sunday', service: '8:00 AM — Holy Eucharist, Rite I' },
    { day: 'Sunday', service: '10:00 AM — Holy Eucharist, Rite II (with Choir)' },
    { day: 'Wednesday', service: '7:00 PM — Evening Prayer' },
  ],
  clergy: [],
  ministries: [
    'Worship & Music',
    'Outreach & Service',
    'Christian Formation',
    'Fellowship',
    'Pastoral Care',
  ],
  givingFundName: 'General Offering',
  contactEmail: '',
  contactPhone: '',
  address: '',
  membershipPlans: [],
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

function buildPages(p: Required<ChurchProfile>): PageSpec[] {
  const name = p.churchName
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = (nodes: any[]) => ({ blockType: 'content', columns: [{ size: 'full' as const, richText: createLexicalContent(nodes) }] })
  const cta = (heading: string, body: string, links: Array<{ label: string; url: string; appearance?: 'default' | 'outline' }>) => ({
    blockType: 'cta',
    richText: createLexicalContent([createHeadingNode(heading, 'h2'), createParagraphNode(body)]),
    links: links.map((l) => ({ link: { type: 'custom' as const, label: l.label, url: l.url, appearance: l.appearance || 'default' } })),
  })

  const serviceLines = p.serviceTimes.map((s) => `${s.day}: ${s.service}`)
  const clergyLines = p.clergy.length
    ? p.clergy.map((c) => `${c.name} — ${c.role}`)
    : ['Clergy and staff listing coming soon.']

  // Optional Membership page — only when the parish offers recurring plans/pledges.
  const membershipPage: PageSpec | null = p.membershipPlans.length
    ? {
        slug: 'membership',
        title: 'Membership',
        navOrder: 0, // reassigned below by final position
        heroHeading: 'Become a Member',
        heroSub: 'Make your commitment to our community.',
        layout: [
          content([
            createParagraphNode(`Join the life of ${name} with a recurring membership or pledge. Your ongoing support sustains our worship, ministries, and care for one another.`),
          ]),
          {
            blockType: 'membership',
            richText: createLexicalContent([
              createHeadingNode('Choose your membership', 'h2'),
              createParagraphNode('Select a plan below to get started.'),
            ]),
            ctaText: 'Become a member',
          },
        ],
        meta: { title: `Membership — ${name}`, description: `Become a member of ${name}.` },
      }
    : null

  const pages: PageSpec[] = [
    {
      slug: 'home',
      title: 'Home',
      navOrder: 0,
      heroHeading: name,
      heroSub: p.tagline,
      layout: [
        content([
          createParagraphNode(`Welcome to ${name}. ${p.tagline} Whether you are visiting for the first time or have worshipped here for years, there is a place for you at our table.`),
          createHeadingNode('Service Times', 'h2'),
          createUnorderedListNode(serviceLines),
        ]),
        cta('Plan Your Visit', 'We would love to welcome you in person — here is everything you need for your first Sunday.', [
          { label: 'Worship & Service Times', url: '/worship' },
          { label: 'Give', url: '/giving', appearance: 'outline' },
        ]),
      ],
      meta: { title: `${name}`, description: p.tagline },
    },
    {
      slug: 'worship',
      title: 'Worship',
      navOrder: 1,
      heroHeading: 'Worship & Service Times',
      heroSub: 'Come and pray with us.',
      layout: [
        content([
          createHeadingNode('Service Times', 'h2'),
          createUnorderedListNode(serviceLines),
          createHeadingNode('What to Expect', 'h2'),
          createParagraphNode('Come as you are. Our liturgy is grounded in word, song, and sacrament; ushers will help you find your way, and all are welcome at the Lord’s Table.'),
          ...(p.livestreamUrl ? [createHeadingNode('Worship With Us Online', 'h2'), createParagraphNode(`Can’t join in person? Our services are streamed live: ${p.livestreamUrl}`)] : []),
        ]),
        ...(p.livestreamUrl ? [cta('Watch the Livestream', 'Join our worshipping community from wherever you are.', [{ label: 'Watch Live', url: p.livestreamUrl }])] : []),
      ],
      meta: { title: `Worship — ${name}`, description: 'Service times and what to expect.' },
    },
    {
      slug: 'sermons',
      title: 'Sermons',
      navOrder: 2,
      heroHeading: 'Sermons & Reflections',
      heroSub: 'The Word, preached and shared.',
      layout: [
        content([
          createParagraphNode('Catch up on recent sermons and reflections from our clergy. New messages are posted after each Sunday service.'),
        ]),
        cta('Browse Sermons', 'Read and watch past messages.', [
          { label: 'View Posts', url: '/posts' },
          ...(p.livestreamUrl ? [{ label: 'Watch on Stream', url: p.livestreamUrl, appearance: 'outline' as const }] : []),
        ]),
      ],
      meta: { title: `Sermons — ${name}`, description: 'Sermons and reflections.' },
    },
    {
      slug: 'events',
      title: 'Events',
      navOrder: 3,
      heroHeading: 'Parish Events',
      heroSub: 'Gather, serve, celebrate.',
      layout: [
        content([
          createParagraphNode('Services, formation, fellowship, and outreach — all in one place. Check back for our upcoming gatherings.'),
        ]),
        {
          blockType: 'calendar',
          heading: 'Upcoming Events',
          description: createLexicalContent([createParagraphNode('Add events from the dashboard — they appear here automatically.')]),
          sourceType: 'manual',
          // Events start empty (each requires a date); the parish admin adds them.
          events: [],
        },
      ],
      meta: { title: `Events — ${name}`, description: 'Upcoming parish events.' },
    },
    {
      slug: 'giving',
      title: 'Giving',
      navOrder: 4,
      heroHeading: 'Give',
      heroSub: 'Your generosity sustains our ministry.',
      layout: [
        content([
          createParagraphNode(`Your gifts to the ${p.givingFundName} support worship, outreach, formation, and the care of our community. Thank you for your generosity.`),
        ]),
        {
          blockType: 'donation',
          richText: createLexicalContent([createHeadingNode(`Give to ${name}`, 'h2'), createParagraphNode('Make a secure one-time gift below.')]),
          presetAmounts: '25,50,100,250,500',
          showDonorFields: true,
        },
      ],
      meta: { title: `Giving — ${name}`, description: 'Support our ministry with a secure online gift.' },
    },
    {
      slug: 'about',
      title: 'About',
      navOrder: 5,
      heroHeading: `About ${name}`,
      heroSub: p.tradition,
      layout: [
        content([
          createParagraphNode(p.tradition),
          createHeadingNode('Clergy & Staff', 'h2'),
          createUnorderedListNode(clergyLines),
        ]),
      ],
      meta: { title: `About — ${name}`, description: p.tradition },
    },
    {
      slug: 'ministries',
      title: 'Ministries',
      navOrder: 6,
      heroHeading: 'Ministries',
      heroSub: 'Find your place to serve and grow.',
      layout: [
        content([
          createParagraphNode('There are many ways to get involved in the life of our parish:'),
          createUnorderedListNode(p.ministries),
        ]),
        cta('Get Involved', 'Want to join a ministry or learn more? Reach out — we’ll connect you.', [{ label: 'Contact Us', url: '/contact' }]),
      ],
      meta: { title: `Ministries — ${name}`, description: 'Ways to serve and grow.' },
    },
    {
      slug: 'prayer-requests',
      title: 'Prayer Requests',
      navOrder: 7,
      heroHeading: 'Prayer Requests',
      heroSub: 'We would be honored to pray with you.',
      layout: [
        content([
          createParagraphNode('Our clergy and prayer ministry hold the needs of our community in prayer. Share a request — confidentially if you wish — and we will lift it up.'),
        ]),
        cta('Submit a Prayer Request', 'Reach our prayer ministry directly.', [{ label: 'Send a Request', url: '/contact' }]),
      ],
      meta: { title: `Prayer Requests — ${name}`, description: 'Submit a prayer request to our community.' },
    },
    {
      slug: 'contact',
      title: 'Contact',
      navOrder: 8,
      heroHeading: 'Contact Us',
      heroSub: `We’d love to hear from you.`,
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

  // Slot the Membership page right after Giving, then renumber nav by position so
  // ordering stays clean whether or not the page is present.
  if (membershipPage) {
    const givingIdx = pages.findIndex((pg) => pg.slug === 'giving')
    pages.splice(givingIdx >= 0 ? givingIdx + 1 : pages.length, 0, membershipPage)
  }
  pages.forEach((pg, i) => {
    pg.navOrder = i
  })
  return pages
}

export interface ChurchProvisionResult {
  created: string[]
  skipped: string[]
}

export async function provisionChurchSite(
  payload: Payload,
  tenantId: number | string,
  profile: ChurchProfile,
  opts: { overwrite?: boolean } = {},
): Promise<ChurchProvisionResult & { updated: string[] }> {
  const p: Required<ChurchProfile> = { ...DEFAULTS, churchName: profile.churchName, ...stripUndefined(profile) }

  // Write any recurring plans to the membership-plans settings bag first, so the
  // Join block on the Membership page has plans to render.
  for (const plan of p.membershipPlans) {
    await upsertMembershipPlan(payload, tenantId, plan)
  }

  const pages = buildPages(p)
  const created: string[] = []
  const updated: string[] = []
  const skipped: string[] = []

  for (const spec of pages) {
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
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const existingDoc = existing.docs?.[0] as { id: number | string } | undefined

    if (existingDoc) {
      // Default behavior is idempotent skip. With overwrite, the template OWNS its
      // core pages — replace the placeholder layout/hero/meta a generic provision
      // left behind (e.g. the default Home), keeping the same doc id.
      if (!opts.overwrite) {
        skipped.push(spec.slug)
        continue
      }
      await payload.update({
        collection: 'pages',
        id: existingDoc.id,
        depth: 0,
        overrideAccess: true,
        data: pageData,
      })
      updated.push(spec.slug)
      continue
    }

    await payload.create({ collection: 'pages', depth: 0, overrideAccess: true, data: pageData })
    created.push(spec.slug)
  }

  return { created, updated, skipped }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && !(typeof v === 'string' && v === '')) (out as any)[k] = v
  }
  return out
}
