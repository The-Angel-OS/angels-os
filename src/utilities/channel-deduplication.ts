/**
 * Channel Deduplication Utilities
 * 
 * Prevents duplicate channel creation and ensures proper tenant isolation
 */

import type { Payload } from 'payload'

export interface ChannelIdentifier {
  name: string
  tenantId: string
  spaceId?: string
  type?: string
}

/**
 * Find existing channel by name and tenant
 */
export async function findExistingChannel(
  payload: Payload, 
  identifier: ChannelIdentifier
): Promise<any | null> {
  try {
    const channels = await payload.find({
      collection: 'channels',
      where: {
        and: [
          { name: { equals: identifier.name } },
          { tenantId: { equals: identifier.tenantId } },
          ...(identifier.type ? [{ channelType: { equals: identifier.type } }] : [])
        ]
      },
      limit: 1
    })

    return channels.docs[0] || null
  } catch (error) {
    console.error('Error finding existing channel:', error)
    return null
  }
}

/**
 * Create channel only if it doesn't exist
 */
export async function createChannelIfNotExists(
  payload: Payload,
  channelData: any
): Promise<any> {
  try {
    // Check if channel already exists
    const existing = await findExistingChannel(payload, {
      name: channelData.name,
      tenantId: channelData.tenantId,
      type: channelData.channelType
    })

    if (existing) {
      return existing
    }

    // Create new channel
    const newChannel = await payload.create({
      collection: 'channels',
      data: channelData
    })

    return newChannel

  } catch (error) {
    console.error('Error creating channel:', error)
    throw error
  }
}

/**
 * Cleanup duplicate channels for a tenant
 */
export async function cleanupDuplicateChannels(
  payload: Payload,
  tenantId: string
): Promise<void> {
  try {
    // Get all channels for this tenant
    const channels = await payload.find({
      collection: 'channels',
      where: {
        tenantId: { equals: tenantId }
      },
      limit: 0 // Get all
    })

    // Group by name and type
    const channelGroups: Record<string, any[]> = {}
    
    for (const channel of channels.docs) {
      const key = `${channel.name}-${channel.type ?? 'general'}`
      if (!channelGroups[key]) {
        channelGroups[key] = []
      }
      channelGroups[key].push(channel)
    }

    // Remove duplicates (keep the oldest one)
    for (const [key, duplicates] of Object.entries(channelGroups)) {
      if (duplicates.length > 1) {
        // Sort by creation date, keep the first one
        duplicates.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        const toDelete = duplicates.slice(1)

        // Delete duplicates
        for (const duplicate of toDelete) {
          try {
            await payload.delete({
              collection: 'channels',
              id: duplicate.id
            })
          } catch (deleteError) {
            console.error(`❌ Failed to delete duplicate channel ${duplicate.id}:`, deleteError)
          }
        }
      }
    }

  } catch (error) {
    console.error('Error cleaning up duplicate channels:', error)
    throw error
  }
}

/**
 * Get essential channels for a space/tenant
 */
export function getEssentialChannels(tenantId: string, spaceId?: string) {
  return [
    {
      name: 'main',
      description: 'Main discussion channel - Everyone + LEO AI',
      channelType: 'chat',
      reportType: 'general',
      tenantId,
      guardianAngelId: '1', // LEO
      isSystem: true,
      isPrivate: false,
      status: 'active',
      members: [
        { user: '1', role: 'admin', joinedAt: new Date().toISOString() } // Kenneth
      ]
    },
    {
      name: 'system',
      description: 'System announcements and updates',
      channelType: 'chat', 
      reportType: 'general',
      tenantId,
      guardianAngelId: '1', // LEO
      isSystem: true,
      isPrivate: false,
      status: 'active',
      members: [
        { user: '1', role: 'admin', joinedAt: new Date().toISOString() } // Kenneth
      ]
    }
  ]
}

/**
 * Ensure essential channels exist for a tenant/space
 */
export async function ensureEssentialChannelsExist(
  payload: Payload,
  tenantId: string,
  spaceId?: string
): Promise<any[]> {
  const essentialChannels = getEssentialChannels(tenantId, spaceId)
  const createdChannels = []

  for (const channelData of essentialChannels) {
    const channel = await createChannelIfNotExists(payload, channelData)
    createdChannels.push(channel)
  }

  return createdChannels
}

