import type { Payload } from 'payload'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
  createUnorderedListNode,
} from '@/utilities/lexicalHelpers'
import { upsertMembershipPlan, type MembershipPlan } from '@/utilities/membershipPlans'
import { ensurePolicyPages } from '@/utilities/ensurePolicyPages'

/**
 * provisionFitnessSite — the generic FITNESS / GYM TEMPLATE.
 *
 * One template for every membership-based fitness endeavor: CrossFit boxes, yoga &
 * Pilates studios, martial-arts dojos, climbing gyms, dance studios. They differ in
 * vocabulary, not structure — a hero, a schedule, coaches, a join/pricing surface,
 * and a way to get started. So this stamps the standard pages assembled entirely from
 * EXISTING blocks (content/cta/calendar/membership) — zero new tables, zero schema
 * risk — and seeds recurring membership plans into the membership-plans settings bag.
 *
 * Membership is the universal unlock: the same recurring-dues engine the church
 * template uses, pointed at a gym. The Pricing page mounts the Join block.
 *
 * Idempotent: skips a page whose slug already exists (overwrite replaces it).
 *
 * @see src/utilities/provisionChurchSite.ts (the sibling template)
 * @see src/blocks/Membership  @see src/utilities/membershipPlans.ts
 */

export interface FitnessCoach {
  name: string
  role: string
}

export interface ClassTime {
  /** e.g. "Mon / Wed / Fri" */
  day: string
  /** e.g. "6:00 AM — WOD · 9:00 AM — Open Gym · 5:30 PM — WOD" */
  classes: string
}

export interface FitnessProfile {
  gymName: string
  tagline?: string
  /** e.g. "The gym for fitness in Clearwater" — used on the hero/about. */
  positioning?: string
  /** Disciplines offered, shown on Home/Classes, e.g. ["CrossFit", "Yoga", "Mobility"]. */
  disciplines?: string[]
  classTimes?: ClassTime[]
  coaches?: FitnessCoach[]
  /** Public livestream / social URL (YouTube channel) — every endeavor has one. */
  livestreamUrl?: string
  /** Recurring membership plans. Sensible defaults provided if omitted. */
  membershipPlans?: MembershipPlan[]
  contactEmail?: string
  contactPhone?: string
  address?: string
}

const DEFAULT_PLANS: MembershipPlan[] = [
  { id: 'unlimited', name: 'Unlimited', amountCents: 14900, interval: 'month', description: 'Unlimited classes and open gym, every day.', active: true },
  { id: 'class-pass', name: 'Class Pass', amountCents: 9900, interval: 'month', description: 'Up to 3 classes per week.', active: true },
  { id: 'annual', name: 'Annual (Unlimited)', amountCents: 149000, interval: 'year', description: 'Unlimited, billed yearly — two months free.', active: true },
]

