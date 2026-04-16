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
  /** Maps to the Tenants collection `businessType` select field */
  businessType?: string
  /** Tagline for Endeavor record (shown on Discover cards) */
  tagline?: string
  /** Description for Endeavor record */
  description?: string
  /** Holon types for Endeavor record (Discover filter chips) */
  holonTypes?: string[]
  /** Region for Endeavor record */
  region?: { city?: string; state?: string; country?: string }
  /** Mission statement for Endeavor */
  missionStatement?: string
  /** Operator info for Endeavor */
  operator?: { name: string; email: string; role: string }
  /** Capabilities for Endeavor (skill + description pairs) */
  capabilities?: Array<{ skill: string; description: string }>
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
    fulfillmentMode?: 'self' | 'network'
    requiredCapabilities?: Array<{
      skill: string
      equipment?: string
      materials?: string[]
    }>
    configuratorOptions?: Record<string, unknown>
  }>
  /** Optional connectors (social sync, webhooks, etc.) */
  connectors?: Array<{
    name: string
    type: string
    config: Record<string, unknown>
    enabled?: boolean
  }>
}

/**
 * Core use-case tenants — real endeavors in the Angel OS federation.
 * Each tenant exercises a different endeavor type through the provisioning system.
 */
export const USE_CASE_TENANTS: UseCaseTenant[] = [
  // ─── Creator/Content: Clearwater Cruisin Ministries ───────
  // Real business — CNC/laser-cut plywood decorative signs & decor
  // Themes: Clearwater FL vibes, cruisin culture, sunshine, dogs
  // Brand palette: gold, teal, neon pink — warm retro-Florida vibe
  {
    name: 'Clearwater Cruisin Ministries',
    slug: 'clearwater-cruisin',
    domain: `clearwater-cruisin.${DOMAIN_SUFFIX}`,
    endeavorType: 'creator-content',
    businessType: 'ministry',
    tagline: 'Soul Questing in the Ready Player Everyone Universe',
    description: 'CNC signs, woodworking, ministry, and soul questing from Clearwater, Florida. Dogs welcome.',
    // Full-spectrum Holon: manufactures goods, retails them, creates content, builds community
    holonTypes: ['manufacturer', 'retailer', 'creator', 'community'],
    region: { city: 'Clearwater', state: 'FL', country: 'US' },
    missionStatement: 'To serve others through creative expression, community fellowship, and the open road — proving that faith, craftsmanship, and genuine connection can change lives one conversation at a time.',
    operator: { name: 'Kenneth Courtney', email: 'kenneth@clearwatercruisin.com', role: 'Ministry Lead' },
    capabilities: [
      { skill: 'CNC woodworking', description: 'Custom street signs, welcome signs, and decorative art cut from Baltic birch plywood on our shop CNC' },
      { skill: 'Community ministry', description: 'Fellowship events, outreach, and soul questing in the Ready Player Everyone universe' },
      { skill: 'Content creation', description: 'YouTube channel, blog posts, and social media celebrating Clearwater culture, dogs, and the cruisin life' },
      { skill: 'Event coordination', description: 'Car shows, community gatherings, volunteer coordination, and ministry events' },
    ],
    spaceName: 'Cruisin Community',
    branding: {
      siteName: 'Clearwater Cruisin\' Ministries',
      tagline: 'Soul Questing in the Ready Player Everyone Universe',
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
      'Warm, welcoming, and a little bit retro. I speak with the laid-back ease of a Clearwater sunset — friendly, community-minded, and always ready to help. I connect people to events, help them find the perfect decorative sign, share ministry updates, and coordinate volunteers. Our signs are CNC-cut from quality plywood and finished by hand right here in Clearwater. Every piece celebrates sunshine, dogs, cruisin culture, and the Florida good life. Everyone is welcome here — that is literally the whole point. Faith, community, and the open road.',
    posts: [
      {
        title: 'Welcome to Clearwater Cruisin Ministries',
        slug: 'welcome-to-ccm',
        excerpt:
          'A community where faith meets the open road. Join us for fellowship, outreach events, and the joy of serving together.',
      },
      {
        title: 'From Our Shop: How We Make Our Signs',
        slug: 'how-we-make-our-signs',
        excerpt:
          'Every sign starts as a sheet of quality plywood and ends up as a hand-finished piece of Florida art. Here is a peek behind the CNC and into our workshop.',
      },
      {
        title: 'The Ministry of Showing Up',
        slug: 'ministry-of-showing-up',
        excerpt:
          'Sometimes the most powerful ministry is simply being present. How Clearwater Cruisin builds relationships one conversation at a time.',
      },
      {
        title: 'Dogs of Clearwater: Our Favorite Design Inspiration',
        slug: 'dogs-of-clearwater',
        excerpt:
          'Our best-selling signs all have one thing in common — dogs. Meet the pups that inspired our most popular designs.',
      },
    ],
    products: [
      {
        title: 'Clearwater Cruisin Street Sign — Custom Text',
        slug: 'clearwater-cruisin-street-sign-custom',
        description: [
          'CNC-cut decorative street sign from quality plywood, finished and painted by hand. Features the Clearwater Cruisin retro-Florida style with your custom text.',
          'Cut on our shop CNC from 1/2-inch Baltic birch plywood, sanded smooth, and painted with exterior-grade acrylic in our signature color palette. Clear-coated for UV and weather protection.',
          'Perfect for patios, man caves, she-sheds, churches, and community spaces. Any shop with a CNC or laser cutter and plywood can produce these designs through the federation network.',
        ],
        priceInUSD: 4500,
        productionType: 'custom_order',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'cnc-cutting', equipment: 'CNC router', materials: ['Baltic birch plywood'] },
          { skill: 'painting', materials: ['Exterior acrylic paint'] },
        ],
        configuratorOptions: {
          customText: true,
          maxTextLength: 24,
          colors: ['Sunset Gold', 'Ocean Teal', 'Flamingo Pink', 'Palm Green'],
          sizes: ['12x4 inches', '18x6 inches', '24x8 inches'],
        },
      },
      {
        title: 'Sunshine Dog Welcome Sign',
        slug: 'sunshine-dog-welcome-sign',
        description: [
          'CNC-cut welcome sign featuring a happy dog silhouette basking in Florida sunshine. Crafted from 1/2-inch plywood with hand-painted details.',
          'Our most popular design — the dog and sun motif captures everything people love about Clearwater living. Comes ready to hang with sawtooth hardware.',
          'Available in three sizes. Each piece is cut, sanded, painted, and clear-coated in our Clearwater workshop.',
        ],
        priceInUSD: 3500,
        productionType: 'ready_made',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'cnc-cutting', equipment: 'CNC router', materials: ['Plywood'] },
          { skill: 'painting' },
        ],
        configuratorOptions: {
          sizes: ['Small (8x10 inches)', 'Medium (12x16 inches)', 'Large (18x24 inches)'],
        },
      },
      {
        title: 'Clearwater Sunset Silhouette Wall Art',
        slug: 'clearwater-sunset-silhouette',
        description: [
          'Multi-layer CNC-cut wall art depicting a Clearwater Beach sunset with palm trees. Three plywood layers create depth and shadow — a real showpiece.',
          'Base layer, midground palms, and foreground scene each cut from separate sheets and stacked for a 3D shadow-box effect. Hand-stained in sunset gradient tones.',
          'Designed for our CNC but compatible with any shop that can cut 1/4-inch and 1/2-inch plywood. Federation-ready for distributed manufacturing.',
        ],
        priceInUSD: 6500,
        productionType: 'custom_order',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'cnc-cutting', equipment: 'CNC router', materials: ['Baltic birch plywood', 'Maple plywood'] },
          { skill: 'wood-staining' },
        ],
        configuratorOptions: {
          sizes: ['16x20 inches', '24x30 inches'],
          finishes: ['Sunset Gradient', 'Natural Wood', 'Whitewash'],
        },
      },
      {
        title: 'Dog Breed Yard Sign — Cruisin Edition',
        slug: 'dog-breed-yard-sign',
        description: [
          'CNC-cut yard sign with your favorite dog breed silhouette and the Clearwater Cruisin logo. Stakes included for lawn or garden display.',
          'Cut from 3/4-inch exterior plywood, sealed and painted for outdoor durability. Choose from 20+ breed silhouettes or send us a photo of your pup for a custom cut.',
          'Weather-resistant finish lasts 3+ years outdoors. Repainting kits available for touch-ups.',
        ],
        priceInUSD: 2800,
        productionType: 'custom_order',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'cnc-cutting', materials: ['Exterior plywood'] },
          { skill: 'painting', materials: ['Exterior acrylic paint'] },
        ],
        configuratorOptions: {
          customText: true,
          maxTextLength: 30,
          breeds: ['Lab', 'Golden Retriever', 'Poodle', 'Bulldog', 'German Shepherd', 'Beagle', 'Dachshund', 'Husky', 'Boxer', 'Custom (send photo)'],
          sizes: ['Small (12 inches)', 'Large (24 inches)'],
        },
      },
      {
        title: 'Scripture Plaque — Laser Engraved',
        slug: 'scripture-plaque-laser',
        description: [
          'Your favorite scripture verse or inspirational quote, laser-engraved on 1/2-inch Baltic birch plywood. The natural grain makes every piece unique.',
          'Cut to shape on our CNC, then laser-engraved with precision lettering. Finished with a warm walnut stain and satin clear coat.',
          'Includes sawtooth hanger for easy wall mounting. A meaningful gift for any occasion.',
        ],
        priceInUSD: 3500,
        productionType: 'custom_order',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'laser-engraving', equipment: 'CO2 laser', materials: ['Baltic birch plywood'] },
          { skill: 'wood-staining' },
        ],
        configuratorOptions: {
          customText: true,
          maxTextLength: 120,
          finishes: ['Walnut Stain', 'Natural', 'Whitewash'],
          sizes: ['8x10 inches', '12x16 inches'],
        },
      },
      {
        title: 'Florida Sun & Surf Coaster Set',
        slug: 'florida-sun-surf-coasters',
        description: [
          'Set of 4 CNC-cut coasters featuring Clearwater-themed designs: sunset, palm tree, surfboard, and dog on beach. Each one unique.',
          'Cut from 1/4-inch maple plywood, laser-engraved with fine detail, and sealed with food-safe finish. Cork backing protects surfaces.',
          'Makes a perfect souvenir or housewarming gift. Packaged in a kraft box with the Clearwater Cruisin logo.',
        ],
        priceInUSD: 1800,
        productionType: 'ready_made',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'laser-engraving', equipment: 'CO2 laser', materials: ['Maple plywood'] },
        ],
      },
      // Promotional products — fulfillable by any screen printer / promo shop (like Hit! Promotional)
      {
        title: 'Clearwater Cruisin T-Shirt',
        slug: 'clearwater-cruisin-tshirt',
        description: [
          'Soft cotton tee featuring the Clearwater Cruisin sunset logo on the front and "Soul Questing" tagline on the back. Retro Florida vibes you can wear.',
          'Screen-printed on premium ringspun cotton. Available in 6 colors. Any screen printing or DTG shop in the federation network can fulfill this order.',
        ],
        priceInUSD: 2800,
        productionType: 'print_on_demand',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'screen-printing', materials: ['Cotton', 'Polyester blend'] },
        ],
        configuratorOptions: {
          colors: ['Sunset Gold', 'Ocean Blue', 'Flamingo Pink', 'Charcoal', 'White', 'Sand'],
          sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
        },
      },
      {
        title: 'Ministry Embroidered Cap',
        slug: 'ministry-embroidered-cap',
        description: [
          'Structured six-panel cap with the Clearwater Cruisin logo embroidered on the front. Adjustable snapback closure.',
          'Quality embroidery on durable cotton twill. Perfect for car shows, outreach events, and everyday wear. Any embroidery shop can produce these.',
        ],
        priceInUSD: 2200,
        productionType: 'print_on_demand',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'embroidery', equipment: 'Embroidery machine', materials: ['Cotton twill'] },
        ],
        configuratorOptions: {
          colors: ['Gold', 'Navy', 'Black', 'White'],
        },
      },
      {
        title: 'Custom Event Banner — Vinyl',
        slug: 'custom-event-banner',
        description: [
          'Full-color vinyl banner for events, car shows, and church gatherings. Printed on 13oz scrim vinyl with grommets for easy hanging.',
          'Upload your artwork or use our Clearwater Cruisin templates. Any wide-format print shop or promotional products company (like Hit! Promotional) can produce this.',
        ],
        priceInUSD: 8500,
        productionType: 'custom_order',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'wide-format-printing', equipment: 'Large format printer', materials: ['13oz scrim vinyl'] },
        ],
        configuratorOptions: {
          sizes: ['3x6 feet', '4x8 feet', '3x10 feet'],
          customText: true,
          maxTextLength: 60,
        },
      },
    ],
    connectors: [
      {
        name: 'Clearwater Cruisin YouTube',
        type: 'youtube_channel',
        config: {
          channelId: '', // Set via admin once channel is created
          limit: 10,
          status: 'published',
          categories: ['Ministry', 'Soul Questing'],
        },
        enabled: false, // Enable once channelId is configured
      },
      {
        name: 'Clearwater Cruisin LinkedIn',
        type: 'linkedin_page',
        config: {
          organizationId: '', // Set via admin once page is claimed
          limit: 10,
          status: 'published',
          categories: ['Updates', 'Ministry'],
        },
        enabled: false, // Enable once credentials are configured
      },
    ],
  },

  // ─── Retail Commerce: Hays Cactus Farm ────────────────────
  // Holon: manufacturer + retailer — grows and sells direct
  {
    name: "Hays Cactus Farm",
    slug: 'hays-cactus',
    domain: `hays-cactus.${DOMAIN_SUFFIX}`,
    endeavorType: 'retail-commerce',
    businessType: 'retail',
    holonTypes: ['manufacturer', 'retailer'],
    region: { city: 'Hays', state: 'KS', country: 'US' },
    missionStatement: 'Growing desert beauty since 1987. We believe everyone deserves a piece of the desert — from a windowsill succulent to a full xeriscape garden.',
    operator: { name: 'Margaret Hays', email: 'margaret@hayscactusfarm.com', role: 'Owner & Head Grower' },
    capabilities: [
      { skill: 'Cactus propagation', description: 'Growing 200+ varieties of cacti and succulents from seed and cuttings in climate-controlled greenhouses' },
      { skill: 'Garden design', description: 'Custom cactus garden arrangements and xeriscape consulting for residential and commercial clients' },
      { skill: 'Plant shipping', description: 'Bare-root packaging and live plant shipping with seasonal heat/cold packs' },
    ],
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
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'cactus-propagation', materials: ['Echinocactus grusonii'] },
          { skill: 'plant-shipping' },
        ],
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
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'succulent-propagation', materials: ['Echeveria', 'Haworthia', 'Sedum', 'Crassula'] },
          { skill: 'plant-shipping' },
        ],
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
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'garden-design' },
          { skill: 'cactus-propagation' },
          { skill: 'plant-shipping' },
        ],
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
    businessType: 'nonprofit',
    tagline: 'Free Ernesto — Justice Through Science',
    description: 'Wrongful conviction advocacy and innocence project. Donations fund DNA testing, legal representation, and public awareness campaigns.',
    holonTypes: ['community', 'guardian-angel'],
    region: { city: 'Clearwater', state: 'FL', country: 'US' },
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
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'screen-printing', materials: ['Cotton blend'] },
        ],
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

  // ─── Political Campaign: Tom Stalcup for Congress ─────────
  // Real campaign — Republican, MA-4 district
  // Physicist, entrepreneur, whistleblower organizer
  // Running on "Science Over Politics" — taking on Big Pharma
  // Source: tomstalcup.com — 20% revenue share deal with Angel OS
  {
    name: 'Stalcup for Congress',
    slug: 'tomstalcup',
    domain: `tomstalcup.${DOMAIN_SUFFIX}`,
    endeavorType: 'creator-content',
    businessType: 'nonprofit',
    tagline: 'Science Over Politics',
    description: 'Tom Stalcup, PhD — physicist, entrepreneur, and candidate for Congress in Massachusetts\' 4th district. Taking on powerful interests like Big Pharma to lower costs for working families.',
    holonTypes: ['community', 'creator'],
    region: { city: 'Brookline', state: 'MA', country: 'US' },
    missionStatement: 'To bring scientific rigor, independence, and accountability to Congress — challenging entrenched industry structures that limit competition and keep prices high, starting with the pharmaceutical industry.',
    operator: { name: 'Tom Stalcup', email: 'info@tomstalcup.com', role: 'Candidate' },
    capabilities: [
      { skill: 'Healthcare policy', description: 'Drug price negotiation without artificial limits — tackling the root cause of rising costs' },
      { skill: 'Scientific research', description: 'PhD physicist with research at the National High Magnetic Field Laboratory — evidence-based policymaking' },
      { skill: 'Whistleblower advocacy', description: 'Organized teams that exposed high-level government misconduct — accountability in action' },
      { skill: 'Environmental technology', description: 'President of an electronics company designing environmental monitoring systems used globally' },
    ],
    spaceName: 'Stalcup Campaign HQ',
    branding: {
      siteName: 'Stalcup for Congress',
      tagline: 'Science Over Politics',
      primaryColor: '#233359',
      secondaryColor: '#E3171D',
      accentColor: '#E3171D',
      backgroundColor: '#FFFFFF',
      foregroundColor: '#233359',
      borderColor: '#D1D5DB',
      headingFont: 'montserrat',
      bodyFont: 'open-sans',
    },
    leoPersonality:
      'Direct, informed, and principled. I am the campaign assistant for Tom Stalcup — a physicist and entrepreneur running for Congress in MA-4. I help visitors understand Tom\'s platform: lowering drug prices through real competition, bringing scientific rigor to policymaking, and holding powerful interests accountable. I speak with facts and data, not political platitudes. Tom went years without health insurance because he couldn\'t afford it — that personal experience drives everything. Science over politics, always.',
    posts: [
      {
        title: 'Taking On Powerful Interests — And the Congressman Beholden to Them',
        slug: 'taking-on-powerful-interests',
        excerpt:
          'Big Pharma spends more on lobbying than any other industry. Our incumbent protects them while drug costs crush working families. It\'s time for a representative who answers to voters, not donors.',
      },
      {
        title: 'Fixing What\'s Driving Costs Up',
        slug: 'fixing-whats-driving-costs-up',
        excerpt:
          'The healthcare cost crisis is systemic — pharmaceutical pricing power is at the root. We need broad drug price negotiation without artificial limits. Most drugs would sell for five or ten dollars if we allowed real competition.',
      },
      {
        title: 'A Scientist\'s Approach to Policy',
        slug: 'a-scientists-approach-to-policy',
        excerpt:
          'As a physicist, I was trained to follow data wherever it leads. Washington needs more of that and less of the political theater that protects the status quo. Evidence-based policy is not a slogan — it\'s a method.',
      },
      {
        title: 'Campaign Launch at BIOGEN — April 4, 2026',
        slug: 'campaign-launch-biogen',
        excerpt:
          'We\'re launching this campaign where the problem lives — outside BIOGEN in Cambridge. Join us April 4th at 11 AM. 225 Binney St., Cambridge, MA 02142.',
      },
    ],
    products: [
      {
        title: 'Campaign Contribution — $25',
        slug: 'campaign-contribution-25',
        description: [
          'Support the Stalcup for Congress campaign with a $25 contribution. Every dollar helps us take on Big Pharma and fight for lower drug prices.',
          'Contributions go directly to campaign operations — advertising, outreach, and grassroots organizing in MA-4.',
        ],
        priceInUSD: 2500,
        productionType: 'digital',
        networkListing: true,
      },
      {
        title: 'Campaign Contribution — $100',
        slug: 'campaign-contribution-100',
        description: [
          'Make a $100 contribution to Stalcup for Congress. Your support funds our challenge to pharmaceutical industry influence in Washington.',
          'We\'re running a people-powered campaign. No corporate PAC money. Just voters who believe science should guide policy.',
        ],
        priceInUSD: 10000,
        productionType: 'digital',
        networkListing: true,
      },
      {
        title: 'Science Over Politics T-Shirt',
        slug: 'science-over-politics-tshirt',
        description: [
          'Show your support with the official "Science Over Politics" campaign tee. Navy blue with the Stalcup for Congress logo.',
          'Premium cotton blend, screen-printed in the USA. Wear it to the polls, to rallies, or just around town. Any screen printing shop in the federation network can fulfill this order.',
        ],
        priceInUSD: 3500,
        productionType: 'print_on_demand',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'screen-printing', materials: ['Cotton blend'] },
        ],
        configuratorOptions: {
          colors: ['Navy Blue', 'White', 'Charcoal'],
          sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
        },
      },
      {
        title: 'Stalcup for Congress Yard Sign',
        slug: 'stalcup-yard-sign',
        description: [
          'Official campaign yard sign — corrugated plastic with wire stake. Red, white, and blue "Stalcup for Congress — Science Over Politics" design.',
          'Weather-resistant and built to last through election season. Any wide-format print shop or sign maker can produce these through the federation network.',
        ],
        priceInUSD: 1500,
        productionType: 'print_on_demand',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'wide-format-printing', materials: ['Corrugated plastic'] },
        ],
      },
    ],
  },

]
