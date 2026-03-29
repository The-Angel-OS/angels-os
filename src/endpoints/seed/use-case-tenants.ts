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
 * Five use-case tenants demonstrating different endeavor types.
 * Inspired by real businesses — makes seed data feel like a real platform demo.
 */
export const USE_CASE_TENANTS: UseCaseTenant[] = [
  // ─── Service Provider: Celersoft Technology ────────────────
  // Inspired by celersoft.com — IT consulting, cybersecurity, cloud
  // Holon: manufacturer (digital services) — single-facet specialist
  {
    name: 'Celersoft Technology',
    slug: 'celersoft',
    domain: `celersoft.${DOMAIN_SUFFIX}`,
    endeavorType: 'service-provider',
    businessType: 'professional_services',
    tagline: 'Accelerating Digital Transformation',
    description: 'IT consulting, cybersecurity assessments, and cloud migration services for businesses ready to modernize.',
    holonTypes: ['manufacturer'],
    region: { city: 'Clearwater', state: 'FL', country: 'US' },
    missionStatement: 'To democratize enterprise-grade cybersecurity and cloud infrastructure for small businesses who deserve the same protection as Fortune 500 companies.',
    operator: { name: 'Marcus Rivera', email: 'marcus@celersoft.com', role: 'Founder & CTO' },
    capabilities: [
      { skill: 'Cybersecurity assessment', description: 'Penetration testing, vulnerability scanning, and compliance audits for small-to-mid businesses' },
      { skill: 'Cloud migration', description: 'AWS, Azure, and GCP migration planning and execution with zero-downtime cutover' },
      { skill: 'Web development', description: 'Full-stack development, API design, and custom business applications' },
      { skill: 'IT managed services', description: 'Monitoring, incident response, patching, and 24/7 helpdesk' },
    ],
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
    products: [
      {
        title: 'Website Security Audit',
        slug: 'website-security-audit',
        description: [
          'Comprehensive security assessment of your website and web applications. Includes vulnerability scanning, OWASP Top 10 analysis, and a prioritized remediation report.',
          'Delivered as a detailed PDF report with executive summary and technical findings. Includes a 30-minute video walkthrough of results.',
        ],
        priceInUSD: 49900,
        productionType: 'digital',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [{ skill: 'cybersecurity-assessment' }],
      },
      {
        title: 'Business Website Starter Package',
        slug: 'business-website-starter',
        description: [
          'A professionally designed, mobile-responsive business website. Includes up to 5 pages, contact form, SEO basics, and Google Analytics setup.',
          'Built on modern frameworks and deployed to fast, global CDN. Perfect for small businesses getting online for the first time.',
        ],
        priceInUSD: 199900,
        productionType: 'custom_order',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [{ skill: 'web-development' }],
      },
      {
        title: 'Cloud Migration Assessment',
        slug: 'cloud-migration-assessment',
        description: [
          'Planning to move to the cloud? We evaluate your current infrastructure, identify migration candidates, and deliver a phased migration roadmap.',
          'Covers cost analysis, security implications, and downtime planning. Includes recommendations for AWS, Azure, or GCP based on your specific workloads.',
        ],
        priceInUSD: 79900,
        productionType: 'digital',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [{ skill: 'cloud-migration' }],
      },
    ],
  },

  // ─── Service Provider: Lucas Productions ──────────────────
  // Inspired by lucasproductionsusa.com — AV rental, live events, Clearwater FL
  // Holon: manufacturer + retailer + creator — full-spectrum production house
  {
    name: 'Lucas Productions',
    slug: 'lucas-productions',
    domain: `lucas-productions.${DOMAIN_SUFFIX}`,
    endeavorType: 'service-provider',
    businessType: 'service',
    tagline: 'Reliable, Creative, and Easy to Work With',
    description: 'Full-service AV production — corporate events, weddings, livestreams, LED video walls, and stage lighting.',
    holonTypes: ['manufacturer', 'retailer', 'creator'],
    region: { city: 'Clearwater', state: 'FL', country: 'US' },
    missionStatement: 'Every event tells a story. We provide the stage, the lights, the sound, and the crew to make that story unforgettable — from intimate gatherings to arena-scale productions.',
    operator: { name: 'David Lucas', email: 'david@lucasproductionsusa.com', role: 'Owner & Lead Producer' },
    capabilities: [
      { skill: 'AV production', description: 'Sound systems, video walls, projectors, and full AV packages for events of any scale' },
      { skill: 'Stage lighting', description: 'Custom lighting design, LED fixtures, spotlights, and DMX programming for concerts and corporate events' },
      { skill: 'Livestreaming', description: 'Multi-camera livestream production via Zoom, Teams, YouTube, and Facebook Live with real-time switching' },
      { skill: 'Event coordination', description: 'End-to-end event production management from load-in through strike' },
      { skill: 'Video production', description: 'Promotional videos, event recaps, and corporate content creation' },
    ],
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
    products: [
      {
        title: 'Corporate Event AV Package',
        slug: 'corporate-event-av-package',
        description: [
          'Complete AV solution for corporate events: PA system, wireless microphones, LED video wall, and on-site technician. Covers venues up to 500 attendees.',
          'Includes setup, soundcheck, live operation, and strike. We bring the gear, the crew, and the expertise. Any AV production company in the federation network can fulfill this package.',
        ],
        priceInUSD: 350000,
        productionType: 'custom_order',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'av-production', equipment: 'PA system' },
          { skill: 'stage-lighting', equipment: 'LED fixtures' },
        ],
      },
      {
        title: 'Wedding Livestream Package',
        slug: 'wedding-livestream-package',
        description: [
          'Two-camera livestream of your wedding ceremony with professional audio capture, real-time switching, and a shareable replay link within 24 hours.',
          'Perfect for guests who cannot attend in person. Streamed to your choice of platform (Zoom, YouTube, or private link). Includes highlight reel edit.',
        ],
        priceInUSD: 150000,
        productionType: 'custom_order',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'livestreaming', equipment: 'Multi-camera rig' },
          { skill: 'video-production' },
        ],
      },
      {
        title: 'Promotional Video — 60 Second Spot',
        slug: 'promo-video-60-second',
        description: [
          'A polished 60-second promotional video for your business, product, or event. Includes scripting, one day of shooting, professional editing, color grading, and music licensing.',
          'Delivered in 4K with versions optimized for social media, website, and broadcast. Any video production team in the network can produce this to our quality standards.',
        ],
        priceInUSD: 250000,
        productionType: 'custom_order',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [{ skill: 'video-production', equipment: 'Cinema camera' }],
      },
    ],
  },

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

  // ─── Service Provider: Serenity Massage & Wellness ────────
  // Holon: retailer — single-facet specialist (sells services, doesn't manufacture goods)
  {
    name: 'Serenity Massage & Wellness',
    slug: 'serenity-massage',
    domain: `serenity-massage.${DOMAIN_SUFFIX}`,
    endeavorType: 'service-provider',
    businessType: 'service',
    tagline: 'Healing Hands, Peaceful Minds',
    description: 'Licensed massage therapy and wellness services. Relaxation, deep tissue, and therapeutic treatments.',
    holonTypes: ['retailer'],
    region: { city: 'Clearwater', state: 'FL', country: 'US' },
    missionStatement: 'To restore body and mind through skilled therapeutic touch — making wellness accessible to everyone in our community, not just those who can afford spa prices.',
    operator: { name: 'Elena Vasquez', email: 'elena@serenitymassage.com', role: 'Licensed Massage Therapist & Owner' },
    capabilities: [
      { skill: 'Massage therapy', description: 'Swedish, deep tissue, sports, prenatal, and hot stone massage by licensed therapists' },
      { skill: 'Wellness coaching', description: 'Personalized stretching routines, posture analysis, and self-care guidance between sessions' },
    ],
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
    products: [
      {
        title: '60-Minute Swedish Massage',
        slug: 'swedish-massage-60',
        description: [
          'A classic full-body Swedish massage designed to relax muscles, improve circulation, and melt away stress. Long flowing strokes with medium pressure.',
          'Perfect for first-time massage clients or anyone seeking deep relaxation. Includes aromatherapy with essential oils. Any licensed massage therapist in the federation network can fulfill this service.',
        ],
        priceInUSD: 8500,
        productionType: 'custom_order',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'massage-therapy', equipment: 'Massage table' },
        ],
      },
      {
        title: '90-Minute Deep Tissue Massage',
        slug: 'deep-tissue-massage-90',
        description: [
          'Therapeutic deep tissue massage targeting chronic tension, knots, and problem areas. Firm pressure with focused work on specific muscle groups.',
          'Recommended for athletes, desk workers, and anyone with persistent pain or limited range of motion. Includes hot towel application.',
        ],
        priceInUSD: 12000,
        productionType: 'custom_order',
        networkListing: true,
        fulfillmentMode: 'network',
        requiredCapabilities: [
          { skill: 'deep-tissue-massage', equipment: 'Massage table' },
        ],
      },
      {
        title: 'Wellness Gift Card',
        slug: 'wellness-gift-card',
        description: [
          'Give the gift of relaxation. Digital gift card redeemable for any service at Serenity Massage & Wellness.',
          'Delivered instantly via email with a beautiful branded card design. Never expires. Transferable within the federation network to any participating wellness provider.',
        ],
        priceInUSD: 10000,
        productionType: 'digital',
        networkListing: true,
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

]
