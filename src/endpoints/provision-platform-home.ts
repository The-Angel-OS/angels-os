/**
 * Provision Platform Home Page, Navigation & Help Center —
 * GET/POST /api/provision-ops/platform-home
 *
 * Sprint F (Geordi & Troi): Patreon-Style Primary Portal Redesign, Clean Patreon
 * Header Nav & ServiceNow-Lite Help Center Provisioning.
 *
 * Query params:
 *   - `?key=<CRON_SECRET>` (or super_admin session)
 *   - `?generateImages=1` (default 1 — calls generateImage for bespoke Patreon-style editorial visuals, falls back to local SVG or existing Tenant 1 Media IDs)
 *   - `?syncNav=1` (default 1 — sets clean Patreon-style Header, Footer & navOverrides on platform tenant, removing Episodes & duplicates)
 *   - `?syncHelp=1` (default 1 — ensures published `/help` page with TicketForm & Help Center FAQ exists on platform tenant)
 *
 * CRITICAL:
 * Preserves above-the-fold Angel OS hero (`hero` field + `meta.image`) completely untouched!
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Payload, PayloadHandler } from 'payload'
import { revalidatePath } from 'next/cache'
import { generateImage } from '@/utilities/imageGeneration'
import { setNavOverrides } from '@/utilities/navOverrides'
import {
  createHeadingNode,
  createLexicalContent,
  createParagraphNode,
  createUnorderedListNode,
} from '@/utilities/lexicalHelpers'

type MediaSpec = {
  key: string
  alt: string
  prompt: string
  fallbackFile: string
}

const MEDIA_SPECS: MediaSpec[] = [
  {
    key: 'showcaseVideo',
    alt: 'sprint-f-showcase-video',
    prompt:
      'Editorial studio photograph of an independent video creator and podcaster desk with cinema camera monitor, warm condenser microphone, ambient violet and warm coral studio lighting, clean minimalist desk, photographic quality, no text',
    fallbackFile: 'creator-hero-backdrop.svg',
  },
  {
    key: 'showcaseStore',
    alt: 'sprint-f-showcase-store',
    prompt:
      'Minimalist editorial flat-lay product photography of creator merchandise on a sleek studio tabletop: heavyweight charcoal cotton hoodie, vinyl record sleeve, embroidered cap, matte black ceramic mug, soft studio lighting, no watermark, no text',
    fallbackFile: 'creator-merch-mockup.svg',
  },
  {
    key: 'showcaseCommunity',
    alt: 'sprint-f-showcase-community',
    prompt:
      'Modern vibrant creator community studio workspace with warm amber and indigo ambient glow, creators collaborating around sleek monitors, high-converting Patreon editorial aesthetic, crisp photography, no text',
    fallbackFile: 'creator-spaces-preview.svg',
  },
  {
    key: 'mediaMerch',
    alt: 'sprint-f-media-merch',
    prompt:
      'Sunlit boutique creator studio showing neatly hung premium hoodies, totes, and custom packaged merchandise boxes ready to ship, editorial lifestyle photography, clean modern aesthetic, no text',
    fallbackFile: 'creator-merch-mockup.svg',
  },
  {
    key: 'mediaSpaces',
    alt: 'sprint-f-media-spaces',
    prompt:
      'Cozy modern live-stream and community broadcast room with acoustic wood panels, dual studio monitors, audio mixing console, warm violet and amber accent lights, clean editorial photography, no text',
    fallbackFile: 'creator-spaces-preview.svg',
  },
]

async function ensurePlatformMedia(
  payload: Payload,
  tenantId: number | string,
  spec: MediaSpec,
  shouldGenerate: boolean,
  existingFallbackIds: Array<number | string>,
  fallbackCursor: number,
): Promise<{ mediaId: number | string | null; source: 'existing' | 'generated' | 'svg' | 'pool' | 'none' }> {
  // 1. Reuse already-provisioned asset by deterministic alt marker
  const existing = await payload.find({
    collection: 'media',
    where: { and: [{ tenant: { equals: tenantId } }, { alt: { equals: spec.alt } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const foundId = existing.docs?.[0]?.id
  if (foundId != null) {
    return { mediaId: foundId, source: 'existing' }
  }

  // 2. Try AI generation when enabled
  if (shouldGenerate) {
    try {
      const gen = await generateImage(
        {
          prompt: spec.prompt,
          autoUpload: true,
          tenantId: Number(tenantId),
          enhancementContext: {
            brandStyle: 'Patreon editorial creator photography, crisp studio lighting',
          },
        },
        payload,
      )
      if (gen.success && gen.mediaId != null) {
        await payload
          .update({
            collection: 'media',
            id: gen.mediaId,
            data: { alt: spec.alt },
            overrideAccess: true,
          })
          .catch(() => undefined)
        return { mediaId: gen.mediaId, source: 'generated' }
      }
    } catch (err) {
      console.warn(`[provision-platform-home] generateImage fallback for ${spec.alt}:`, err)
    }
  }

  // 3. Try local SVG upload from public/images/
  try {
    const filePath = path.join(process.cwd(), 'public', 'images', spec.fallbackFile)
    const buf = await fs.readFile(filePath)
    const created = await payload.create({
      collection: 'media',
      data: {
        alt: spec.alt,
        tenant: tenantId as never,
      },
      file: {
        data: buf,
        mimetype: 'image/svg+xml',
        name: `${spec.alt}.svg`,
        size: buf.length,
      },
      overrideAccess: true,
    })
    if (created?.id != null) {
      return { mediaId: created.id, source: 'svg' }
    }
  } catch (err) {
    console.warn(`[provision-platform-home] SVG upload fallback for ${spec.alt}:`, err)
  }

  // 4. Deterministic fallback to existing Tenant 1 media records so Page update never fails
  if (existingFallbackIds.length > 0) {
    const picked = existingFallbackIds[fallbackCursor % existingFallbackIds.length] ?? existingFallbackIds[0]
    return { mediaId: picked ?? null, source: 'pool' }
  }

  return { mediaId: null, source: 'none' }
}

function buildHomeLayout(mediaIds: Record<string, number | string | null>) {
  const showcaseItems = [
    mediaIds.showcaseVideo != null
      ? {
          image: mediaIds.showcaseVideo,
          caption: 'Video & Audio RAG Archive',
          url: '/start?focus=leo',
        }
      : null,
    mediaIds.showcaseStore != null
      ? {
          image: mediaIds.showcaseStore,
          caption: 'Zero-Inventory Merch Store',
          url: '/start?focus=storefront',
        }
      : null,
    mediaIds.showcaseCommunity != null
      ? {
          image: mediaIds.showcaseCommunity,
          caption: 'Real-Time Spaces Community',
          url: '/start?focus=spaces',
        }
      : null,
  ].filter(Boolean)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layout: any[] = [
    // 1. TrustRow — Kessela / Neuracare Pro credibility strip
    {
      blockType: 'trustRow',
      blockName: 'creator-trust-row',
      heading: 'Built for Independent Creators & Archival Universes',
      items: [
        {
          icon: 'shield',
          label: '100% Data Sovereignty',
          detail: 'Article VI suitcase export — download your members & posts anytime',
        },
        {
          icon: 'lock',
          label: 'Direct Dual-Rail Payouts',
          detail: 'Direct into your Square or PayPal account. Zero escrow delay',
        },
        {
          icon: 'rosette',
          label: 'Free Custom Domain',
          detail: 'Bind yourdomain.com with free edge SSL & Cloudflare protection',
        },
        {
          icon: 'star',
          label: '4% Flagship Platform Fee',
          detail: 'Half of Patreon — keep thousands more every year',
        },
      ],
    },

    // 2. Four Pillars of Monetization (interactive component via RenderBlocks)
    {
      blockType: 'content',
      blockName: 'four-pillars',
      columns: [
        {
          size: 'full',
          richText: createLexicalContent([
            createHeadingNode('Four Pillars of Creator Independence', 'h2'),
            createParagraphNode(
              'Memberships & Tiers (Patreon), Creator Stores & Print-on-Demand Merch (Shopify), Community Spaces & Chat (Discord/Circle), and Paid Events & 1-on-1 Sessions (Calendly) — unified under your own domain for $10/mo and 4%.',
            ),
          ]),
        },
      ],
    },

    // 3. Editorial Patreon Commerce MediaText band (only if media resolved)
    ...(mediaIds.mediaMerch != null
      ? [
          {
            blockType: 'mediaText',
            eyebrow: 'Creator Commerce',
            heading: 'Turn your audience into a real storefront — with zero inventory',
            body:
              'Launch custom physical merchandise and digital downloads directly on your own site. Every hoodie, tee, cap, mug, and vinyl drop routes automatically through Printful and Printify when ordered — no boxes in your garage and zero upfront cost.\n\nJust like modern Patreon Commerce, any visitor can buy from your shop without becoming a monthly patron first, while paid members automatically enjoy supporter discounts.',
            media: mediaIds.mediaMerch,
            aspect: '16/9',
            width: 'split',
            side: 'right',
            playback: 'player',
            ctaLabel: 'Launch Your Storefront',
            ctaUrl: '/start?focus=storefront',
          },
        ]
      : []),

    // 4. Interactive Creator Storefront & POD Merch Live Preview
    {
      blockType: 'content',
      blockName: 'creator-storefront',
      columns: [
        {
          size: 'full',
          richText: createLexicalContent([
            createHeadingNode('Launch Your Storefront With Zero Upfront Cost or Inventory', 'h2'),
            createParagraphNode(
              'Sell custom physical Print-on-Demand merchandise (heavyweight hoodies, tees, caps, ceramic mugs) automatically fulfilled via Printful & Printify, plus high-margin digital downloads and 1-on-1 consultations directly to any visitor.',
            ),
          ]),
        },
      ],
    },

    // 5. Kessela / Neuracare Pro Signature Aurora Gradient Band
    {
      blockType: 'showcase',
      blockName: 'creator-showcase-band',
      background: 'aurora',
      heading: 'Built for Independent Creators Who Refuse to Compromise',
      statement:
        "You spent years building your audience. Don't rent your relationship with them on someone else's terms.",
      ...(showcaseItems.length >= 2 ? { items: showcaseItems } : {}),
    },

    // 6. Editorial Community Spaces MediaText band
    ...(mediaIds.mediaSpaces != null
      ? [
          {
            blockType: 'mediaText',
            eyebrow: 'Own Your Community',
            heading: 'Real-time Spaces without algorithms or platform lock-in',
            body:
              'Bring your members out of noisy third-party feeds and into your own branded Spaces. Organize topic rooms, private supporter channels, and voice hangouts right alongside your storefront and video archive.\n\nEvery post, announcement, and broadcast reaches 100% of your supporters — never throttled behind pay-to-boost algorithms.',
            media: mediaIds.mediaSpaces,
            aspect: '16/9',
            width: 'split',
            side: 'left',
            playback: 'player',
            ctaLabel: 'Build Your Space',
            ctaUrl: '/start?focus=spaces',
          },
        ]
      : []),

    // 7. Interactive Earnings & Fee Comparison Calculator
    {
      blockType: 'content',
      blockName: 'fee-calculator',
      columns: [
        {
          size: 'full',
          richText: createLexicalContent([
            createHeadingNode('Calculate How Much More You Keep With Angel OS', 'h2'),
            createParagraphNode(
              'Compare Angel OS ($10/mo flat + 4% platform fee) vs. Patreon (8–12%) + Shopify ($39) + Circle ($89) + Calendly ($12) demonstrating annual creator savings of $2,000–$5,000+.',
            ),
          ]),
        },
      ],
    },

    // 8. LEO 2.0 Video Back-Catalog Vector RAG Spotlight
    {
      blockType: 'content',
      blockName: 'leo-rag-spotlight',
      columns: [
        {
          size: 'full',
          richText: createLexicalContent([
            createHeadingNode('Your Very Own AI Trained on Your YouTube Universe', 'h2'),
            createParagraphNode(
              'Paste your YouTube channel link. In minutes, LEO ingests your entire back-catalog of videos, transcripts, and community posts into a live vector RAG index (11,480+ chunks live!), delivering clickable [MM:SS] video deep links.',
            ),
          ]),
        },
      ],
    },

    // 9. Featured Live Portals
    {
      blockType: 'featuredEndeavors',
      heading: 'Live Portals Already Running on Angel OS',
      subheading:
        'Explore real creator archives, ministries, and storefronts powered by the same multi-tenant core.',
      source: 'recent',
      maxItems: 6,
      layout: 'grid',
      showDescription: true,
      showRegion: true,
    },

    // 10. Locked 4-Tier Pricing Ladder
    {
      blockType: 'content',
      blockName: 'pricing-ladder',
      columns: [
        {
          size: 'full',
          richText: createLexicalContent([
            createHeadingNode('Simple, Creator-Friendly Pricing. No Hidden Take-Rates.', 'h2'),
            createParagraphNode(
              '$0 Starter Preview (5% fee) · $10 Creator Flagship (4% fee, $99/yr) · $29 Creator Pro (1.5% fee, $290/yr) · $79 Studio (0% fee, $790/yr).',
            ),
          ]),
        },
      ],
    },

    // 11. Comprehensive Creator FAQ
    {
      blockType: 'faq',
      blockName: 'creator-faq',
      heading: 'Frequently Asked Questions',
      openFirst: true,
      items: [
        {
          question: 'How does Print-on-Demand (POD) merchandise work on Angel OS?',
          answer:
            'You upload your custom graphics and logo in Creator Studio. When a fan purchases a hoodie, tee, dad hat, or ceramic mug, the order is automatically routed to our POD engine (Printful v2 & Printify). They print, pack, and ship it directly to your fan with your branding. You hold zero inventory and pay zero upfront cost.',
        },
        {
          question: 'How does Angel OS compare to Patreon?',
          answer:
            'Patreon charges 8% to 12% just for memberships, and you still have to pay for Shopify ($39/mo) to sell merch, Circle ($89/mo) for community chat, and Calendly ($12/mo) for appointments. Angel OS provides all four pillars for just $10/mo and a 4% platform fee (or 1.5% at Pro, 0% at Studio), saving creators $2,000 to $5,000+ each year.',
        },
        {
          question: 'How long does it take to import my YouTube channel?',
          answer:
            'Under 60 seconds. Paste your YouTube channel URL or @handle, and LEO automatically mirrors your public videos, community posts, and begins vectorizing your transcripts for AI-powered timestamp search.',
        },
        {
          question: 'How do payouts work?',
          answer:
            'Angel OS uses direct dual-rail payouts via Square and PayPal. When a fan joins or buys merch, the funds settle directly into your connected Square or PayPal account. There are no platform escrow holds or arbitrary payout delays.',
        },
        {
          question: 'Can I use my own custom domain (e.g. myname.com)?',
          answer:
            'Yes! Every portal gets a free instant subdomain (yourhandle.spacesangels.com), and the $10/mo Creator plan unlocks one-click custom domain binding with free enterprise SSL and Cloudflare DDoS protection.',
        },
        {
          question: 'Can fans buy from my shop without being paying monthly members?',
          answer:
            'Yes. Just like Patreon Commerce, your storefront is public so any visitor or casual viewer can purchase physical merch and digital goods. You can also offer automatic discounts (like 15% off) to your monthly members.',
        },
        {
          question: 'Do I own my data and member list?',
          answer:
            '100%. Article VI of the Angel OS Constitution guarantees total data sovereignty. You can export your full member list, order history, and content anytime via our one-click Suitcase export.',
        },
        {
          question: 'How do I get support or track an incident ticket?',
          answer:
            'Open Dashboard → Support → Help & Support (/dashboard/support) anytime to open a tracked incident ticket (INC- reference number) or inspect the live status and resolution of all your previous tickets. Portal owners can also manage incoming support queues directly from Dashboard → Support → Incident Queue.',
        },
      ],
    },

    // 12. Closing Handle Reservation CTA
    {
      blockType: 'cta',
      blockName: 'creator-onboarding-cta',
      richText: createLexicalContent([
        createHeadingNode('Build Your Universe. Own Your Community. Monetize Your Work.', 'h2'),
        createParagraphNode(
          'Claim your handle now. Launch your storefront, memberships, real-time chat, and LEO AI archive today — with zero upfront cost or inventory.',
        ),
      ]),
      links: [
        {
          link: {
            type: 'custom',
            label: 'Start Free Preview (60 Seconds)',
            url: '/start',
            appearance: 'default',
          },
        },
        {
          link: {
            type: 'custom',
            label: 'Explore Pricing',
            url: '/pricing',
            appearance: 'outline',
          },
        },
      ],
    },

    // 13. Latest Blog Posts Archive
    {
      blockType: 'archive',
      populateBy: 'collection',
      relationTo: 'posts',
      limit: 6,
      columns: '3',
      introContent: createLexicalContent([
        createHeadingNode('Latest from Angel OS', 'h2'),
        createParagraphNode(
          'Product updates, creator stories, and architecture dispatches from the platform.',
        ),
      ]),
    },
  ]

  return layout
}

async function cleanPrivacyPolicyPage(
  payload: Payload,
  platformTenantId: number | string,
): Promise<{ privacyPageId: number | string | null; privacyUpdated: boolean }> {
  const res = await payload.find({
    collection: 'pages',
    where: {
      and: [{ slug: { equals: 'privacy-policy' } }, { tenant: { equals: platformTenantId } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = res.docs?.[0] as { id: number | string } | undefined
  if (!doc) {
    return { privacyPageId: null, privacyUpdated: false }
  }

  // Note: Content block only permits h2/h3/h4 headings (no duplicate h1 here — hero has h1).
  const layout = [
    {
      blockType: 'content',
      columns: [
        {
          size: 'full',
          richText: createLexicalContent([
            createParagraphNode(
              'Angel OS respects your privacy. This policy explains what information we collect, how we use it, and the choices you have.',
            ),
            createHeadingNode('Information We Collect', 'h2'),
            createUnorderedListNode([
              'Contact details you provide (name, email, phone) when you sign up, give, subscribe, or message us.',
              'Payment information processed securely by our PCI-compliant payment providers — we do not store card numbers.',
              'Basic usage and device data to keep the site secure and working.',
            ]),
            createHeadingNode('How We Use It', 'h2'),
            createUnorderedListNode([
              'To provide the services you request (memberships, giving, bookings, communication).',
              'To send receipts, confirmations, and messages you have opted into.',
              'To protect the site and comply with the law.',
            ]),
            createParagraphNode(
              'We do not sell your personal information. We share it only with service providers who help us operate (e.g. payment and messaging providers) and only as needed.',
            ),
            createHeadingNode('Your Choices', 'h2'),
            createParagraphNode(
              'You may request access to, correction of, or deletion of your personal information, and you may unsubscribe from non-essential messages at any time. If you have questions about these terms, contact us at support@spacesangels.com.',
            ),
          ]),
        },
      ],
    },
  ]

  await payload.update({
    collection: 'pages',
    id: doc.id,
    data: {
      layout: layout as never,
      _status: 'published',
    } as never,
    overrideAccess: true,
  })

  try {
    revalidatePath('/privacy-policy')
    revalidatePath('/en/privacy-policy')
  } catch {
    /* non-fatal outside Next request cache */
  }

  return { privacyPageId: doc.id, privacyUpdated: true }
}

