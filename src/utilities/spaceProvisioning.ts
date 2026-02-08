// @ts-nocheck
import type { Payload } from 'payload'
import type { Space, User as PayloadUser } from '@/payload-types'

export interface ChannelTemplate {
  name: string
  type: 'text' | 'voice' | 'video' | 'announcement'
  description: string
  isPublic: boolean
  permissions?: {
    canPost?: string[]
    canRead?: string[]
    canManage?: string[]
  }
  businessMetadata?: {
    department: string
    priority: 'low' | 'normal' | 'high' | 'urgent'
    workflow?: string
  }
}

export interface SpaceTemplate {
  name: string
  description: string
  spaceType: 'business' | 'creator' | 'community' | 'project'
  industry: string
  channels: ChannelTemplate[]
  defaultRoles?: string[]
  businessContext?: {
    industry: string
    department: string
    workflowStage: string
  }
}

// Default Channel Templates by Category
export const DEFAULT_CHANNELS = {
  // Basic Business Channels
  business: [
    {
      name: 'general',
      type: 'text' as const,
      description: 'General discussion and team updates',
      isPublic: true,
      businessMetadata: {
        department: 'all',
        priority: 'normal' as const,
        workflow: 'collaboration'
      }
    },
    {
      name: 'announcements',
      type: 'announcement' as const,
      description: 'Important company announcements',
      isPublic: true,
      permissions: {
        canPost: ['admin', 'manager'],
        canRead: ['everyone'],
        canManage: ['admin']
      },
      businessMetadata: {
        department: 'leadership',
        priority: 'high' as const,
        workflow: 'communication'
      }
    },
    {
      name: 'projects',
      type: 'text' as const,
      description: 'Project coordination and updates',
      isPublic: true,
      businessMetadata: {
        department: 'operations',
        priority: 'normal' as const,
        workflow: 'project-management'
      }
    },
    {
      name: 'voice-meeting',
      type: 'voice' as const,
      description: 'Voice channel for team meetings',
      isPublic: true,
      businessMetadata: {
        department: 'all',
        priority: 'normal' as const,
        workflow: 'meetings'
      }
    }
  ],

  // Creator/Content Channels
  creator: [
    {
      name: 'content-planning',
      type: 'text' as const,
      description: 'Content ideas and planning',
      isPublic: false,
      businessMetadata: {
        department: 'content',
        priority: 'high' as const,
        workflow: 'content-creation'
      }
    },
    {
      name: 'community',
      type: 'text' as const,
      description: 'Community discussion and fan interaction',
      isPublic: true,
      businessMetadata: {
        department: 'community',
        priority: 'normal' as const,
        workflow: 'engagement'
      }
    },
    {
      name: 'premium-content',
      type: 'text' as const,
      description: 'Exclusive content for paying subscribers',
      isPublic: false,
      permissions: {
        canRead: ['subscriber', 'premium'],
        canPost: ['creator', 'admin'],
        canManage: ['admin']
      },
      businessMetadata: {
        department: 'monetization',
        priority: 'high' as const,
        workflow: 'premium-content'
      }
    },
    {
      name: 'live-streams',
      type: 'video' as const,
      description: 'Live streaming and video content',
      isPublic: true,
      businessMetadata: {
        department: 'content',
        priority: 'high' as const,
        workflow: 'live-content'
      }
    }
  ],

  // Service Provider Channels
  service: [
    {
      name: 'client-requests',
      type: 'text' as const,
      description: 'Client service requests and inquiries',
      isPublic: false,
      businessMetadata: {
        department: 'customer-service',
        priority: 'high' as const,
        workflow: 'client-management'
      }
    },
    {
      name: 'consultations',
      type: 'voice' as const,
      description: 'Voice channel for client consultations',
      isPublic: false,
      businessMetadata: {
        department: 'consulting',
        priority: 'high' as const,
        workflow: 'client-meetings'
      }
    },
    {
      name: 'portfolio',
      type: 'text' as const,
      description: 'Showcase work and portfolio items',
      isPublic: true,
      businessMetadata: {
        department: 'marketing',
        priority: 'normal' as const,
        workflow: 'portfolio-management'
      }
    }
  ]
}

