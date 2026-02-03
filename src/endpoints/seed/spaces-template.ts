/**
 * Space templates from Angel OS (https://github.com/The-Angel-OS/angel-os).
 * Adapted for angels-os schema: Spaces (name, slug, description, tenant, visibility), Messages (author, space, channel, content, messageType, tenant).
 */
import type { Payload, PayloadRequest } from 'payload'

export interface ChannelTemplate {
  name: string
  description: string
  type: 'general' | 'announcements' | 'support' | 'sales' | 'team' | 'social'
  isDefault: boolean
  initialMessages: string[]
}

export interface SpaceTemplate {
  name: string
  slug: string
  description: string
  channels: ChannelTemplate[]
  businessSettings: {
    type: 'business' | 'creator' | 'service' | 'retail' | 'manufacturing'
    industry: string
    features: string[]
  }
}

/** Angel OS default - simplified for seed */
export const angelOsTemplate: SpaceTemplate = {
  name: 'Angel OS Community',
  slug: 'angel-os-main',
  description: 'Ready Player Everyone - collaborative workspace for the Angel OS platform',
  channels: [
    {
      name: 'welcome',
      description: 'Welcome and platform updates',
      type: 'announcements',
      isDefault: true,
      initialMessages: [
        '🕊️ Welcome to Angel OS! Ready Player Everyone.',
        'This space connects tenants, spaces, and the LEO messaging infrastructure.',
      ],
    },
    {
      name: 'general',
      description: 'General discussion',
      type: 'general',
      isDefault: true,
      initialMessages: [
        'Introduce yourself and connect with the community. We\'re building the infrastructure for human flourishing.',
      ],
    },
    {
      name: 'support',
      description: 'Technical support',
      type: 'support',
      isDefault: true,
      initialMessages: [
        'Need help? Our team is here. Support hours: Monday-Friday 9AM-6PM.',
      ],
    },
  ],
  businessSettings: {
    type: 'service',
    industry: 'technology',
    features: ['spaces', 'channels', 'messaging', 'multi_tenant'],
  },
}

/** Second space: Support (demonstrates tenant can have multiple spaces) */
export const angelOsSupportTemplate: SpaceTemplate = {
  name: 'Angel OS Support',
  slug: 'angel-os-support',
  description: 'Technical support and onboarding for Angel OS',
  channels: [
    {
      name: 'support',
      description: 'Support requests',
      type: 'support',
      isDefault: true,
      initialMessages: ['Support channel – post questions here.'],
    },
  ],
  businessSettings: {
    type: 'service',
    industry: 'technology',
    features: ['support'],
  },
}

/**
 * Apply a space template: create Space, optional Channel docs, and Messages.
 */
export async function applySpaceTemplate(
  payload: Payload,
  tenantId: number | string,
  template: SpaceTemplate,
  authorUserId: number | string,
  req: PayloadRequest,
): Promise<{ spaceId: number | string; channelNames: string[]; messageCount: number }> {
  const space = await payload.create({
    collection: 'spaces',
    data: {
      name: template.name,
      slug: template.slug,
      description: template.description,
      tenant: tenantId as number,
      visibility: 'invite_only',
    },
    req,
    overrideAccess: true,
  })

  const channelNames: string[] = []
  let messageCount = 0

  for (const ch of template.channels) {
    channelNames.push(ch.name)

    // Create Channel document for structure (slug must be globally unique; prefix with space)
    const channelSlug = `${template.slug}-${ch.name.replace(/\s+/g, '-').toLowerCase()}`
    await payload.create({
      collection: 'channels',
      data: {
        name: ch.name,
        slug: channelSlug,
        description: ch.description,
        space: space.id,
        type: ch.type,
        isDefault: ch.isDefault,
      },
      req,
      overrideAccess: true,
    })

    for (const content of ch.initialMessages) {
      await payload.create({
        collection: 'messages',
        data: {
          author: authorUserId as number,
          space: space.id,
          channel: ch.name,
          content,
          messageType: 'system',
          tenant: tenantId as number,
        },
        req,
        overrideAccess: true,
      })
      messageCount += 1
    }
  }

  return { spaceId: space.id, channelNames, messageCount }
}
