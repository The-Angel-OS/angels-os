/**
 * Space provisioning - creates Spaces + Channels from endeavor-type templates.
 *
 * Endeavor types determine what channels get created:
 * - service-provider: booking, client management, portfolio
 * - retail-commerce: products, orders, support
 * - creator-content: community, premium content, live streams
 * - booking-based: scheduling, consultations, availability
 * - custom: just general + announcements
 */
import type { Payload, PayloadRequest } from 'payload'

export interface ChannelTemplate {
  name: string
  type: string
  description: string
  isDefault?: boolean
}

export type EndeavorType =
  | 'service-provider'
  | 'retail-commerce'
  | 'creator-content'
  | 'booking-based'
  | 'custom'

/** Canonical value+label options for endeavor-type pickers — ONE source, colocated
 *  with the union. The Record forces a label for EVERY EndeavorType, so adding a
 *  union member is a compile error until it's labelled (can't drift). (53.) */
export const ENDEAVOR_TYPE_LABELS: Record<EndeavorType, string> = {
  'service-provider': 'Service Provider',
  'retail-commerce': 'Retail & Commerce',
  'creator-content': 'Creator & Content',
  'booking-based': 'Booking & Scheduling',
  custom: 'Custom',
}
export const ENDEAVOR_TYPE_OPTIONS: { value: EndeavorType; label: string }[] = (
  Object.entries(ENDEAVOR_TYPE_LABELS) as [EndeavorType, string][]
).map(([value, label]) => ({ value, label }))

export interface SpaceTemplate {
  name: string
  description: string
  endeavorType: EndeavorType
  channels: ChannelTemplate[]
  examples: string
}

// ─── Channel sets by endeavor type ───────────────────────────────

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

// ─── Space Templates ─────────────────────────────────────────────

export const SPACE_TEMPLATES: Record<EndeavorType, SpaceTemplate> = {
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

// ─── Provisioning functions ──────────────────────────────────────

/**
 * Create a Space + Channels from an endeavor template.
 * Creates the Space document, then creates separate Channel documents
 * linked to it via the `space` relationship.
 */
export async function createSpaceFromTemplate(
  payload: Payload,
  endeavorType: EndeavorType,
  tenantId: number | string,
  customName?: string,
  req?: PayloadRequest,
): Promise<{ spaceId: number | string; channelIds: (number | string)[] }> {
  const template = SPACE_TEMPLATES[endeavorType]
  if (!template) {
    throw new Error(`Unknown endeavor type: ${endeavorType}`)
  }

  const spaceName = customName || template.name
  const slug = spaceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // 1. Create the Space
  const space = await payload.create({
    collection: 'spaces',
    data: {
      name: spaceName,
      slug,
      description: template.description,
      tenant: tenantId as number,
      visibility: 'invite_only',
    },
    ...(req ? { req } : {}),
    overrideAccess: true,
  })

  // 2. Create Channel documents linked to this Space
  //    Slugs are NOT globally unique — multi-tenant allows duplicate slugs across tenants
  const channelIds: (number | string)[] = []
  for (const ch of template.channels) {
    const channel = await payload.create({
      collection: 'channels',
      data: {
        name: ch.name,
        slug: ch.name,
        description: ch.description,
        space: space.id,
        type: ch.type as 'general' | 'announcements' | 'support' | 'sales' | 'inventory' | 'pdf' | 'video' | 'team' | 'social',
        isDefault: ch.isDefault ?? false,
        tenant: tenantId as number,
      },
      ...(req ? { req } : {}),
      overrideAccess: true,
    })
    channelIds.push(channel.id)
  }

  return { spaceId: space.id, channelIds }
}

/**
 * PERSONAL channel set — for a guardian angel / personal portal, NOT a business.
 * A personal portal is one person's private home: a life-log timeline (ties to the
 * guardian-timeline vision + Nimue life-log ingestion), a private journal, and
 * reminders — instead of a business's general/announcements/support/community.
 * "Sorted separate from the other endeavors."
 */
export const PERSONAL_CHANNELS: ChannelTemplate[] = [
  { name: 'timeline', type: 'general', description: 'Your life-log — moments, photos, and notes over time', isDefault: true },
  { name: 'journal', type: 'general', description: 'Private reflections' },
  { name: 'reminders', type: 'general', description: 'Things to remember and follow up on' },
]

/**
 * Create a PERSONAL space (guardian-angel / personal portal) with the personal
 * channel set. Mirrors createSpaceFromTemplate but is not endeavor-typed — a
 * personal portal is private and single-person, not a business hub.
 */
export async function createPersonalSpace(
  payload: Payload,
  tenantId: number | string,
  customName?: string,
  req?: PayloadRequest,
): Promise<{ spaceId: number | string; channelIds: (number | string)[] }> {
  const spaceName = customName || 'My Space'
  const slug = spaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-space'

  const space = await payload.create({
    collection: 'spaces',
    data: {
      name: spaceName,
      slug,
      description: 'Your personal space — timeline, journal, and reminders',
      tenant: tenantId as number,
      visibility: 'invite_only',
    },
    ...(req ? { req } : {}),
    overrideAccess: true,
  })

  const channelIds: (number | string)[] = []
  for (const ch of PERSONAL_CHANNELS) {
    const channel = await payload.create({
      collection: 'channels',
      data: {
        name: ch.name,
        slug: ch.name,
        description: ch.description,
        space: space.id,
        type: ch.type as 'general',
        isDefault: ch.isDefault ?? false,
        tenant: tenantId as number,
      },
      ...(req ? { req } : {}),
      overrideAccess: true,
    })
    channelIds.push(channel.id)
  }

  return { spaceId: space.id, channelIds }
}

/** Get all available endeavor templates for the wizard. */
export function getAvailableTemplates(): {
  key: EndeavorType
  template: SpaceTemplate
}[] {
  return (Object.entries(SPACE_TEMPLATES) as [EndeavorType, SpaceTemplate][]).map(
    ([key, template]) => ({ key, template }),
  )
}

/** Add a channel to an existing space. */
export async function addChannelToSpace(
  payload: Payload,
  spaceId: number | string,
  tenantId: number | string,
  channel: ChannelTemplate,
  req?: PayloadRequest,
): Promise<number | string> {
  const created = await payload.create({
    collection: 'channels',
    data: {
      name: channel.name,
      slug: channel.name,
      description: channel.description,
      space: spaceId as number,
      type: channel.type as 'general',
      isDefault: channel.isDefault ?? false,
      tenant: tenantId as number,
    },
    ...(req ? { req } : {}),
    overrideAccess: true,
  })
  return created.id
}
