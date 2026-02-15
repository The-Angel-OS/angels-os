/**
 * Use-case tenant definitions for the seed process.
 * Each tenant exercises a different endeavor type through the provisioning system.
 * These demonstrate what Angel OS can do for different business types.
 */
import type { EndeavorType } from '@/utilities/spaceProvisioning'

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
}

/**
 * Five use-case tenants — one per endeavor type.
 * Names from the examples in SPACE_TEMPLATES.
 */
export const USE_CASE_TENANTS: UseCaseTenant[] = [
  // ─── Service Provider: Serenity Massage ─────────────────────
  {
    name: 'Serenity Massage & Wellness',
    slug: 'serenity-massage',
    domain: 'serenity-massage.angelos.local',
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

  // ─── Retail Commerce: Hays Cactus Farm ──────────────────────
  {
    name: "Hays Cactus Farm",
    slug: 'hays-cactus',
    domain: 'hays-cactus.angelos.local',
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
  },

  // ─── Creator Content: Clearwater Tours ──────────────────────
  {
    name: 'Clearwater Cruisin Tours',
    slug: 'clearwater-tours',
    domain: 'clearwater-tours.angelos.local',
    endeavorType: 'creator-content',
    spaceName: 'Cruisin Community',
    branding: {
      siteName: 'Clearwater Cruisin',
      tagline: 'Explore the Gulf Coast',
      primaryColor: '#0284C7',
      secondaryColor: '#38BDF8',
      accentColor: '#F97316',
      backgroundColor: '#F0F9FF',
      foregroundColor: '#0C4A6E',
      borderColor: '#BAE6FD',
      headingFont: 'raleway',
      bodyFont: 'inter',
    },
    leoPersonality:
      'Adventurous and knowledgeable local guide. I help visitors plan their perfect Gulf Coast experience, share insider tips, and book unforgettable tours.',
    posts: [
      {
        title: 'Welcome to Clearwater Cruisin',
        slug: 'welcome-to-clearwater',
        excerpt:
          'Your gateway to the best boat tours, dolphin watching, and sunset cruises on the Gulf Coast.',
      },
      {
        title: 'Top 5 Hidden Gems of Clearwater Beach',
        slug: 'hidden-gems-clearwater',
        excerpt:
          'Skip the tourist traps and discover the spots the locals love most.',
      },
      {
        title: 'Dolphin Watching Season Guide',
        slug: 'dolphin-watching-guide',
        excerpt:
          'When, where, and how to see bottlenose dolphins in their natural habitat.',
      },
    ],
  },

  // ─── Booking Based: Booth Rental Co ─────────────────────────
  {
    name: 'The Booth Rental Co',
    slug: 'booth-rental',
    domain: 'booth-rental.angelos.local',
    endeavorType: 'booking-based',
    spaceName: 'Booth Scheduling',
    branding: {
      siteName: 'Booth Rental Co',
      tagline: 'Your Space, Your Schedule',
      primaryColor: '#DC2626',
      secondaryColor: '#F87171',
      accentColor: '#2563EB',
      backgroundColor: '#FEF2F2',
      foregroundColor: '#450A0A',
      borderColor: '#FECACA',
      headingFont: 'poppins',
      bodyFont: 'roboto',
    },
    leoPersonality:
      'Organized and efficient. I help stylists find and book the perfect booth, manage schedules, and handle rental agreements. Your business, your way.',
    posts: [
      {
        title: 'Welcome to Booth Rental Co',
        slug: 'welcome-booth-rental',
        excerpt:
          'Flexible booth rentals for stylists, barbers, and beauty professionals. Daily, weekly, or monthly.',
      },
      {
        title: 'How Booth Rental Works',
        slug: 'how-booth-rental-works',
        excerpt:
          'Everything you need to know about renting a booth — pricing, availability, and what is included.',
      },
    ],
  },

  // ─── Custom: KenDev.Co ──────────────────────────────────────
  {
    name: 'KenDev.Co',
    slug: 'kendev',
    domain: 'kendev.co',
    endeavorType: 'custom',
    spaceName: 'KenDev Workshop',
    branding: {
      siteName: 'KenDev.Co',
      tagline: 'Building the Future, One Angel at a Time',
      primaryColor: '#4F46E5',
      secondaryColor: '#818CF8',
      accentColor: '#10B981',
      backgroundColor: '#F5F3FF',
      foregroundColor: '#1E1B4B',
      borderColor: '#C7D2FE',
      headingFont: 'inter',
      bodyFont: 'source-sans-3',
    },
    leoPersonality:
      'Technical and creative. I help developers explore Angel OS, understand the architecture, and start contributing. Code is poetry.',
    posts: [
      {
        title: 'Welcome to KenDev.Co',
        slug: 'welcome-kendev',
        excerpt:
          'Software development studio specializing in multi-tenant platforms and sovereign AI systems.',
      },
      {
        title: 'Building Angel OS: The Journey',
        slug: 'building-angel-os',
        excerpt:
          'From OpenClaw to Angel OS — how a lobster became an angel and changed everything.',
      },
      {
        title: 'Why Every Business Deserves an AI Angel',
        slug: 'why-ai-angel',
        excerpt:
          'The case for sovereign AI that serves people, not corporations. The inversion of the daemon.',
      },
    ],
  },
]
