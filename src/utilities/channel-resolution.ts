import { getPayload } from 'payload'
import configPromise from '@payload-config'

export interface ChannelResolutionOptions {
  name: string
  channelType: 'photo_analysis' | 'document_processing' | 'data_collection' | 'monitoring' | 'intelligence_gathering' | 'economic_analysis' | 'chat' | 'communication'
  reportType: 'mileage_log' | 'collection_inventory' | 'business_inventory' | 'equipment_status' | 'asset_tracking' | 'quality_control' | 'maintenance_log' | 'customer_interaction' | 'general'
  tenantId: string | number
  spaceId: number
  guardianAngelId?: string | number
  members?: string[]
  isPrivate?: boolean
  metadata?: any
}

/**
 * Find or create a channel with consistent parameters
 * This ensures all LEO chat implementations use the same channel
 */
export async function findOrCreateChannel(options: ChannelResolutionOptions) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    const {
      name,
      channelType,
      reportType,
      tenantId,
      spaceId,
      guardianAngelId = '1',
      members = [],
      isPrivate = false,
      metadata = {}
    } = options

    // Map channelType to Channel.type (general | support | sales | inventory | pdf | video | etc.)
    const channelTypeToPayloadType: Record<string, 'general' | 'support' | 'sales' | 'inventory' | 'pdf' | 'video' | 'announcements' | 'team' | 'social'> = {
      chat: 'general',
      communication: 'general',
      photo_analysis: 'inventory',
      document_processing: 'pdf',
      data_collection: 'general',
      monitoring: 'general',
      intelligence_gathering: 'general',
      economic_analysis: 'general',
    }
    const type = channelTypeToPayloadType[channelType] ?? 'general'

    // First, try to find existing channel by name and space
    const existingChannels = await payload.find({
      collection: 'channels',
      where: {
        and: [
          { name: { equals: name } },
          { space: { equals: spaceId } },
        ],
      },
      limit: 1,
    })

    if (existingChannels.docs.length > 0) {
      const channel = existingChannels.docs[0]
      return channel
    }

    // Create new channel if not found (only fields that exist on Channels collection)
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'channel'
    const newChannel = await payload.create({
      collection: 'channels',
      data: {
        name,
        slug,
        description: `AI chat channel for ${name}`,
        space: spaceId,
        type,
      },
      draft: false,
    })

    return newChannel

  } catch (error) {
    console.error('Error finding or creating channel:', error)
    throw new Error(`Failed to find or create channel: ${error}`)
  }
}

/**
 * Get the standard system channel for LEO AI conversations
 * This ensures all LEO implementations use the same channel
 */
export async function getSystemChannel(tenantId: string | number = '1', spaceId: number = 1) {
  return findOrCreateChannel({
    name: 'system',
    channelType: 'chat',
    reportType: 'general',
    tenantId,
    spaceId,
    guardianAngelId: '1',
  })
}