// Space Templates by Business Type
export const SPACE_TEMPLATES: Record<string, SpaceTemplate> = {
  'business-general': {
    name: 'General Business',
    description: 'A comprehensive business workspace for team collaboration',
    spaceType: 'business',
    industry: 'general',
    channels: DEFAULT_CHANNELS.business,
    businessContext: {
      industry: 'general',
      department: 'all',
      workflowStage: 'active'
    }
  },

  'creator-content': {
    name: 'Content Creator Hub',
    description: 'A creator space for content planning, community, and monetization',
    spaceType: 'creator',
    industry: 'content-creation',
    channels: DEFAULT_CHANNELS.creator,
    businessContext: {
      industry: 'content-creation',
      department: 'content',
      workflowStage: 'active'
    }
  },

  'service-provider': {
    name: 'Service Provider Workspace',
    description: 'Professional service provider space for client management',
    spaceType: 'business',
    industry: 'professional-services',
    channels: DEFAULT_CHANNELS.service,
    businessContext: {
      industry: 'professional-services',
      department: 'client-services',
      workflowStage: 'active'
    }
  },

  'kendev-co': {
    name: 'KenDev.Co - Full Stack Development',
    description: 'Professional software development and consulting services',
    spaceType: 'business',
    industry: 'technology',
    channels: [
      ...DEFAULT_CHANNELS.business,
      {
        name: 'client-projects',
        type: 'text' as const,
        description: 'Active client project discussions',
        isPublic: false,
        businessMetadata: {
          department: 'development',
          priority: 'high' as const,
          workflow: 'project-delivery'
        }
      },
      {
        name: 'code-reviews',
        type: 'text' as const,
        description: 'Code review discussions and technical feedback',
        isPublic: false,
        businessMetadata: {
          department: 'development',
          priority: 'high' as const,
          workflow: 'quality-assurance'
        }
      },
      {
        name: 'portfolio-showcase',
        type: 'text' as const,
        description: 'Showcase completed projects and technical achievements',
        isPublic: true,
        businessMetadata: {
          department: 'marketing',
          priority: 'normal' as const,
          workflow: 'portfolio-management'
        }
      }
    ],
    businessContext: {
      industry: 'technology',
      department: 'development',
      workflowStage: 'active'
    }
  }
}

// Provisioning Functions
export async function createSpaceFromTemplate(
  payload: Payload,
  templateKey: string,
  tenantId: string,
  ownerId: string,
  customizations?: Partial<SpaceTemplate>
): Promise<Space> {
  const template = SPACE_TEMPLATES[templateKey]
  if (!template) {
    throw new Error(`Template "${templateKey}" not found`)
  }

  // Merge template with customizations
  const finalTemplate = { ...template, ...customizations }

  const spaceData = {
    name: finalTemplate.name,
    slug: finalTemplate.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: finalTemplate.description,
    tenant: tenantId,
    spaceType: finalTemplate.spaceType,
    isPublic: true,
    members: [ownerId],
    businessContext: finalTemplate.businessContext || {
      industry: 'general',
      department: 'all',
      workflowStage: 'active'
    },
    alerts: [],
    channels: finalTemplate.channels.map(channelTemplate => ({
      name: channelTemplate.name,
      type: channelTemplate.type,
      description: channelTemplate.description,
      isPublic: channelTemplate.isPublic,
      businessMetadata: channelTemplate.businessMetadata || {
        department: 'general',
        priority: 'normal'
      }
    }))
  }

  const space = await payload.create({
    collection: 'spaces',
    data: spaceData,
  })

  return space as Space
}

export async function addChannelToSpace(
  payload: Payload,
  spaceId: string,
  channelTemplate: ChannelTemplate
): Promise<Space> {
  // Get the current space
  const space = await payload.findByID({
    collection: 'spaces',
    id: spaceId,
  }) as Space

  // Add the new channel
  const updatedChannels = [
    ...(space.channels || []),
    {
      name: channelTemplate.name,
      type: channelTemplate.type,
      description: channelTemplate.description,
      isPublic: channelTemplate.isPublic,
      businessMetadata: channelTemplate.businessMetadata || {
        department: 'general',
        priority: 'normal'
      }
    }
  ]

  // Update the space with the new channel
  const updatedSpace = await payload.update({
    collection: 'spaces',
    id: spaceId,
    data: {
      channels: updatedChannels,
    },
  })

  return updatedSpace as Space
}

export async function provisionKenDevCoSpace(
  payload: Payload,
  tenantId: string,
  ownerId: string
): Promise<Space> {
  return createSpaceFromTemplate(payload, 'kendev-co', tenantId, ownerId)
}

// Helper to get available templates
export function getAvailableTemplates(): { key: string; template: SpaceTemplate }[] {
  return Object.entries(SPACE_TEMPLATES).map(([key, template]) => ({
    key,
    template
  }))
}

// Helper to create channels dynamically via API
export function createChannelTemplate(
  name: string,
  type: 'text' | 'voice' | 'video' | 'announcement',
  options: Partial<ChannelTemplate> = {}
): ChannelTemplate {
  return {
    name,
    type,
    description: options.description || `${type} channel for ${name}`,
    isPublic: options.isPublic ?? true,
    permissions: options.permissions,
    businessMetadata: options.businessMetadata || {
      department: 'general',
      priority: 'normal'
    }
  }
}
