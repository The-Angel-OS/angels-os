import { RequiredDataFromCollectionSlug } from 'payload'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
  createTextNode,
  createUnorderedListNode,
} from '@/utilities/lexicalHelpers'

/**
 * Angel OS Home Page — Static seed data.
 *
 * Above the fold: The main Angel OS image & verbiage stays intact ("Everyone Gets an Angel").
 * Below the fold: Comprehensive Patreon-style creator platform & storefront redesign
 * drawing on Kessela / Neuracare Pro aesthetics (Sprint F).
 */
export const homeStaticData: () => RequiredDataFromCollectionSlug<'pages'> = () => {
  return {
    slug: 'home',
    _status: 'published',
    title: 'Home',
    hero: {
      type: 'lowImpact',
      richText: createLexicalContent([
        createHeadingNode('Everyone Gets an Angel', 'h1'),
        {
          type: 'paragraph',
          children: [
            createTextNode(
              'Angel OS is the federated cooperative operating system where every Enterprise gets a ',
            ),
            createTextNode('Guardian Angel', 1), // bold
            createTextNode(
              ' — an AI-native assistant that manages your business, serves your customers, and grows your federation. Not a chatbot. A constitutional AI that actually shows up.',
            ),
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      ]),
    },
    layout: [
      // ─── Block 1: TrustRow (Kessela / Neuracare Pro Style Badges) ───────────
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
            label: 'Zero Algorithm Demotion',
            detail: 'Every post and broadcast reaches 100% of your subscribed members',
          },
        ],
      },

      // ─── Block 2: Four Pillars of Monetization (Patreon Duplication) ───────
      {
        blockType: 'content',
        blockName: 'four-pillars',
        columns: [
          {
            size: 'full' as const,
            richText: createLexicalContent([
              createHeadingNode('Four Pillars of Creator Independence', 'h2'),
              createParagraphNode(
                'Memberships & Tiers (Patreon), Creator Stores & Print-on-Demand Merch (Shopify), Community Spaces & Chat (Discord/Circle), and Paid Events & 1-on-1 Sessions (Calendly) — unified under your own domain for just $10/mo and a 4% platform fee.',
              ),
            ]),
          },
        ],
      },

      // ─── Block 3: Creator Storefront & POD Merch (Kessela ProductPanel Style) ─
      {
        blockType: 'content',
        blockName: 'creator-storefront',
        columns: [
          {
            size: 'full' as const,
            richText: createLexicalContent([
              createHeadingNode('Launch Your Storefront With Zero Upfront Cost or Inventory', 'h2'),
              createParagraphNode(
                'Sell custom physical Print-on-Demand merchandise (heavyweight hoodies, tees, caps, ceramic mugs) automatically fulfilled via Printful & Printify, plus high-margin digital downloads and 1-on-1 consultations directly to any visitor.',
              ),
            ]),
          },
        ],
      },

      // ─── Block 4: Interactive Fee & Earnings Calculator ─────────────────────
      {
        blockType: 'content',
        blockName: 'fee-calculator',
        columns: [
          {
            size: 'full' as const,
            richText: createLexicalContent([
              createHeadingNode('Calculate How Much More You Keep With Angel OS', 'h2'),
              createParagraphNode(
                'Compare Angel OS ($10/mo flat + 4% platform fee) vs. Patreon (8–12%) + Shopify ($39) + Circle ($89) + Calendly ($12) demonstrating annual creator savings of $2,000–$5,000+.',
              ),
            ]),
          },
        ],
      },

      // ─── Block 5: LEO 2.0 AI Video Back-Catalog RAG Spotlight ───────────────
      {
        blockType: 'content',
        blockName: 'leo-rag-spotlight',
        columns: [
          {
            size: 'full' as const,
            richText: createLexicalContent([
              createHeadingNode('Your Very Own AI Trained on Your YouTube Universe', 'h2'),
              createParagraphNode(
                'Paste your YouTube channel link. In minutes, LEO ingests your entire back-catalog of videos, transcripts, and community posts into a live vector RAG index (11,480+ chunks live!), delivering clickable [MM:SS] video deep links.',
              ),
            ]),
          },
        ],
      },

      // ─── Block 6: Showcase Aurora Band (Kessela / Neuracare Pro Aesthetic) ──
      {
        blockType: 'showcase',
        blockName: 'creator-showcase-band',
        background: 'aurora',
        heading: 'Built for Independent Creators Who Refuse to Compromise',
        statement:
          "You spent years building your audience. Don't rent your relationship with them on someone else's terms.",
        items: [
          {
            image: { url: '/images/creator-hero-backdrop.svg', alt: 'Video & Audio Archive' } as never,
            caption: 'Video & Audio RAG Archive',
            url: '/dashboard',
          },
          {
            image: { url: '/images/creator-merch-mockup.svg', alt: 'Print-on-Demand Creator Store' } as never,
            caption: 'Zero-Inventory Merch Store',
            url: '/shop',
          },
          {
            image: { url: '/images/creator-spaces-preview.svg', alt: 'Real-Time Spaces Community' } as never,
            caption: 'Real-Time Spaces Community',
            url: '/spaces',
          },
        ],
      },

      // ─── Block 7: Transparent Pricing Ladder (Data's Locked Ladder) ────────
      {
        blockType: 'content',
        blockName: 'pricing-ladder',
        columns: [
          {
            size: 'full' as const,
            richText: createLexicalContent([
              createHeadingNode('Simple, Creator-Friendly Pricing. No Hidden Take-Rates.', 'h2'),
              createParagraphNode(
                '$0 Starter Preview (5% fee) · $10 Creator Flagship (4% fee, $99/yr) · $29 Creator Pro (1.5% fee, $290/yr) · $79 Studio (0% fee, $790/yr).',
              ),
            ]),
          },
        ],
      },

      // ─── Block 8: Comprehensive Creator FAQ ─────────────────────────────────
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
              'Visit our Help Center (/help) anytime to open a tracked incident ticket (INC- reference number) or inspect the live status and resolution of all your previous tickets. Portal owners can also manage incoming support queues directly from Dashboard → Support → Incident Queue.',
          },
        ],
      },

      // ─── Block 9: High-Converting Closing Call-To-Action Banner ─────────────
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
              label: 'Need Help? Open a Ticket',
              url: '/help',
              appearance: 'outline',
            },
          },
        ],
      },
    ],
    meta: {
      title: 'Angel OS — The Creator Operating System | Storefront, Memberships & LEO AI',
      description:
        'The all-in-one creator platform. Launch your custom member storefront, Print-on-Demand merchandise, Discord-style spaces, and AI-powered video archive in 60 seconds — for half the cost of Patreon.',
    },
  }
}
