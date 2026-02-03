/**
 * Space provisioning templates.
 * Adapted from https://github.com/The-Angel-OS/angel-os/blob/main/src/utilities/spaceProvisioning.ts
 * Uses our schema: Spaces, Channels (separate collection), Messages.
 */
import type { ChannelTemplate, SpaceTemplate } from '@/endpoints/seed/spaces-template'
import { angelOsTemplate, angelOsSupportTemplate, applySpaceTemplate } from '@/endpoints/seed/spaces-template'
import type { Payload, PayloadRequest } from 'payload'

/** Business channels (general, announcements, projects, voice) */
const BUSINESS_CHANNELS: ChannelTemplate[] = [
  {
    name: 'general',
    description: 'General discussion and team updates',
    type: 'general',
    isDefault: true,
    initialMessages: ['Welcome to the team. Use this channel for day-to-day coordination.'],
  },
  {
    name: 'announcements',
    description: 'Important company announcements',
    type: 'announcements',
    isDefault: true,
    initialMessages: ['Company announcements will appear here.'],
  },
  {
    name: 'projects',
    description: 'Project coordination and updates',
    type: 'general',
    isDefault: false,
    initialMessages: ['Project discussions and updates.'],
  },
]

/** Creator channels (content-planning, community, premium) */
const CREATOR_CHANNELS: ChannelTemplate[] = [
  {
    name: 'content-planning',
    description: 'Content ideas and planning',
    type: 'general',
    isDefault: true,
    initialMessages: ['Content planning and ideation.'],
  },
  {
    name: 'community',
    description: 'Community discussion and fan interaction',
    type: 'social',
    isDefault: true,
    initialMessages: ['Connect with your community here.'],
  },
  {
    name: 'premium-content',
    description: 'Exclusive content for paying subscribers',
    type: 'general',
    isDefault: false,
    initialMessages: ['Premium subscriber content.'],
  },
]

/** Service provider channels (client-requests, consultations, portfolio) */
const SERVICE_CHANNELS: ChannelTemplate[] = [
  {
    name: 'client-requests',
    description: 'Client service requests and inquiries',
    type: 'support',
    isDefault: true,
    initialMessages: ['Client requests and inquiries.'],
  },
  {
    name: 'consultations',
    description: 'Consultation scheduling and notes',
    type: 'general',
    isDefault: false,
    initialMessages: ['Consultation discussions.'],
  },
  {
    name: 'portfolio',
    description: 'Showcase work and portfolio items',
    type: 'general',
    isDefault: false,
    initialMessages: ['Portfolio and case studies.'],
  },
]

export const SPACE_TEMPLATES: Record<string, SpaceTemplate> = {
  'angel-os-main': angelOsTemplate,
  'angel-os-support': angelOsSupportTemplate,
  'business-general': {
    name: 'General Business',
    slug: 'business-general',
    description: 'A comprehensive business workspace for team collaboration',
    channels: BUSINESS_CHANNELS,
    businessSettings: {
      type: 'business',
      industry: 'general',
      features: ['spaces', 'channels', 'messaging'],
    },
  },
  'creator-content': {
    name: 'Content Creator Hub',
    slug: 'creator-content',
    description: 'A creator space for content planning, community, and monetization',
    channels: CREATOR_CHANNELS,
    businessSettings: {
      type: 'creator',
      industry: 'content-creation',
      features: ['content', 'community', 'monetization'],
    },
  },
  'service-provider': {
    name: 'Service Provider Workspace',
    slug: 'service-provider',
    description: 'Professional service provider space for client management',
    channels: SERVICE_CHANNELS,
    businessSettings: {
      type: 'service',
      industry: 'professional-services',
      features: ['client-management', 'consultations', 'portfolio'],
    },
  },
}

export function getAvailableTemplates(): { key: string; template: SpaceTemplate }[] {
  return Object.entries(SPACE_TEMPLATES).map(([key, template]) => ({ key, template }))
}

export async function createSpaceFromTemplate(
  payload: Payload,
  templateKey: string,
  tenantId: number | string,
  authorUserId: number | string,
  req: PayloadRequest,
  customizations?: Partial<SpaceTemplate>,
): Promise<{ spaceId: number | string; channelNames: string[]; messageCount: number }> {
  const template = SPACE_TEMPLATES[templateKey]
  if (!template) {
    throw new Error(`Template "${templateKey}" not found. Available: ${Object.keys(SPACE_TEMPLATES).join(', ')}`)
  }
  const finalTemplate = { ...template, ...customizations }
  return applySpaceTemplate(payload, tenantId, finalTemplate, authorUserId, req)
}
