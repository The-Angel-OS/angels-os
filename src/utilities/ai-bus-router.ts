/**
 * AI Bus Router - Internal Message Routing for Angel OS Core
 * 
 * Handles message routing based on Constitutional visibility levels.
 * Core responsibility: route messages to appropriate listeners based on
 * visibility (private/tenant/network) and subscription patterns.
 * 
 * Constitutional Reference: Article IV - AI Bus Protocol
 */

import type { Message, Tenant, User } from '../payload-types'

export type Visibility = 'private' | 'tenant' | 'network'

export interface AIBusSubscription {
  subscriberId: string // User or Angel ID
  subscriberType: 'human' | 'angel'
  tenantId: string
  visibilityLevels: Visibility[]
  channelFilters?: string[] // Optional: only specific channels
  spaceFilters?: string[] // Optional: only specific spaces
  messageTypes?: string[] // Optional: only specific types
}

export interface MessageRoute {
  message: Message
  recipients: AIBusSubscription[]
  visibility: Visibility
  routingDecision: 'broadcast' | 'filtered' | 'blocked'
  reason: string
}

/**
 * AI Bus Router - Core routing engine
 */
export class AIBusRouter {
  private subscriptions: Map<string, AIBusSubscription> = new Map()
  
  /**
   * Register a subscriber (human or Angel) to the AI Bus
   */
  subscribe(subscription: AIBusSubscription): void {
    this.subscriptions.set(subscription.subscriberId, subscription)
    console.log(`[AI Bus] Subscriber registered: ${subscription.subscriberId} (${subscription.subscriberType})`)
  }
  
  /**
   * Unsubscribe from AI Bus
   */
  unsubscribe(subscriberId: string): void {
    this.subscriptions.delete(subscriberId)
    console.log(`[AI Bus] Subscriber removed: ${subscriberId}`)
  }
  
  /**
   * Route a message based on visibility and subscriptions
   * Constitutional default: tenant visibility (Article IV.2)
   */
  route(message: Message): MessageRoute {
    const visibility = (message.visibility as Visibility) || 'tenant' // Constitutional default
    const recipients: AIBusSubscription[] = []
    
    // Get message tenant (for filtering)
    const messageTenantId = typeof message.tenant === 'string' 
      ? message.tenant 
      : message.tenant?.id
    
    // Route based on visibility level
    switch (visibility) {
      case 'private':
        // Only sender and explicitly mentioned users
        recipients.push(...this.getPrivateRecipients(message, messageTenantId))
        break
        
      case 'tenant':
        // All subscribers in the same tenant (Constitutional default)
        recipients.push(...this.getTenantRecipients(message, messageTenantId))
        break
        
      case 'network':
        // Federation-wide: all subscribed Angels across all tenants
        recipients.push(...this.getNetworkRecipients(message))
        break
    }
    
    return {
      message,
      recipients,
      visibility,
      routingDecision: recipients.length > 0 ? 'broadcast' : 'blocked',
      reason: this.getRoutingReason(visibility, recipients.length)
    }
  }
  
  /**
   * Get private message recipients
   * Only sender and explicitly mentioned users
   */
  private getPrivateRecipients(message: Message, tenantId: string | undefined): AIBusSubscription[] {
    const recipients: AIBusSubscription[] = []
    const senderId = typeof message.sender === 'string' ? message.sender : message.sender?.id
    
    // Always include sender
    const senderSub = this.subscriptions.get(senderId)
    if (senderSub) recipients.push(senderSub)
    
    // TODO: Parse message content for @mentions and add those users
    // For now, private = sender only
    
    return recipients
  }
  
  /**
   * Get tenant-level recipients
   * All subscribers in the same tenant (Constitutional default)
   */
  private getTenantRecipients(message: Message, tenantId: string | undefined): AIBusSubscription[] {
    if (!tenantId) return []
    
    const recipients: AIBusSubscription[] = []
    
    for (const subscription of this.subscriptions.values()) {
      // Must be in same tenant
      if (subscription.tenantId !== tenantId) continue
      
      // Must have tenant or network visibility level
      if (!subscription.visibilityLevels.includes('tenant') && 
          !subscription.visibilityLevels.includes('network')) continue
      
      // Apply optional filters
      if (!this.matchesFilters(message, subscription)) continue
      
      recipients.push(subscription)
    }
    
    return recipients
  }
  