function extractHeroHeading(hero: unknown): string | null {
  try {
    const rich = (hero as { richText?: { root?: { children?: Array<{ children?: Array<{ text?: string }> }> } } })
      ?.richText
    const first = rich?.root?.children?.[0]?.children?.[0]?.text
    return typeof first === 'string' ? first : null
  } catch {
    return null
  }
}

export const provisionPlatformHomeHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  const url = new URL(req.url || 'http://localhost', 'http://localhost')
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    ((user as { roles?: string[] } | undefined)?.roles)?.includes('super_admin'),
  )
  const secret = process.env.CRON_SECRET
  const keyValid = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))

  if (!isSuperAdmin && !keyValid) {
    return Response.json(
      { error: 'super_admin session or ?key=CRON_SECRET required' },
      { status: 403 },
    )
  }

  const shouldGenerate = url.searchParams.get('generateImages') !== '0'
  const shouldSyncNav = url.searchParams.get('syncNav') !== '0'
  const shouldSyncHelp = url.searchParams.get('syncHelp') !== '0'
  const onlyPrivacy = url.searchParams.get('onlyPrivacy') === '1'
  const shouldSyncPrivacy = onlyPrivacy || url.searchParams.get('syncPrivacy') === '1'

  try {
    // 1. Resolve Platform Tenant (ID 1 or slug 'platform')
    const tenantRes = await payload.find({
      collection: 'tenants',
      where: { or: [{ slug: { equals: 'platform' } }, { id: { equals: 1 } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const platformTenantId = tenantRes.docs?.[0]?.id
    if (platformTenantId == null) {
      return Response.json({ error: 'Platform tenant not found' }, { status: 404 })
    }

    let privacyPageId: number | string | null = null
    let privacyUpdated = false
    if (shouldSyncPrivacy) {
      const priv = await cleanPrivacyPolicyPage(payload, platformTenantId)
      privacyPageId = priv.privacyPageId
      privacyUpdated = priv.privacyUpdated
      if (onlyPrivacy) {
        return Response.json({
          ok: true,
          privacyPageId,
          privacyUpdated,
          tenantId: platformTenantId,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // 2. Gather existing Tenant 1 media IDs as deterministic fallback pool
    const existingMediaRes = await payload.find({
      collection: 'media',
      where: { tenant: { equals: platformTenantId } },
      limit: 12,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
    })
    const poolIds = (existingMediaRes.docs || [])
      .map((m) => (m as { id?: number | string }).id)
      .filter((id): id is number | string => id != null)

    const mediaIds: Record<string, number | string | null> = {}
    const mediaSources: Record<string, string> = {}

    for (let i = 0; i < MEDIA_SPECS.length; i++) {
      const spec = MEDIA_SPECS[i]!
      const res = await ensurePlatformMedia(
        payload,
        platformTenantId,
        spec,
        shouldGenerate,
        poolIds,
        i,
      )
      mediaIds[spec.key] = res.mediaId
      mediaSources[spec.key] = res.source
    }

    // 3. Resolve existing Home Page for platform tenant (Page #7)
    const pageRes = await payload.find({
      collection: 'pages',
      where: {
        and: [{ slug: { equals: 'home' } }, { tenant: { equals: platformTenantId } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const existingPage = pageRes.docs?.[0] as
      | { id: number | string; hero?: unknown; meta?: { image?: unknown } }
      | undefined

    const layout = buildHomeLayout(mediaIds)
    const existingMetaImage = existingPage?.meta?.image
    const metaImageId =
      existingMetaImage && typeof existingMetaImage === 'object'
        ? (existingMetaImage as { id?: number | string }).id
        : existingMetaImage

    let pageId: number | string
    let action: 'created' | 'updated'
    let preservedHeroHeading: string | null = null

    if (existingPage) {
      pageId = existingPage.id
      preservedHeroHeading = extractHeroHeading(existingPage.hero)
      // CRITICAL: Do NOT touch `hero` — preserve above-the-fold Angel OS image & copy!
      await payload.update({
        collection: 'pages',
        id: pageId,
        data: {
          layout: layout as never,
          meta: {
            title: 'Angel OS — The Creator Operating System | Storefront, Memberships & LEO AI',
            description:
              'Launch your creator storefront, Print-on-Demand merch, paid memberships, real-time community spaces, and AI video archive in 60 seconds — for half the cost of Patreon.',
            ...(metaImageId != null ? { image: metaImageId as never } : {}),
          },
          _status: 'published',
        },
        overrideAccess: true,
      })
      action = 'updated'
    } else {
      const created = await payload.create({
        collection: 'pages',
        data: {
          title: 'Home',
          slug: 'home',
          _status: 'published',
          tenant: platformTenantId as never,
          hero: {
            type: 'lowImpact',
            richText: createLexicalContent([
              createHeadingNode('Everyone Gets an Angel', 'h1'),
              createParagraphNode(
                'Angel OS is the operating system where every creator gets a Guardian Angel — launch your storefront, memberships, spaces, and AI back-catalog.',
              ),
            ]),
          },
          layout: layout as never,
        },
        overrideAccess: true,
      })
      pageId = created.id
      action = 'created'
    }

    // 4. Sync Patreon-style Header, Footer & NavOverrides (no Episodes, no duplicates)
    let headerUpdated = false
    let footerUpdated = false
    if (shouldSyncNav) {
      const linkItem = (label: string, itemUrl: string) => ({
        link: { type: 'custom' as const, label, url: itemUrl, newTab: false },
      })

      const headerRes = await payload.find({
        collection: 'header',
        where: { tenant: { equals: platformTenantId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const patreonNavItems = [
        {
          ...linkItem('For Creators', '/how-it-works'),
          children: [
            linkItem('Creator Examples', '/examples'),
            linkItem('Storefront & Merch', '/#creator-storefront'),
            linkItem('Fee Calculator', '/#fee-calculator'),
            linkItem('Start Your Portal', '/start'),
          ],
        },
        linkItem('Pricing', '/pricing'),
        linkItem('Posts', '/posts'),
      ]

      if (headerRes.docs?.[0]) {
        await payload.update({
          collection: 'header',
          id: headerRes.docs[0].id,
          data: { navItems: patreonNavItems as never },
          overrideAccess: true,
        })
        headerUpdated = true
      }

      await setNavOverrides(payload, platformTenantId, {
        hidden: ['/', '/plans', '/episodes', '/shop', '/federation/discover', '/contact', '/help'],
        pinned: ['/how-it-works', '/pricing', '/posts'],
        maxInline: 0,
        hideMore: true,
      })

      const footerRes = await payload.find({
        collection: 'footer',
        where: { tenant: { equals: platformTenantId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (footerRes.docs?.[0]) {
        await payload.update({
          collection: 'footer',
          id: footerRes.docs[0].id,
          data: {
            navItems: [
              linkItem('Start Your Portal', '/start'),
              linkItem('Pricing', '/pricing'),
              linkItem('Posts', '/posts'),
              linkItem('Help & Support', '/dashboard/support'),
              linkItem('Dashboard', '/dashboard'),
              linkItem('Privacy Policy', '/privacy-policy'),
            ] as never,
          },
          overrideAccess: true,
        })
        footerUpdated = true
      }
    }

    // 5. Retire legacy brochure `/help` CMS page (Help & Support lives at `/dashboard/support`)
    let helpPageId: number | string | null = null
    let helpPageAction: 'unpublished' | 'absent' | 'skipped' = 'skipped'
    if (shouldSyncHelp) {
      const existingHelp = await payload.find({
        collection: 'pages',
        where: { and: [{ slug: { equals: 'help' } }, { tenant: { equals: platformTenantId } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existingHelp.docs?.[0]) {
        helpPageId = existingHelp.docs[0].id
        await payload.update({
          collection: 'pages',
          id: helpPageId,
          data: {
            _status: 'draft',
            showInNav: false,
          } as never,
          overrideAccess: true,
        })
        helpPageAction = 'unpublished'
      } else {
        helpPageAction = 'absent'
      }
    }

    // 6. Revalidate paths
    try {
      revalidatePath('/')
      revalidatePath('/en')
      revalidatePath('/dashboard/support')
      revalidatePath('/en/dashboard/support')
    } catch {
      /* non-fatal outside Next request cache */
    }

    return Response.json({
      success: true,
      action,
      pageId,
      tenantId: platformTenantId,
      preservedHeroHeading,
      mediaIds,
      mediaSources,
      blockCount: layout.length,
      blocks: layout.map((b) => ({
        blockType: b.blockType,
        blockName: b.blockName ?? null,
      })),
      headerUpdated,
      footerUpdated,
      helpPageId,
      helpPageAction,
      privacyPageId,
      privacyUpdated,
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[provisionPlatformHomeHandler] Error:', err)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
