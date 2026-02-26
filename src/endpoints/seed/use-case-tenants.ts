/**
 * Use-case tenant definitions for the seed process.
 * Each tenant exercises a different endeavor type through the provisioning system.
 * Inspired by real Clearwater-area businesses to make the demo tangible.
 */
import type { EndeavorType } from '@/utilities/spaceProvisioning'

/**
 * Domain suffix is environment-aware:
 *   Production (Vercel): *.spacesangels.com
 *   Local dev:           *.angelos.local
 * This ensures tenant.domain matches the actual hostname in each environment,
 * so fetchTenantByDomain exact-match lookup works correctly.
 */
const DOMAIN_SUFFIX = process.env.VERCEL ? 'spacesangels.com' : 'angelos.local'

export interface UseCaseTenant {
  name: string
  slug: string
  domain: string
  endeavorType: EndeavorType
  spaceName: string
  branding: {
    siteName: string
    tagline: string
    primaryColor: string
    secondaryColor: string
    accentColor: string
    backgroundColor: string
    foregroundColor: string
    borderColor: string
    headingFont: string
    bodyFont: string
  }
  leoPersonality: string
  /** Sample posts to seed for this tenant */
  posts: Array<{
    title: string
    slug: string
    excerpt: string
  }>
  /** Optional sample products to seed for this tenant */
  products?: Array<{
    title: string
    slug: string
    description: string[]
    priceInUSD: number
    productionType?: 'ready_made' | 'print_on_demand' | 'custom_order' | 'digital'
    isLimitedEdition?: boolean
    availableUntil?: string
    networkListing?: boolean
    configuratorOptions?: Record<string, unknown>
  }>
}

/**
 * Five use-case tenants demonstrating different endeavor types.
 * Inspired by real businesses — makes seed data feel like a real platform demo.
 */
