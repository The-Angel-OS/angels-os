/**
 * Use-case tenant definitions for the seed process.
 * Each tenant exercises a different endeavor type through the provisioning system.
 * Inspired by real Clearwater-area businesses to make the demo tangible.
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
 * Five use-case tenants demonstrating different endeavor types.
 * Inspired by real businesses — makes seed data feel like a real platform demo.
 */
export const USE_CASE_TENANTS: UseCaseTenant[] = [
  // ─── Service Provider: Celersoft Technology ────────────────
  // Inspired by celersoft.com — IT consulting, cybersecurity, cloud
  {
    name: 'Celersoft Technology',
    slug: 'celersoft',
    domain: 'celersoft.angelos.local',
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
    domain: 'lucas-productions.angelos.local',
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
  // Community ministry, outreach, and events
  {
    name: 'Clearwater Cruisin Ministries',
    slug: 'clearwater-cruisin',
    domain: 'clearwater-cruisin.angelos.local',
    endeavorType: 'creator-content',
    spaceName: 'Cruisin Community',
    branding: {
      siteName: 'Clearwater Cruisin Ministries',
      tagline: 'Faith, Community, and the Open Road',
      primaryColor: '#D97706',
      secondaryColor: '#F59E0B',
      accentColor: '#0EA5E9',
      backgroundColor: '#FFFBEB',
      foregroundColor: '#1C1917',
      borderColor: '#FDE68A',
      headingFont: 'playfair-display',
      bodyFont: 'lato',
    },
    leoPersonality:
      'Warm, welcoming, and community-minded. I help connect people to events, share ministry updates, and coordinate volunteers. Everyone is welcome here — that is the whole point.',
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
    ],
  },

  // ─── Service Provider: Serenity Massage & Wellness ────────
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

  // ─── Retail Commerce: Hays Cactus Farm ────────────────────
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

]
