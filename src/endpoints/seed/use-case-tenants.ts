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
 * Two use-case tenants demonstrating different endeavor types.
 * Keeps the seed lightweight while proving provisioning works.
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

]
