import { getPayload } from 'payload'
import configPromise from '@payload-config'

export interface ChannelResolutionOptions {
  name: string
  channelType: 'photo_analysis' | 'document_processing' | 'data_collection' | 'monitoring' | 'intelligence_gathering' | 'economic_analysis' | 'chat' | 'communication'
  reportType: 'mileage_log' | 'collection_inventory' | 'business_inventory' | 'equipment_status' | 'asset_tracking' | 'quality_control' | 'maintenance_log' | 'customer_interaction' | 'general'
  tenantId: string | number
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
      guardianAngelId = '1',
      members = [],
      isPrivate = false,
      metadata = {}
    } = options

    // First, try to find existing channel
    const existingChannels = await payload.find({
      collection: 'channels',
      where: {
        and: [
          { name: { equals: name } },
          { tenantId: { equals: tenantId.toString() } },
          { channelType: { equals: channelType } }
        ]
      },
      limit: 1
    })

    if (existingChannels.docs.length > 0) {
      const channel = existingChannels.docs[0]
      console.log(`✅ Found existing channel: ${name} (ID: ${channel?.id})`)
      return channel
    }

    // Create new channel if not found
    console.log(`🔧 Creating new channel: ${name}`)
    const newChannel = await payload.create({
      collection: 'channels',
      data: {
        name,
        description: `AI chat channel for ${name}`,
        channelType,
        reportType,
        tenantId: tenantId.toString(), // Keep as string - field is type 'text'
        guardianAngelId: guardianAngelId.toString(), // Keep as string - field is type 'text'
        members: members.map(memberId => ({
          user: parseInt(memberId), // Convert string ID to number
          role: 'member' as const,
          joinedAt: new Date().toISOString(),
          permissions: {
            canRead: true,
            canWrite: true,
            canManage: false
          }
        })),
        isPrivate,
        metadata,
        feedConfiguration: {
          feedSource: 'api_webhook',
          feedSettings: { source: 'leo_chat' },
          pollingInterval: 60,
          filters: {
            fileTypes: [],
            keywords: [],
            dateRange: {}
          }
        },
        economics: {
          phyleAffiliation: 'independent_agent',
          model: {
            processingFee: 0,
            accuracyBonus: 0,
            speedBonus: 0,
            volumeDiscounts: [],
            sharing: 'fixed_fee'
          },
          stats: {
            totalEarned: 0,
            itemsProcessed: 0,
            accuracyScore: 0,
            phyleRank: 0,
            reputation: 0
          }
        },
        processingRules: {
          autoProcessing: true,
          requiresHumanReview: false,
          confidenceThreshold: 0.8,
          customPrompts: [],
          outputFormat: 'json'
        },
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })

    console.log(`✅ Created new channel: ${name} (ID: ${newChannel.id})`)
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
export async function getSystemChannel(tenantId: string | number = '1') {
  return findOrCreateChannel({
    name: 'system',
    channelType: 'chat',
    reportType: 'general',
    tenantId,
    guardianAngelId: '1'
  })
}