  /**
   * Get network-level recipients
   * Federation-wide: all subscribed Angels across all tenants
   */
  private getNetworkRecipients(message: Message): AIBusSubscription[] {
    const recipients: AIBusSubscription[] = []
    
    for (const subscription of this.subscriptions.values()) {
      // Must have network visibility level
      if (!subscription.visibilityLevels.includes('network')) continue
      
      // Apply optional filters
      if (!this.matchesFilters(message, subscription)) continue
      
      recipients.push(subscription)
    }
    
    return recipients
  }
  
  /**
   * Check if message matches subscription filters
   */
  private matchesFilters(message: Message, subscription: AIBusSubscription): boolean {
    // Channel filter
    if (subscription.channelFilters && subscription.channelFilters.length > 0) {
      const channelId = typeof message.channel === 'string' ? message.channel : message.channel?.id
      if (!channelId || !subscription.channelFilters.includes(channelId)) {
        return false
      }
    }
    
    // Space filter
    if (subscription.spaceFilters && subscription.spaceFilters.length > 0) {
      const spaceId = typeof message.space === 'string' ? message.space : message.space?.id
      if (!spaceId || !subscription.spaceFilters.includes(spaceId)) {
        return false
      }
    }
    
    // Message type filter
    if (subscription.messageTypes && subscription.messageTypes.length > 0) {
      if (!message.messageType || !subscription.messageTypes.includes(message.messageType)) {
        return false
      }
    }
    
    return true
  }
  
  /**
   * Get human-readable routing reason
   */
  private getRoutingReason(visibility: Visibility, recipientCount: number): string {
    if (recipientCount === 0) {
      return `No subscribers for ${visibility} visibility`
    }
    
    switch (visibility) {
      case 'private':
        return `Private message - ${recipientCount} recipient(s)`
      case 'tenant':
        return `Tenant visibility - ${recipientCount} subscriber(s) in tenant (Constitutional default)`
      case 'network':
        return `Network visibility - ${recipientCount} federation subscriber(s)`
    }
  }
  
  /**
   * Get all active subscriptions for debugging
   */
  getSubscriptions(): AIBusSubscription[] {
    return Array.from(this.subscriptions.values())
  }
  
  /**
   * Get subscription count by type
   */
  getSubscriptionStats(): {
    total: number
    humans: number
    angels: number
    byTenant: Record<string, number>
  } {
    const stats = {
      total: this.subscriptions.size,
      humans: 0,
      angels: 0,
      byTenant: {} as Record<string, number>
    }
    
    for (const sub of this.subscriptions.values()) {
      if (sub.subscriberType === 'human') stats.humans++
      if (sub.subscriberType === 'angel') stats.angels++
      
      if (!stats.byTenant[sub.tenantId]) {
        stats.byTenant[sub.tenantId] = 0
      }
      stats.byTenant[sub.tenantId]++
    }
    
    return stats
  }
}

/**
 * Singleton AI Bus Router instance
 * Shared across all requests for consistent routing
 */
export const aiBusRouter = new AIBusRouter()

/**
 * Helper: Create subscription for a human user
 */
export function subscribeHuman(
  userId: string,
  tenantId: string,
  options?: {
    visibilityLevels?: Visibility[]
    channelFilters?: string[]
    spaceFilters?: string[]
    messageTypes?: string[]
  }
): AIBusSubscription {
  const subscription: AIBusSubscription = {
    subscriberId: userId,
    subscriberType: 'human',
    tenantId,
    visibilityLevels: options?.visibilityLevels || ['tenant'], // Default: tenant only
    channelFilters: options?.channelFilters,
    spaceFilters: options?.spaceFilters,
    messageTypes: options?.messageTypes
  }
  
  aiBusRouter.subscribe(subscription)
  return subscription
}

/**
 * Helper: Create subscription for an Angel agent
 */
export function subscribeAngel(
  angelId: string,
  tenantId: string,
  options?: {
    visibilityLevels?: Visibility[]
    channelFilters?: string[]
    spaceFilters?: string[]
    messageTypes?: string[]
  }
): AIBusSubscription {
  const subscription: AIBusSubscription = {
    subscriberId: angelId,
    subscriberType: 'angel',
    tenantId,
    visibilityLevels: options?.visibilityLevels || ['tenant', 'network'], // Angels can see network by default
    channelFilters: options?.channelFilters,
    spaceFilters: options?.spaceFilters,
    messageTypes: options?.messageTypes
  }
  
  aiBusRouter.subscribe(subscription)
  return subscription
}