const DEFAULTS: Required<Omit<FitnessProfile, 'gymName'>> = {
  tagline: 'Fitness for all levels.',
  positioning: 'A welcoming, inclusive community gym.',
  disciplines: ['Strength & Conditioning', 'Group Classes', 'Open Gym', 'Mobility & Recovery'],
  classTimes: [
    { day: 'Mon / Wed / Fri', classes: '6:00 AM, 9:00 AM, 12:00 PM, 5:30 PM, 6:30 PM' },
    { day: 'Tue / Thu', classes: '6:00 AM, 9:00 AM, 5:30 PM' },
    { day: 'Saturday', classes: '9:00 AM — Community Workout' },
  ],
  coaches: [],
  livestreamUrl: '',
  membershipPlans: DEFAULT_PLANS,
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

function buildPages(p: Required<FitnessProfile>): PageSpec[] {
  const name = p.gymName
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = (nodes: any[]) => ({ blockType: 'content', columns: [{ size: 'full' as const, richText: createLexicalContent(nodes) }] })
  const cta = (heading: string, body: string, links: Array<{ label: string; url: string; appearance?: 'default' | 'outline' }>) => ({
    blockType: 'cta',
    richText: createLexicalContent([createHeadingNode(heading, 'h2'), createParagraphNode(body)]),
    links: links.map((l) => ({ link: { type: 'custom' as const, label: l.label, url: l.url, appearance: l.appearance || 'default' } })),
  })

  const classLines = p.classTimes.map((c) => `${c.day}: ${c.classes}`)
  const coachLines = p.coaches.length
    ? p.coaches.map((c) => `${c.name} — ${c.role}`)
    : ['Our coaching team is here to meet you where you are.']

  const pages: PageSpec[] = [
    {
      slug: 'home',
      title: 'Home',
      navOrder: 0,
      heroHeading: name,
      heroSub: p.tagline,
      layout: [
        content([
          createParagraphNode(`Welcome to ${name}. ${p.positioning} ${p.tagline} Whether it's your first workout or your thousandth, there's a place for you here.`),
          createHeadingNode('What We Offer', 'h2'),
          createUnorderedListNode(p.disciplines),
        ]),
        cta('Get Started', 'New here? Your first class is the hardest step — we make the rest easy.', [
          { label: 'Get Started', url: '/get-started' },
          { label: 'See Pricing', url: '/pricing', appearance: 'outline' },
        ]),
      ],
      meta: { title: `${name}`, description: p.tagline },
    },
    {
      slug: 'classes',
      title: 'Classes',
      navOrder: 1,
      heroHeading: 'Classes & Schedule',
      heroSub: 'Find a time that works for you.',
      layout: [
        content([
          createHeadingNode('Weekly Schedule', 'h2'),
          createUnorderedListNode(classLines),
          createHeadingNode('What to Expect', 'h2'),
          createParagraphNode('Every class is coached and scalable — show up as you are and we will meet you there. Arrive a few minutes early for your first session and let a coach know it is your first time.'),
        ]),
        {
          blockType: 'calendar',
          heading: 'Upcoming Events',
          description: createLexicalContent([createParagraphNode('Workshops, competitions, and special sessions appear here — add them from the dashboard.')]),
          sourceType: 'manual',
          events: [],
        },
      ],
      meta: { title: `Classes — ${name}`, description: 'Weekly class schedule and what to expect.' },
    },
    {
      slug: 'pricing',
      title: 'Pricing',
      navOrder: 2,
      heroHeading: 'Membership',
      heroSub: 'Simple plans. Cancel anytime.',
      layout: [
        content([
          createParagraphNode('Choose the membership that fits your life. All plans include coached classes and access to our community.'),
        ]),
        {
          blockType: 'membership',
          richText: createLexicalContent([
            createHeadingNode('Join the community', 'h2'),
            createParagraphNode('Pick a plan to get started — secure recurring payment via Stripe.'),
          ]),
          ctaText: 'Join now',
        },
      ],
      meta: { title: `Pricing — ${name}`, description: 'Membership plans and pricing.' },
    },
    {
      slug: 'coaches',
      title: 'Coaches',
      navOrder: 3,
      heroHeading: 'Meet the Coaches',
      heroSub: 'The people in your corner.',
      layout: [
        content([
          createParagraphNode('Our coaches are here to help you train safely, progress steadily, and have fun doing it.'),
          createUnorderedListNode(coachLines),
        ]),
      ],
      meta: { title: `Coaches — ${name}`, description: 'Meet our coaching team.' },
    },
    {
      slug: 'get-started',
      title: 'Get Started',
      navOrder: 4,
      heroHeading: 'Get Started',
      heroSub: 'Your first step starts here.',
      layout: [
        content([
          createParagraphNode(`Starting is simple. Reach out, tell us your goals, and we will help you pick the right on-ramp. No experience required — every member of ${name} started with a first day.`),
          createHeadingNode('How It Works', 'h2'),
          createUnorderedListNode([
            'Get in touch or drop by for a tour.',
            'Try a class or a free intro session.',
            'Pick a membership and start training.',
          ]),
        ]),
        cta('Ready when you are', 'Choose a plan now, or reach out with questions first.', [
          { label: 'See Pricing', url: '/pricing' },
          { label: 'Contact Us', url: '/contact', appearance: 'outline' },
        ]),
      ],
      meta: { title: `Get Started — ${name}`, description: `Start your fitness journey at ${name}.` },
    },
    {
      slug: 'contact',
      title: 'Contact',
      navOrder: 5,
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
          ...(p.livestreamUrl ? [createHeadingNode('Follow Along', 'h3'), createParagraphNode(`Watch and follow us: ${p.livestreamUrl}`)] : []),
        ]),
      ],
      meta: { title: `Contact — ${name}`, description: `Get in touch with ${name}.` },
    },
  ]

  pages.forEach((pg, i) => {
    pg.navOrder = i
  })
  return pages
}

export interface FitnessProvisionResult {
  created: string[]
  updated: string[]
  skipped: string[]
}

export async function provisionFitnessSite(
  payload: Payload,
  tenantId: number | string,
  profile: FitnessProfile,
  opts: { overwrite?: boolean } = {},
): Promise<FitnessProvisionResult> {
  const p: Required<FitnessProfile> = { ...DEFAULTS, gymName: profile.gymName, ...stripUndefined(profile) }

  // Seed recurring plans first so the Pricing page's Join block has plans to show.
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
      if (!opts.overwrite) {
        skipped.push(spec.slug)
        continue
      }
      await payload.update({ collection: 'pages', id: existingDoc.id, depth: 0, overrideAccess: true, data: pageData })
      updated.push(spec.slug)
      continue
    }

    await payload.create({ collection: 'pages', depth: 0, overrideAccess: true, data: pageData })
    created.push(spec.slug)
  }

  // Legal/policy pages + footer links — a gym sells memberships and collects SMS/
  // contact consent, so it needs Privacy/Terms/Cookie/Refund.
  await ensurePolicyPages(payload, tenantId, {
    orgName: p.gymName,
    contactEmail: p.contactEmail || undefined,
    takesPayments: true,
  }, { overwrite: opts.overwrite })

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