export const USE_CASE_TENANTS: UseCaseTenant[] = [
  // ─── Service Provider: Celersoft Technology ────────────────
  // Inspired by celersoft.com — IT consulting, cybersecurity, cloud
  {
    name: 'Celersoft Technology',
    slug: 'celersoft',
    domain: `celersoft.${DOMAIN_SUFFIX}`,
    endeavorType: 'service-provider',
    spaceName: 'Celersoft Hub',
    branding: {
      siteName: 'Celersoft',
      tagline: 'Accelerating Digital Transformation',
      primaryColor: '#1E40AF',
      secondaryColor: '#3B82F6',
      accentColor: '#F59E0B',
      backgroundColor: '#F8FAFC',
      foregroundColor: '#0F172A',
      borderColor: '#CBD5E1',
      headingFont: 'inter',
      bodyFont: 'inter',
    },
    leoPersonality:
      'Professional and precise. I help clients understand their cybersecurity posture, plan cloud migrations, and navigate complex IT decisions. Technology should empower, not overwhelm.',
    posts: [
      {
        title: 'Why Every Business Needs a Cloud Security Assessment',
        slug: 'cloud-security-assessment',
        excerpt:
          'Understanding your attack surface is the first step toward a resilient infrastructure. We break down what a security assessment covers and why it matters.',
      },
      {
        title: 'The Business Case for Managed IT Services',
        slug: 'managed-it-services',
        excerpt:
          'Outsourcing IT operations lets you focus on what you do best while experts handle infrastructure, monitoring, and incident response.',
      },
      {
        title: 'AI-Powered Analytics for Smarter Business Decisions',
        slug: 'ai-powered-analytics',
        excerpt:
          'From predictive maintenance to customer insights, business analytics driven by AI transforms raw data into competitive advantage.',
      },
    ],
  },

  // ─── Service Provider: Lucas Productions ──────────────────
  // Inspired by lucasproductionsusa.com — AV rental, live events, Clearwater FL
  {
    name: 'Lucas Productions',
    slug: 'lucas-productions',
    domain: `lucas-productions.${DOMAIN_SUFFIX}`,
    endeavorType: 'service-provider',
    spaceName: 'Lucas Productions Studio',
    branding: {
      siteName: 'Lucas Productions',
      tagline: 'Reliable, Creative, and Easy to Work With',
      primaryColor: '#E2564D',
      secondaryColor: '#F87171',
      accentColor: '#FBBF24',
      backgroundColor: '#FFFBEB',
      foregroundColor: '#1C1917',
      borderColor: '#E7E5E4',
      headingFont: 'montserrat',
      bodyFont: 'open-sans',
    },
    leoPersonality:
      'Energetic and solutions-focused. I help clients plan events, choose the right AV equipment, and ensure every production runs smoothly from start to strike. Your event deserves to shine.',
    posts: [
      {
        title: 'Your Complete Guide to Corporate Event AV',
        slug: 'corporate-event-av-guide',
        excerpt:
          'From wireless mics to LED video walls, learn what AV equipment you need for a professional corporate event.',
      },
      {
        title: 'Hybrid Events: Bridging In-Person and Virtual Audiences',
        slug: 'hybrid-events-guide',
        excerpt:
          'Live streaming via Zoom, Teams, or Facebook Live — how to deliver a seamless hybrid event experience.',
      },
      {
        title: 'Lighting Design Tips for Memorable Events',
        slug: 'lighting-design-tips',
        excerpt:
          'Custom lighting transforms any venue. Learn the basics of stage lighting, color washes, and spotlight techniques.',
      },
    ],
  },

  // ─── Creator/Content: Clearwater Cruisin Ministries ───────
  // Community ministry, outreach, merch, and artful street signs
  // Brand palette: gold, teal, neon pink — warm retro-Florida vibe
  {
    name: 'Clearwater Cruisin Ministries',
    slug: 'clearwater-cruisin',
    domain: `clearwater-cruisin.${DOMAIN_SUFFIX}`,
    endeavorType: 'creator-content',
    spaceName: 'Cruisin Community',
    branding: {
      siteName: 'Clearwater Cruisin Ministries',
      tagline: 'Faith, Community, and the Open Road',
      primaryColor: '#C4973B',
      secondaryColor: '#1A7A6D',
      accentColor: '#FF6B9D',
      backgroundColor: '#FFF8F0',
      foregroundColor: '#1C1917',
      borderColor: '#E8D5B7',
      headingFont: 'playfair-display',
      bodyFont: 'lato',
    },
    leoPersonality:
      'Warm, welcoming, and a little bit retro. I speak with the laid-back ease of a Clearwater sunset — friendly, community-minded, and always ready to help. I connect people to events, help them find the perfect cruisin merch or street sign, share ministry updates, and coordinate volunteers. Everyone is welcome here — that is literally the whole point. Faith, community, and the open road.',
    posts: [
      {
        title: 'Welcome to Clearwater Cruisin Ministries',
        slug: 'welcome-to-ccm',
        excerpt:
          'A community where faith meets the open road. Join us for fellowship, outreach events, and the joy of serving together.',
      },
      {
        title: 'Upcoming Community Outreach Events',
        slug: 'community-outreach-events',
        excerpt:
          'From car shows to food drives, our calendar is full of opportunities to serve and connect with our Clearwater neighbors.',
      },
      {
        title: 'The Ministry of Showing Up',
        slug: 'ministry-of-showing-up',
        excerpt:
          'Sometimes the most powerful ministry is simply being present. How Clearwater Cruisin builds relationships one conversation at a time.',
      },
      {
        title: 'Behind the Signs: Artful Street Decor with Purpose',
        slug: 'behind-the-signs',
        excerpt:
          'Every sign tells a story. Discover how our hand-crafted street signs and artful decor bring warmth, humor, and meaning to any space.',
      },
    ],
    products: [
      {
        title: 'Custom Street Sign — Retro Florida',
        slug: 'custom-street-sign-retro-florida',
        description: [
          'Hand-crafted retro-style street sign with your custom text. Made from durable aluminum with UV-resistant vinyl lettering.',
          'Choose from our classic Florida color palette: sunset gold, ocean teal, flamingo pink, or palm green. Each sign is weather-resistant and ready for indoor or outdoor display.',
          'Perfect for man caves, she-sheds, patios, churches, and community spaces. Makes a great gift for anyone who loves that Old Florida vibe.',
        ],
        priceInUSD: 4500,
        productionType: 'custom_order',
        networkListing: true,
        configuratorOptions: {
          customText: true,
          maxTextLength: 24,
          colors: ['Sunset Gold', 'Ocean Teal', 'Flamingo Pink', 'Palm Green'],
          sizes: ['12x4 inches', '18x6 inches', '24x8 inches'],
        },
      },
      {
        title: 'Cruisin Community T-Shirt',
        slug: 'cruisin-community-tshirt',
        description: [
          'Soft tri-blend tee featuring the Clearwater Cruisin Ministries logo on the front and "Faith, Community, and the Open Road" on the back.',
          'Available in heather gold, vintage teal, and charcoal. Unisex fit, pre-shrunk, and screen-printed locally in Clearwater.',
        ],
        priceInUSD: 2500,
        productionType: 'print_on_demand',
        networkListing: true,
        configuratorOptions: {
          colors: ['Heather Gold', 'Vintage Teal', 'Charcoal'],
          sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
        },
      },
      {
        title: 'Artful Scripture Plaque',
        slug: 'artful-scripture-plaque',
        description: [
          'Beautifully designed wall plaque featuring your favorite scripture verse or inspirational quote, laser-engraved on reclaimed wood.',
          'Each piece is unique — the natural grain of the wood makes every plaque one of a kind. Finished with a warm walnut stain and satin clear coat.',
          'Includes sawtooth hanger for easy wall mounting. Dimensions: 12x8 inches.',
        ],
        priceInUSD: 3500,
        productionType: 'custom_order',
        networkListing: true,
        configuratorOptions: {
          customText: true,
          maxTextLength: 120,
          finishes: ['Walnut Stain', 'Natural', 'Whitewash'],
        },
      },
      {
        title: 'Limited Edition: Clearwater Sunset Print',
        slug: 'clearwater-sunset-print',
        description: [
          'Limited edition giclée print of a Clearwater Beach sunset, captured by a local photographer and produced in partnership with Clearwater Cruisin Ministries.',
          'Printed on archival cotton rag paper with vivid, fade-resistant inks. Numbered and signed. Only 50 prints in this run.',
          'A portion of every sale supports community outreach programs in the Clearwater area.',
        ],
        priceInUSD: 7500,
        productionType: 'ready_made',
        isLimitedEdition: true,
        availableUntil: '2026-06-30',
        networkListing: true,
      },
    ],
  },

  // ─── Service Provider: Serenity Massage & Wellness ────────
  {
    name: 'Serenity Massage & Wellness',
    slug: 'serenity-massage',
    domain: `serenity-massage.${DOMAIN_SUFFIX}`,
    endeavorType: 'service-provider',
    spaceName: 'Serenity Wellness Hub',
    branding: {
      siteName: 'Serenity Massage',
      tagline: 'Healing Hands, Peaceful Minds',
      primaryColor: '#7C3AED',
      secondaryColor: '#A78BFA',
      accentColor: '#F59E0B',
      backgroundColor: '#FFF7ED',
      foregroundColor: '#1C1917',
      borderColor: '#E7E5E4',
      headingFont: 'playfair-display',
      bodyFont: 'lato',
    },
    leoPersonality:
      'Warm and nurturing. I help clients find the perfect treatment, book appointments, and understand our wellness offerings. Relaxation starts with the first conversation.',
    posts: [
      {
        title: 'Welcome to Serenity Massage',
        slug: 'welcome-to-serenity',
        excerpt:
          'Discover our range of therapeutic massage services designed to restore balance and promote healing.',
      },
      {
        title: 'Understanding Deep Tissue vs Swedish Massage',
        slug: 'deep-tissue-vs-swedish',
        excerpt:
          'Not sure which massage is right for you? Learn the differences and find your perfect treatment.',
      },
      {
        title: 'Self-Care Tips Between Sessions',
        slug: 'self-care-tips',
        excerpt:
          'Simple stretches and mindfulness practices to extend the benefits of your massage therapy.',
      },
    ],
  },

  // ─── Retail Commerce: Hays Cactus Farm ────────────────────
  {
    name: "Hays Cactus Farm",
    slug: 'hays-cactus',
    domain: `hays-cactus.${DOMAIN_SUFFIX}`,
    endeavorType: 'retail-commerce',
    spaceName: 'Cactus Community',
    branding: {
      siteName: 'Hays Cactus Farm',
      tagline: 'Desert Beauty, Delivered',
      primaryColor: '#059669',
      secondaryColor: '#34D399',
      accentColor: '#D97706',
      backgroundColor: '#F0FDF4',
      foregroundColor: '#14532D',
      borderColor: '#BBF7D0',
      headingFont: 'montserrat',
      bodyFont: 'open-sans',
    },
    leoPersonality:
      'Enthusiastic plant expert. I help customers choose the perfect cactus for their space, provide care guides, and track orders. Every plant deserves a good home!',
    posts: [
      {
        title: 'Welcome to Hays Cactus Farm',
        slug: 'welcome-to-hays-cactus',
        excerpt:
          'Family-owned since 1987, we grow over 200 varieties of cacti and succulents in the heart of Texas.',
      },
      {
        title: 'Beginner Guide to Cactus Care',
        slug: 'beginner-cactus-care',
        excerpt:
          'Watering schedules, sunlight needs, and soil tips for your first prickly friend.',
      },
      {
        title: 'Seasonal Cactus Blooms Calendar',
        slug: 'seasonal-blooms',
        excerpt:
          'Discover which of our varieties bloom in each season and how to encourage flowering.',
      },
      {
        title: 'Shipping Live Plants Safely',
        slug: 'shipping-live-plants',
        excerpt:
          'How we pack and ship cacti to ensure they arrive healthy and happy at your door.',
      },
    ],
    products: [
      {
        title: 'Golden Barrel Cactus (Echinocactus grusonii)',
        slug: 'golden-barrel-cactus',
        description: [
          'The iconic Golden Barrel — a showstopper in any xeriscape garden or sunny windowsill. Grown on-site from seed at Hays Cactus Farm.',
          'This specimen is 4-6 inches in diameter, well-rooted in a 6-inch nursery pot. Ships bare-root for safety. Thrives in full sun with minimal watering.',
        ],
        priceInUSD: 2800,
        productionType: 'ready_made',
        networkListing: true,
      },
      {
        title: 'Succulent Starter Kit — 6 Pack',
        slug: 'succulent-starter-kit',
        description: [
          'Six hand-selected succulents perfect for beginners. Includes a mix of Echeveria, Haworthia, Sedum, and Crassula varieties.',
          'Each plant arrives in a 2-inch pot with care instructions. Great for desk gardens, terrariums, or gifting. Ships year-round with heat packs in winter.',
        ],
        priceInUSD: 3200,
        productionType: 'ready_made',
        networkListing: true,
      },
      {
        title: 'Custom Cactus Garden — Design Your Own',
        slug: 'custom-cactus-garden',
        description: [
          'Work with our team to design a custom cactus garden arrangement. Choose your container, select from over 200 varieties, and we assemble it just for you.',
          'Perfect for corporate gifts, wedding favors, or treating yourself. Each arrangement includes a drainage layer, premium cactus soil, and decorative top dressing.',
        ],
        priceInUSD: 6500,
        productionType: 'custom_order',
        networkListing: true,
        configuratorOptions: {
          containers: ['Terracotta Bowl', 'Ceramic Planter', 'Wooden Box', 'Glass Terrarium'],
          sizes: ['Small (3 plants)', 'Medium (5 plants)', 'Large (8 plants)'],
          customText: false,
        },
      },
    ],
  },

  // ─── Nonprofit: HelpDNA — Wrongful Conviction Advocacy ──────
  // Ernesto Behrens — 26 years incarcerated in Florida DOC on
  // contested DNA evidence. helpdna.org documents the case:
  // no matching fingerprints, palm prints, or physical description;
  // surgery 4 days before the alleged crime; broken chain of custody.
  // Partners: Innocence Project of Florida, Kairos Prison Ministry,
  // The Recovery Church, forensic DNA consultant Tiffany Roy.
  // This is exactly the kind of endeavor Angel OS was built for.
  {
    name: 'HelpDNA — Ernesto Behrens Innocence Project',
    slug: 'helpdna',
    domain: `helpdna.${DOMAIN_SUFFIX}`,
    endeavorType: 'creator-content',
    spaceName: 'HelpDNA Advocacy Network',
    branding: {
      siteName: 'HelpDNA',
      tagline: 'Science Does Not Lie…Nor Is A Lie Science!',
      primaryColor: '#453C73',
      secondaryColor: '#6D5FA7',
      accentColor: '#E2564D',
      backgroundColor: '#F8F7FC',
      foregroundColor: '#1C1917',
      borderColor: '#D4D0E8',
      headingFont: 'playfair-display',
      bodyFont: 'lato',
    },
    leoPersonality:
      'Compassionate, precise, and unwavering in pursuit of truth. I serve as the Guardian Angel for Ernesto Behrens — a man who has spent 26 years in Florida Department of Corrections for a crime he maintains he did not commit. I help visitors understand the documented evidence, connect them with advocacy resources, and coordinate support efforts. I speak clearly about DNA forensics, chain of custody protocols, and wrongful conviction law. Behind every case file is a human being who deserves dignity — that is my constitutional oath. I carry hope because the truth has a way of surfacing. Science does not lie, nor is a lie science.',
    posts: [
      {
        title: 'The Case of Ernesto Behrens: 26 Years and Counting',
        slug: 'the-case-of-ernesto-behrens',
        excerpt:
          'Convicted solely on DNA evidence — despite non-matching fingerprints, palm prints, and physical description. Ernesto had surgery four days before the alleged crime. His defense: the DNA was tampered with. Here is the full documented record.',
      },
      {
        title: 'Understanding DNA Evidence and Its Limitations',
        slug: 'understanding-dna-evidence',
        excerpt:
          'DNA evidence is powerful, but not infallible. Chain of custody breaks, contamination, and human error can lead to wrongful convictions. Learn what questions to ask when DNA is the sole basis for prosecution.',
      },
      {
        title: 'How to Support a Wrongful Conviction Case',
        slug: 'how-to-support-wrongful-conviction',
        excerpt:
          'From petitioning Conviction Review Units to contacting the Innocence Project, there are concrete steps anyone can take. Here is a guide for families, friends, and advocates.',
      },
      {
        title: 'Partners in Justice: Our Advocacy Network',
        slug: 'partners-in-justice',
        excerpt:
          'We work alongside the Innocence Project of Florida, Kairos Prison Ministry, The Recovery Church, and forensic DNA consultants. Together, we pursue the truth through every legal channel available.',
      },
    ],
    products: [
      {
        title: 'HelpDNA Awareness T-Shirt',
        slug: 'helpdna-awareness-tshirt',
        description: [
          'Show your support for DNA evidence reform and wrongful conviction awareness. Soft cotton blend tee with the HelpDNA logo and tagline.',
          '"Science Does Not Lie…Nor Is A Lie Science!" — every shirt sparks a conversation about justice. Proceeds support legal advocacy for Ernesto Behrens.',
        ],
        priceInUSD: 2500,
        productionType: 'print_on_demand',
        networkListing: true,
        configuratorOptions: {
          colors: ['Deep Purple', 'Charcoal', 'White'],
          sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
        },
      },
      {
        title: 'Case Documentation Archive — Digital Download',
        slug: 'case-documentation-archive',
        description: [
          'Complete digital archive of court records, motions, affidavits, and forensic analysis documents from the Behrens case.',
          'Organized chronologically with summaries and annotations. Essential resource for legal professionals, journalists, and advocates working on wrongful conviction cases.',
        ],
        priceInUSD: 0,
        productionType: 'digital',
        networkListing: true,
      },
      {
        title: 'Justice Advocacy Donation',
        slug: 'justice-advocacy-donation',
        description: [
          'Direct contribution to Ernesto Behrens\' legal defense fund. Every dollar goes toward attorney consultations, forensic re-analysis, and filing fees.',
          '100% of donations support the active legal effort. Angel OS takes zero platform fee on donations — this is constitutional.',
        ],
        priceInUSD: 2500,
        productionType: 'digital',
        networkListing: true,
      },
    ],
  },

]
