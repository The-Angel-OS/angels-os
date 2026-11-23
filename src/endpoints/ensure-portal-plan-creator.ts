/**
 * DB Pre-Flight + Live Pricing Page Sync —
 * GET|POST /api/provision-ops/ensure-portal-plan-creator
 *
 * Adds `'creator'` to Postgres enum `enum_tenants_portal_plan` BEFORE the field
 * option `'creator'` is added to `Tenants.portalPlan` (Zero-Downtime 2-Deploy Rule).
 *
 * When `?syncPricingPage=1` is passed, also updates the platform tenant's `/pricing`
 * CMS page with the locked 4-tier creator pricing ($0 Preview / $10 Creator / $29 Pro / $79 Studio).
 *
 * Auth: super_admin OR ?key=<CRON_SECRET> OR Authorization: Bearer <CRON_SECRET>.
 */
import type { PayloadHandler } from 'payload'
import {
  createHeadingNode,
  createLexicalContent,
  createParagraphNode,
  createUnorderedListNode,
} from '@/utilities/lexicalHelpers'

function buildPricingPageData(existingHero: Record<string, unknown> | undefined) {
  const existingMedia = existingHero?.media
  const mediaId =
    existingMedia && typeof existingMedia === 'object'
      ? (existingMedia as { id?: number | string }).id
      : existingMedia

  return {
    hero: {
      type: (existingHero?.type as string) || 'splitPanel',
      ...(mediaId != null ? { media: mediaId } : {}),
      ...(existingHero?.scrim ? { scrim: existingHero.scrim } : { scrim: 'strong' }),
      ...(existingHero?.mediaFit ? { mediaFit: existingHero.mediaFit } : { mediaFit: 'cover' }),
      links: Array.isArray(existingHero?.links) ? existingHero.links : [],
      richText: createLexicalContent([
        createHeadingNode('Your creator platform, built in 60 seconds.', 'h1'),
        createParagraphNode(
          'Start free on a spacesangels.com address. Unlock paid memberships, your own domain, and LEO AI trained on your YouTube channel for $10/month.',
        ),
      ]),
    },
    layout: [
      {
        blockType: 'content',
        columns: [
          {
            size: 'full',
            richText: createLexicalContent([
              createHeadingNode('Stop renting five separate creator tools.', 'h2'),
              createParagraphNode(
                'Most creators stitch together Patreon (8–12% cut) + Shopify ($39) + Circle ($89) + Calendly ($12) — $140+/month before you sell a single hoodie or membership.',
              ),
              createParagraphNode(
                'Angel OS puts your website, paid memberships, real-time Spaces community, merch shop, paid events, 1-on-1 bookings, and LEO AI trained on your YouTube back-catalog under one roof — starting free, and unlocking everything to earn at $10/month.',
              ),
            ]),
          },
        ],
      },
      {
        blockType: 'content',
        columns: [
          {
            size: 'full',
            richText: createLexicalContent([
              createHeadingNode('Starter (Preview) — $0/month (5% platform fee)', 'h2'),
              createParagraphNode(
                'Zero-friction try-before-you-buy on a handle.spacesangels.com address. Keep it live as long as you want.',
              ),
              createUnorderedListNode([
                'Instant handle.spacesangels.com portal & SSL hosting',
                'Public YouTube video catalog mirrored automatically',
                'Pages, posts, donations, and light/dark themes',
                'Basic LEO preview & Angel OS footer credit',
                '1 portal · 5% platform fee on sales/deposits (capped at $9.99)',
              ]),
              createHeadingNode('Creator — $10/month ($99/year) · 4% platform fee', 'h2'),
              createParagraphNode(
                'Everything needed to launch and monetize your audience — at half of Patreon’s cut.',
              ),
              createUnorderedListNode([
                'Paid memberships & members-only videos/posts (4% platform fee)',
                'LEO Site AI trained on your YouTube transcripts (RAG search + answers)',
                'Spaces community rooms, Events, 1-on-1 Bookings & Merch/POD shop',
                'Your own custom domain name, connected and secured',
                'Direct Square OAuth payouts (instant split) + PayPal/Venmo rail',
                '1 portal · $10/mo billed monthly or $99/yr',
              ]),
              createHeadingNode('Pro — $29/month ($290/year) · 1.5% platform fee', 'h2'),
              createParagraphNode(
                'White-label branding, CRM tools, and lower fees — once you cross ~$800/month in sales, the fee drop pays for the jump itself.',
              ),
              createUnorderedListNode([
                'Everything in Creator',
                'White-label footer — "Powered by The Angel OS" removed',
                'CRM contact list, tags, and member follow-ups',
                'Higher LEO quota & optional BYOK AI keys',
                'Up to 3 portals · 1.5% platform fee (capped at $9.99)',
              ]),
              createHeadingNode('Studio — $79/month ($790/year) · 0% platform fee', 'h2'),
              createParagraphNode(
                'Zero Angel OS platform cut on anything you sell — built for established creators and multi-channel teams.',
              ),
              createUnorderedListNode([
                'Everything in Pro',
                '0% Angel OS platform fee across memberships, merch, events, and bookings',
                'Up to 10 portals under one Studio account',
                'Team seats and priority support',
              ]),
              createParagraphNode(
                'Nothing gets rebuilt when you move up. Your pages, members, videos, and Spaces stay put — a paid plan simply unlocks the capabilities and lowers your fee.',
              ),
            ]),
          },
        ],
      },
      {
        blockType: 'trustRow',
        heading: 'What every plan includes',
        footnote:
          'Prices are per site, per month, in US dollars. Platform fees are capped at $9.99 per transaction. No setup fee on any plan.',
        items: [
          {
            icon: 'shield',
            label: 'You Own It',
            detail: 'Your content, your domain, yours to take',
          },
          {
            icon: 'return',
            label: 'Cancel Anytime',
            detail: 'No contract, no exit fee',
          },
          {
            icon: 'lock',
            label: 'Secure Hosting',
            detail: 'SSL, backups, and monitoring included',
          },
          {
            icon: 'support',
            label: 'Ask LEO or Edit Live',
            detail: 'Conversational site updates or visual editing',
          },
        ],
      },
      {
        blockType: 'faq',
        heading: 'Before you decide',
        openFirst: true,
        items: [
          {
            question: 'What is the difference between Starter, Creator, Pro, and Studio?',
            answer:
              'Starter ($0) lets you preview your portal live on spacesangels.com. Creator ($10/mo, 4% fee) unlocks paid memberships, your custom domain, and LEO AI trained on your YouTube videos. Pro ($29/mo, 1.5% fee) removes the Angel OS footer credit, adds CRM tools, and expands to 3 portals. Studio ($79/mo) drops the platform fee to 0% and supports up to 10 portals.',
          },
          {
            question: 'What is the catch on the free Starter portal?',
            answer:
              'No catch: Starter stays live on a spacesangels.com subdomain with an Angel OS footer credit. Upgrading to Creator ($10/mo) unlocks custom domains, paid memberships, and full LEO AI, while Pro ($29/mo) removes the footer credit and adds CRM.',
          },
          {
            question: 'Do payment processor fees apply separately?',
            answer:
              'Standard Square or PayPal processing rates apply when your customers check out, and Angel OS collects only your plan’s transparent platform fee (5% / 4% / 1.5% / 0%, always capped at $9.99 per transaction).',
          },
          {
            question: 'Do I own my content and audience?',
            answer:
              'Yes. Your pages, posts, member list, and domain belong to you — there is no lock-in or exit fee.',
          },
          {
            question: 'Do I have to rebuild my site when I upgrade?',
            answer:
              'Never. Upgrading flips capabilities on instantly on the same URL with the same content, members, and Spaces.',
          },
        ],
      },
      {
        blockType: 'cta',
        richText: createLexicalContent([
          createHeadingNode('See yours before you decide', 'h2'),
          createParagraphNode(
            'Start with a free Starter portal or explore a live creator showcase powered by Angel OS.',
          ),
        ]),
        links: [
          {
            link: {
              type: 'custom',
              newTab: false,
              url: '/get-started',
              label: 'Start your free portal',
              appearance: 'default',
            },
          },
          {
            link: {
              type: 'custom',
              newTab: true,
              url: 'https://clearwater-cruisin.spacesangels.com',
              label: 'See live example',
              appearance: 'outline',
            },
          },
        ],
      },
    ],
    meta: {
      title: 'Pricing — The Angel OS',
      description:
        'Start free on spacesangels.com. Unlock memberships, custom domain, and LEO AI at $10/mo Creator (4% fee), $29/mo Pro (1.5%), or $79/mo Studio (0%).',
    },
  }
}

export const ensurePortalPlanCreatorHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload.db as any)?.pool
  if (!pool?.query) {
    return Response.json({ error: 'no pg pool on payload.db' }, { status: 500 })
  }

  let values: string[] = []
  try {
    await pool.query(
      `ALTER TYPE "enum_tenants_portal_plan" ADD VALUE IF NOT EXISTS 'creator';`,
    )
    const enumRes = await pool.query(
      `SELECT e.enumlabel
       FROM pg_enum e
       JOIN pg_type t ON e.enumtypid = t.oid
       WHERE t.typname = 'enum_tenants_portal_plan'
       ORDER BY e.enumsortorder;`,
    )
    values = (enumRes.rows || []).map((r: { enumlabel: string }) => r.enumlabel)
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }

  let pricingPageSynced = false
  let pricingPageId: number | string | null = null
  let pricingPageError: string | null = null

  if (url.searchParams.get('syncPricingPage') === '1') {
    try {
      const platformRes = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: 'platform' } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      })
      const platformTenantId = platformRes.docs?.[0]?.id
      const pageRes = await payload.find({
        collection: 'pages',
        where: {
          and: [
            { slug: { equals: 'pricing' } },
            ...(platformTenantId != null ? [{ tenant: { equals: platformTenantId } }] : []),
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      })
      const pricingPage = pageRes.docs?.[0] as
        | { id: number | string; hero?: Record<string, unknown> }
        | undefined

      if (pricingPage) {
        pricingPageId = pricingPage.id
        const nextData = buildPricingPageData(pricingPage.hero)
        await payload.update({
          collection: 'pages',
          id: pricingPage.id,
          data: {
            ...nextData,
            _status: 'published',
          } as never,
          overrideAccess: true,
          req,
        })
        pricingPageSynced = true
      } else {
        pricingPageError = 'Platform /pricing CMS page not found'
      }
    } catch (e) {
      pricingPageError = e instanceof Error ? e.message : String(e)
    }
  }

  return Response.json({
    ok: true,
    enumType: 'enum_tenants_portal_plan',
    values,
    hasCreator: values.includes('creator'),
    pricingPageSynced,
    pricingPageId,
    ...(pricingPageError ? { pricingPageError } : {}),
  })
}
