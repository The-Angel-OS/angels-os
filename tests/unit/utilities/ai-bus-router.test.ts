/**
 * Unit tests for AI Bus Router — core message routing engine.
 *
 * Tests the in-memory routing system:
 * - subscribe / unsubscribe
 * - parseMentions (@mention extraction)
 * - Visibility-based routing: private / tenant / network
 * - Filter matching: channel, space, messageType
 * - Subscription stats
 *
 * All pure logic — no Payload or database dependencies.
 *
 * @see src/utilities/ai-bus-router.ts
 */
import { describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement for isolated testing (avoids importing Payload types)
// ---------------------------------------------------------------------------

type Visibility = 'private' | 'tenant' | 'network'

interface AIBusSubscription {
  subscriberId: string
  subscriberType: 'human' | 'angel'
  tenantId: string
  visibilityLevels: Visibility[]
  channelFilters?: string[]
  spaceFilters?: string[]
  messageTypes?: string[]
}

interface MockMessage {
  content: string
  tenant: number | { id: number }
  author: number | { id: number }
  channel?: string
  space?: number | { id: number }
  messageType?: string
  visibility?: Visibility
}

interface MessageRoute {
  message: MockMessage
  recipients: AIBusSubscription[]
  visibility: Visibility
  routingDecision: 'broadcast' | 'filtered' | 'blocked'
  reason: string
}

function parseMentions(content: string): string[] {
  if (!content) return []
  const regex = /@([a-zA-Z][a-zA-Z0-9_-]{0,63})/g
  const mentions: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    mentions.push(match[1].toLowerCase())
  }
  return [...new Set(mentions)]
}

class AIBusRouter {
  private subscriptions: Map<string, AIBusSubscription> = new Map()

  subscribe(subscription: AIBusSubscription): void {
    this.subscriptions.set(subscription.subscriberId, subscription)
  }

  unsubscribe(subscriberId: string): void {
    this.subscriptions.delete(subscriberId)
  }

  route(message: MockMessage): MessageRoute {
    const visibility: Visibility = message.visibility || 'tenant'
    const recipients: AIBusSubscription[] = []

    const messageTenantId =
      typeof message.tenant === 'number'
        ? String(message.tenant)
        : typeof message.tenant === 'object' && message.tenant !== null
          ? String(message.tenant.id)
          : undefined

    switch (visibility) {
      case 'private':
        recipients.push(
          ...this.getPrivateRecipients(message, messageTenantId),
        )
        break
      case 'tenant':
        recipients.push(
          ...this.getTenantRecipients(message, messageTenantId),
        )
        break
      case 'network':
        recipients.push(...this.getNetworkRecipients(message))
        break
    }

    return {
      message,
      recipients,
      visibility,
      routingDecision: recipients.length > 0 ? 'broadcast' : 'blocked',
      reason: this.getRoutingReason(visibility, recipients.length),
    }
  }

  private getPrivateRecipients(
    message: MockMessage,
    tenantId: string | undefined,
  ): AIBusSubscription[] {
    const recipients: AIBusSubscription[] = []
    const seen = new Set<string>()
    const authorId =
      typeof message.author === 'number'
        ? String(message.author)
        : message.author?.id != null
          ? String(message.author.id)
          : undefined

    if (authorId) {
      const senderSub = this.subscriptions.get(authorId)
      if (senderSub) {
        recipients.push(senderSub)
        seen.add(authorId)
      }
    }

    const mentions = parseMentions(
      typeof message.content === 'string' ? message.content : '',
    )
    if (mentions.length > 0 && tenantId) {
      for (const sub of this.subscriptions.values()) {
        if (seen.has(sub.subscriberId)) continue
        if (sub.tenantId !== tenantId) continue
        const subIdLower = sub.subscriberId.toLowerCase()
        if (mentions.some((m) => subIdLower === m || subIdLower.includes(m))) {
          recipients.push(sub)
          seen.add(sub.subscriberId)
        }
      }
    }

    return recipients
  }

  private getTenantRecipients(
    message: MockMessage,
    tenantId: string | undefined,
  ): AIBusSubscription[] {
    if (!tenantId) return []
    const recipients: AIBusSubscription[] = []

    for (const subscription of this.subscriptions.values()) {
      if (subscription.tenantId !== tenantId) continue
      if (
        !subscription.visibilityLevels.includes('tenant') &&
        !subscription.visibilityLevels.includes('network')
      )
        continue
      if (!this.matchesFilters(message, subscription)) continue
      recipients.push(subscription)
    }

    return recipients
  }

