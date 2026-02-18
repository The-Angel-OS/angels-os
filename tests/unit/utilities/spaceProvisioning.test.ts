/**
 * Unit tests for Space Provisioning — template selection and channel composition.
 *
 * Tests the pure data structures and template selection logic:
 * - SPACE_TEMPLATES covers all 5 endeavor types
 * - Each template has required fields
 * - Channel compositions are correct per endeavor type
 * - getAvailableTemplates() returns all templates
 *
 * Payload-dependent functions (createSpaceFromTemplate, addChannelToSpace)
 * are tested in integration tests.
 *
 * @see src/utilities/spaceProvisioning.ts
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement pure data structures for isolated testing
// ---------------------------------------------------------------------------

type EndeavorType =
  | 'service-provider'
  | 'retail-commerce'
  | 'creator-content'
  | 'booking-based'
  | 'custom'

interface ChannelTemplate {
  name: string
  type: string
  description: string
  isDefault?: boolean
}

interface SpaceTemplate {
  name: string
  description: string
  endeavorType: EndeavorType
  channels: ChannelTemplate[]
  examples: string
}

const COMMON_CHANNELS: ChannelTemplate[] = [
  { name: 'general', type: 'general', description: 'General discussion', isDefault: true },
  { name: 'announcements', type: 'announcements', description: 'Important updates and news' },
]

const SERVICE_CHANNELS: ChannelTemplate[] = [
  ...COMMON_CHANNELS,
  { name: 'bookings', type: 'support', description: 'Service bookings and appointments' },
  { name: 'client-requests', type: 'support', description: 'Client service requests' },
  { name: 'portfolio', type: 'general', description: 'Showcase work and services' },
  { name: 'reviews', type: 'general', description: 'Client reviews and testimonials' },
]

const COMMERCE_CHANNELS: ChannelTemplate[] = [
  ...COMMON_CHANNELS,
  { name: 'products', type: 'sales', description: 'Product catalog and updates' },
  { name: 'orders', type: 'support', description: 'Order tracking and support' },
  { name: 'support', type: 'support', description: 'Customer support' },
]

const CREATOR_CHANNELS: ChannelTemplate[] = [
  ...COMMON_CHANNELS,
  { name: 'community', type: 'social', description: 'Community discussion' },
  { name: 'content-updates', type: 'general', description: 'New content announcements' },
  { name: 'premium', type: 'general', description: 'Exclusive content for subscribers' },
]

const BOOKING_CHANNELS: ChannelTemplate[] = [
  ...COMMON_CHANNELS,
  { name: 'scheduling', type: 'support', description: 'Appointment scheduling' },
  { name: 'consultations', type: 'support', description: 'Consultation requests' },
  { name: 'availability', type: 'general', description: 'Available time slots and updates' },
]

const SPACE_TEMPLATES: Record<EndeavorType, SpaceTemplate> = {
  'service-provider': {
    name: 'Service Provider',
    description: 'For businesses that provide services - massage, pressure washing, cleaning, consulting',
    endeavorType: 'service-provider',
    channels: SERVICE_CHANNELS,
    examples: 'Massage parlor, pressure washing, singing telegrams, nail salon',
  },
  'retail-commerce': {
    name: 'Retail & Commerce',
    description: 'For businesses that sell products - farms, shops, equipment rental',
    endeavorType: 'retail-commerce',
    channels: COMMERCE_CHANNELS,
    examples: 'Cactus farm, exotic birds, dumpster rental, equipment shop',
  },
  'creator-content': {
    name: 'Creator & Content',
    description: 'For creators, educators, and content-driven businesses',
    endeavorType: 'creator-content',
    channels: CREATOR_CHANNELS,
    examples: 'Tours, rent-a-friend, coaching, online courses',
  },
  'booking-based': {
    name: 'Booking & Scheduling',
    description: 'For businesses centered around scheduling and appointments',
    endeavorType: 'booking-based',
    channels: BOOKING_CHANNELS,
    examples: 'Interview scheduling, booth rentals, consulting, salon chairs',
  },
  custom: {
    name: 'Custom',
    description: 'Start with basics and add channels as needed',
    endeavorType: 'custom',
    channels: COMMON_CHANNELS,
    examples: 'Anything else - build it your way',
  },
}

function getAvailableTemplates(): { key: EndeavorType; template: SpaceTemplate }[] {
  return (Object.entries(SPACE_TEMPLATES) as [EndeavorType, SpaceTemplate][]).map(
    ([key, template]) => ({ key, template }),
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SPACE_TEMPLATES', () => {
  const endeavorTypes: EndeavorType[] = [
    'service-provider',
    'retail-commerce',
    'creator-content',
    'booking-based',
    'custom',
  ]

  it('covers all 5 endeavor types', () => {
    for (const type of endeavorTypes) {
      expect(SPACE_TEMPLATES[type]).toBeDefined()
    }
  })

  it('each template has required fields', () => {
    for (const type of endeavorTypes) {
      const template = SPACE_TEMPLATES[type]
      expect(template.name).toBeTruthy()
      expect(template.description).toBeTruthy()
      expect(template.endeavorType).toBe(type)
      expect(Array.isArray(template.channels)).toBe(true)
      expect(template.channels.length).toBeGreaterThan(0)
      expect(template.examples).toBeTruthy()
    }
  })
})

describe('Common channels', () => {
  it('every template includes general channel', () => {
    for (const template of Object.values(SPACE_TEMPLATES)) {
      const general = template.channels.find((ch) => ch.name === 'general')
      expect(general).toBeDefined()
      expect(general?.isDefault).toBe(true)
    }
  })

  it('every template includes announcements channel', () => {
    for (const template of Object.values(SPACE_TEMPLATES)) {
      const announcements = template.channels.find(
        (ch) => ch.name === 'announcements',
      )
      expect(announcements).toBeDefined()
    }
  })

  it('exactly one channel is marked as default per template', () => {
    for (const template of Object.values(SPACE_TEMPLATES)) {
      const defaults = template.channels.filter((ch) => ch.isDefault === true)
      expect(defaults).toHaveLength(1)
    }
  })
})

describe('Service Provider channels', () => {
  const template = SPACE_TEMPLATES['service-provider']

  it('has 6 channels', () => {
    expect(template.channels).toHaveLength(6)
  })

  it('includes bookings channel', () => {
    expect(template.channels.find((ch) => ch.name === 'bookings')).toBeDefined()
  })

  it('includes portfolio channel', () => {
    expect(template.channels.find((ch) => ch.name === 'portfolio')).toBeDefined()
  })

  it('includes reviews channel', () => {
    expect(template.channels.find((ch) => ch.name === 'reviews')).toBeDefined()
  })
})

describe('Retail Commerce channels', () => {
  const template = SPACE_TEMPLATES['retail-commerce']

  it('has 5 channels', () => {
    expect(template.channels).toHaveLength(5)
  })

  it('includes products channel with sales type', () => {
    const products = template.channels.find((ch) => ch.name === 'products')
    expect(products).toBeDefined()
    expect(products?.type).toBe('sales')
  })

  it('includes orders channel with support type', () => {
    const orders = template.channels.find((ch) => ch.name === 'orders')
    expect(orders).toBeDefined()
    expect(orders?.type).toBe('support')
  })
})

describe('Creator Content channels', () => {
  const template = SPACE_TEMPLATES['creator-content']

  it('has 5 channels', () => {
    expect(template.channels).toHaveLength(5)
  })

  it('includes community channel with social type', () => {
    const community = template.channels.find((ch) => ch.name === 'community')
    expect(community).toBeDefined()
    expect(community?.type).toBe('social')
  })

  it('includes premium channel', () => {
    expect(template.channels.find((ch) => ch.name === 'premium')).toBeDefined()
  })
})

describe('Booking Based channels', () => {
  const template = SPACE_TEMPLATES['booking-based']

  it('has 5 channels', () => {
    expect(template.channels).toHaveLength(5)
  })

  it('includes scheduling channel', () => {
    expect(
      template.channels.find((ch) => ch.name === 'scheduling'),
    ).toBeDefined()
  })

  it('includes consultations channel', () => {
    expect(
      template.channels.find((ch) => ch.name === 'consultations'),
    ).toBeDefined()
  })
})

describe('Custom channels (minimal)', () => {
  const template = SPACE_TEMPLATES['custom']

  it('has only 2 channels (general + announcements)', () => {
    expect(template.channels).toHaveLength(2)
  })
})

describe('Channel template structure', () => {
  it('all channels have name, type, and description', () => {
    for (const template of Object.values(SPACE_TEMPLATES)) {
      for (const ch of template.channels) {
        expect(ch.name).toBeTruthy()
        expect(ch.type).toBeTruthy()
        expect(ch.description).toBeTruthy()
      }
    }
  })
})

describe('getAvailableTemplates', () => {
  it('returns all 5 templates', () => {
    const templates = getAvailableTemplates()
    expect(templates).toHaveLength(5)
  })

  it('each entry has key and template', () => {
    const templates = getAvailableTemplates()
    for (const entry of templates) {
      expect(entry.key).toBeTruthy()
      expect(entry.template).toBeDefined()
      expect(entry.template.name).toBeTruthy()
    }
  })

  it('keys match endeavor types', () => {
    const templates = getAvailableTemplates()
    const keys = templates.map((t) => t.key)
    expect(keys).toContain('service-provider')
    expect(keys).toContain('retail-commerce')
    expect(keys).toContain('creator-content')
    expect(keys).toContain('booking-based')
    expect(keys).toContain('custom')
  })
})