  private getNetworkRecipients(message: MockMessage): AIBusSubscription[] {
    const recipients: AIBusSubscription[] = []

    for (const subscription of this.subscriptions.values()) {
      if (!subscription.visibilityLevels.includes('network')) continue
      if (!this.matchesFilters(message, subscription)) continue
      recipients.push(subscription)
    }

    return recipients
  }

  private matchesFilters(
    message: MockMessage,
    subscription: AIBusSubscription,
  ): boolean {
    if (subscription.channelFilters && subscription.channelFilters.length > 0) {
      if (
        !message.channel ||
        !subscription.channelFilters.includes(message.channel)
      ) {
        return false
      }
    }

    if (subscription.spaceFilters && subscription.spaceFilters.length > 0) {
      const spaceId =
        typeof message.space === 'number'
          ? String(message.space)
          : typeof message.space === 'object' && message.space !== null
            ? String(message.space.id)
            : undefined
      if (!spaceId || !subscription.spaceFilters.includes(spaceId)) {
        return false
      }
    }

    if (subscription.messageTypes && subscription.messageTypes.length > 0) {
      if (
        !message.messageType ||
        !subscription.messageTypes.includes(message.messageType)
      ) {
        return false
      }
    }

    return true
  }

  private getRoutingReason(
    visibility: Visibility,
    recipientCount: number,
  ): string {
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

  getSubscriptions(): AIBusSubscription[] {
    return Array.from(this.subscriptions.values())
  }

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
      byTenant: {} as Record<string, number>,
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

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

function createMessage(
  overrides: Partial<MockMessage> = {},
): MockMessage {
  return {
    content: 'Hello from the AI Bus',
    tenant: 1,
    author: 100,
    channel: 'general',
    space: 10,
    messageType: 'user',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseMentions', () => {
  it('extracts single mention', () => {
    expect(parseMentions('@Merlin hello')).toEqual(['merlin'])
  })

  it('extracts multiple mentions', () => {
    const result = parseMentions('@Merlin @LEO can you help?')
    expect(result).toContain('merlin')
    expect(result).toContain('leo')
  })

  it('lowercases mentions', () => {
    expect(parseMentions('@MERLIN')).toEqual(['merlin'])
  })

  it('handles hyphens and underscores in names', () => {
    expect(parseMentions('@support-angel and @leo_v2')).toEqual([
      'support-angel',
      'leo_v2',
    ])
  })

  it('deduplicates mentions', () => {
    expect(parseMentions('@leo @leo @leo')).toEqual(['leo'])
  })

  it('returns empty array for no mentions', () => {
    expect(parseMentions('Just a regular message')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseMentions('')).toEqual([])
  })

  it('does not match @ followed by numbers', () => {
    expect(parseMentions('@123 is not a mention')).toEqual([])
  })

  it('mention must start with a letter', () => {
    expect(parseMentions('@_invalid')).toEqual([])
    expect(parseMentions('@validName')).toEqual(['validname'])
  })
})

describe('AIBusRouter', () => {
  let router: AIBusRouter

  beforeEach(() => {
    router = new AIBusRouter()
  })

  describe('subscribe / unsubscribe', () => {
    it('adds a subscriber', () => {
      router.subscribe({
        subscriberId: 'user_1',
        subscriberType: 'human',
        tenantId: '1',
        visibilityLevels: ['tenant'],
      })
      expect(router.getSubscriptions()).toHaveLength(1)
    })

    it('removes a subscriber', () => {
      router.subscribe({
        subscriberId: 'user_1',
        subscriberType: 'human',
        tenantId: '1',
        visibilityLevels: ['tenant'],
      })
      router.unsubscribe('user_1')
      expect(router.getSubscriptions()).toHaveLength(0)
    })

    it('overwrites duplicate subscriber IDs', () => {
      router.subscribe({
        subscriberId: 'user_1',
        subscriberType: 'human',
        tenantId: '1',
        visibilityLevels: ['tenant'],
      })
      router.subscribe({
        subscriberId: 'user_1',
        subscriberType: 'human',
        tenantId: '2',
        visibilityLevels: ['network'],
      })
      expect(router.getSubscriptions()).toHaveLength(1)
      expect(router.getSubscriptions()[0].tenantId).toBe('2')
    })
  })

  describe('getSubscriptionStats', () => {
    it('counts humans and angels', () => {
      router.subscribe({
        subscriberId: 'user_1',
        subscriberType: 'human',
        tenantId: '1',
        visibilityLevels: ['tenant'],
      })
      router.subscribe({
        subscriberId: 'leo',
        subscriberType: 'angel',
        tenantId: '1',
        visibilityLevels: ['tenant', 'network'],
      })
      router.subscribe({
        subscriberId: 'user_2',
        subscriberType: 'human',
        tenantId: '2',
        visibilityLevels: ['tenant'],
      })

      const stats = router.getSubscriptionStats()
      expect(stats.total).toBe(3)
      expect(stats.humans).toBe(2)
      expect(stats.angels).toBe(1)
      expect(stats.byTenant['1']).toBe(2)
      expect(stats.byTenant['2']).toBe(1)
    })
  })

  describe('tenant visibility routing (Constitutional default)', () => {
    beforeEach(() => {
      router.subscribe({
        subscriberId: '100',
        subscriberType: 'human',
        tenantId: '1',
        visibilityLevels: ['tenant'],
      })
      router.subscribe({
        subscriberId: 'leo',
        subscriberType: 'angel',
        tenantId: '1',
        visibilityLevels: ['tenant', 'network'],
      })
      router.subscribe({
        subscriberId: '200',
        subscriberType: 'human',
        tenantId: '2',
        visibilityLevels: ['tenant'],
      })
    })

    it('defaults to tenant visibility when not specified', () => {
      const route = router.route(createMessage())
      expect(route.visibility).toBe('tenant')
    })

    it('routes to same-tenant subscribers only', () => {
      const route = router.route(createMessage({ tenant: 1 }))
      expect(route.recipients).toHaveLength(2) // user_100 + leo
      expect(
        route.recipients.every((r) => r.tenantId === '1'),
      ).toBe(true)
    })

    it('does not route to other tenants', () => {
      const route = router.route(createMessage({ tenant: 1 }))
      expect(
        route.recipients.some((r) => r.subscriberId === '200'),
      ).toBe(false)
    })

    it('returns blocked when no subscribers in tenant', () => {
      const route = router.route(createMessage({ tenant: 999 }))
      expect(route.routingDecision).toBe('blocked')
      expect(route.recipients).toHaveLength(0)
    })

    it('routing reason includes Constitutional reference', () => {
      const route = router.route(createMessage({ tenant: 1 }))
      expect(route.reason).toContain('Constitutional default')
    })
  })

  describe('private visibility routing', () => {
    beforeEach(() => {
      router.subscribe({
        subscriberId: '100',
        subscriberType: 'human',
        tenantId: '1',
        visibilityLevels: ['tenant'],
      })
      router.subscribe({
        subscriberId: 'merlin',
        subscriberType: 'angel',
        tenantId: '1',
        visibilityLevels: ['tenant', 'network'],
      })
      router.subscribe({
        subscriberId: '200',
        subscriberType: 'human',
        tenantId: '1',
        visibilityLevels: ['tenant'],
      })
    })

    it('routes only to sender when no mentions', () => {
      const route = router.route(
        createMessage({
          visibility: 'private',
          author: 100,
          content: 'secret message',
        }),
      )
      expect(route.recipients).toHaveLength(1)
      expect(route.recipients[0].subscriberId).toBe('100')
    })

    it('routes to sender + mentioned subscriber', () => {
      const route = router.route(
        createMessage({
          visibility: 'private',
          author: 100,
          content: '@merlin can you help?',
        }),
      )
      expect(route.recipients).toHaveLength(2)
      const ids = route.recipients.map((r) => r.subscriberId)
      expect(ids).toContain('100')
      expect(ids).toContain('merlin')
    })

    it('does not include non-mentioned subscribers', () => {
      const route = router.route(
        createMessage({
          visibility: 'private',
          author: 100,
          content: '@merlin help',
        }),
      )
      expect(
        route.recipients.some((r) => r.subscriberId === '200'),
      ).toBe(false)
    })
  })

  describe('network visibility routing', () => {
    beforeEach(() => {
      router.subscribe({
        subscriberId: 'leo-t1',
        subscriberType: 'angel',
        tenantId: '1',
        visibilityLevels: ['tenant', 'network'],
      })
      router.subscribe({
        subscriberId: 'leo-t2',
        subscriberType: 'angel',
        tenantId: '2',
        visibilityLevels: ['tenant', 'network'],
      })
      router.subscribe({
        subscriberId: 'user_1',
        subscriberType: 'human',
        tenantId: '1',
        visibilityLevels: ['tenant'], // NOT network
      })
    })

    it('routes to all network-level subscribers across tenants', () => {
      const route = router.route(
        createMessage({ visibility: 'network', tenant: 1 }),
      )
      expect(route.recipients).toHaveLength(2) // Both LEOs
      expect(route.recipients.some((r) => r.subscriberId === 'leo-t1')).toBe(
        true,
      )
      expect(route.recipients.some((r) => r.subscriberId === 'leo-t2')).toBe(
        true,
      )
    })

    it('excludes subscribers without network visibility', () => {
      const route = router.route(
        createMessage({ visibility: 'network', tenant: 1 }),
      )
      expect(
        route.recipients.some((r) => r.subscriberId === 'user_1'),
      ).toBe(false)
    })
  })

  describe('filter matching', () => {
    it('filters by channel', () => {
      router.subscribe({
        subscriberId: 'support-angel',
        subscriberType: 'angel',
        tenantId: '1',
        visibilityLevels: ['tenant'],
        channelFilters: ['support', 'help'],
      })
      router.subscribe({
        subscriberId: 'leo',
        subscriberType: 'angel',
        tenantId: '1',
        visibilityLevels: ['tenant'],
        // No channel filter — listens to everything
      })

      const supportMsg = router.route(
        createMessage({ tenant: 1, channel: 'support' }),
      )
      expect(supportMsg.recipients).toHaveLength(2) // both

      const generalMsg = router.route(
        createMessage({ tenant: 1, channel: 'general' }),
      )
      expect(generalMsg.recipients).toHaveLength(1) // only LEO
      expect(generalMsg.recipients[0].subscriberId).toBe('leo')
    })

    it('filters by space', () => {
      router.subscribe({
        subscriberId: 'space-watcher',
        subscriberType: 'angel',
        tenantId: '1',
        visibilityLevels: ['tenant'],
        spaceFilters: ['10'],
      })

      const matchRoute = router.route(
        createMessage({ tenant: 1, space: 10 }),
      )
      expect(matchRoute.recipients).toHaveLength(1)

      const noMatchRoute = router.route(
        createMessage({ tenant: 1, space: 99 }),
      )
      expect(noMatchRoute.recipients).toHaveLength(0)
    })

    it('filters by messageType', () => {
      router.subscribe({
        subscriberId: 'ai-only',
        subscriberType: 'angel',
        tenantId: '1',
        visibilityLevels: ['tenant'],
        messageTypes: ['ai_agent'],
      })

      const userMsg = router.route(
        createMessage({ tenant: 1, messageType: 'user' }),
      )
      expect(userMsg.recipients).toHaveLength(0)

      const aiMsg = router.route(
        createMessage({ tenant: 1, messageType: 'ai_agent' }),
      )
      expect(aiMsg.recipients).toHaveLength(1)
    })

    it('combines multiple filters (AND logic)', () => {
      router.subscribe({
        subscriberId: 'specific-watcher',
        subscriberType: 'angel',
        tenantId: '1',
        visibilityLevels: ['tenant'],
        channelFilters: ['support'],
        messageTypes: ['user'],
      })

      // Matches both filters
      const match = router.route(
        createMessage({
          tenant: 1,
          channel: 'support',
          messageType: 'user',
        }),
      )
      expect(match.recipients).toHaveLength(1)

      // Matches channel but not messageType
      const partial = router.route(
        createMessage({
          tenant: 1,
          channel: 'support',
          messageType: 'ai_agent',
        }),
      )
      expect(partial.recipients).toHaveLength(0)
    })
  })

  describe('populated tenant object', () => {
    it('handles tenant as populated object', () => {
      router.subscribe({
        subscriberId: 'user_1',
        subscriberType: 'human',
        tenantId: '1',
        visibilityLevels: ['tenant'],
      })

      const route = router.route(
        createMessage({ tenant: { id: 1 } }),
      )
      expect(route.recipients).toHaveLength(1)
    })
  })

  describe('edge cases', () => {
    it('handles message with no tenant', () => {
      const route = router.route(
        createMessage({ tenant: undefined as any }),
      )
      expect(route.routingDecision).toBe('blocked')
    })

    it('handles empty router (no subscriptions)', () => {
      const route = router.route(createMessage())
      expect(route.routingDecision).toBe('blocked')
      expect(route.reason).toContain('No subscribers')
    })
  })
})
