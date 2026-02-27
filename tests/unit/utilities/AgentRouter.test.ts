/**
 * Unit tests for Agent Router — mapToAgentContext logic.
 *
 * The routing itself requires Payload (tested in integration),
 * but the context mapping and data structure can be validated here.
 *
 * @see src/utilities/AgentRouter.ts
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement mapToAgentContext for isolated testing
// ---------------------------------------------------------------------------

interface AgentContext {
  id: number | string
  email: string
  name: string
  agentType: string
  displayName?: string
  personality?: string
  capabilities?: string[]
  responseRules?: Record<string, unknown>
  handoffTo?: number | string
  routingRules?: {
    channels?: Array<{ channelSlug: string }>
    keywords?: Array<{ keyword: string }>
    isDefault?: boolean
  }
}

function mapToAgentContext(agent: {
  id: number | string
  email: string
  name: string
  agentConfig?: {
    agentType?: string
    displayName?: string
    personality?: string
    capabilities?: string[]
    responseRules?: Record<string, unknown>
    handoffTo?: number | string
    routingRules?: {
      channels?: Array<{ channelSlug: string }>
      keywords?: Array<{ keyword: string }>
      isDefault?: boolean
    }
  }
}): AgentContext {
  return {
    id: agent.id,
    email: agent.email,
    name: agent.name,
    agentType: agent.agentConfig?.agentType ?? 'leo',
    displayName: agent.agentConfig?.displayName ?? agent.name,
    personality: agent.agentConfig?.personality,
    capabilities: agent.agentConfig?.capabilities ?? [],
    responseRules: agent.agentConfig?.responseRules,
    handoffTo: agent.agentConfig?.handoffTo,
    routingRules: agent.agentConfig?.routingRules,
  }
}

/**
 * Simulates routing priority logic (without Payload).
 * Returns the matched agent from a list, given channel/keyword/default criteria.
 */
function simulateRouting(
  agents: Array<ReturnType<typeof mapToAgentContext>>,
  context: { channelSlug?: string; messageText?: string },
): AgentContext | null {
  if (agents.length === 0) return null

  // 1. Channel-based
  if (context.channelSlug) {
    const channelAgent = agents.find((a) =>
      a.routingRules?.channels?.some((ch) => ch.channelSlug === context.channelSlug),
    )
    if (channelAgent) return channelAgent
  }

  // 2. Keyword-based
  if (context.messageText) {
    const text = context.messageText.toLowerCase()
    const keywordAgent = agents.find((a) =>
      a.routingRules?.keywords?.some((kw) => text.includes(kw.keyword.toLowerCase())),
    )
    if (keywordAgent) return keywordAgent
  }

  // 3. Default
  const defaultAgent = agents.find((a) => a.routingRules?.isDefault === true)
  if (defaultAgent) return defaultAgent

  // 4. Fallback to first
  return agents[0]
}

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const leoAgent = mapToAgentContext({
  id: 1,
  email: 'leo@system.spacesangels.com',
  name: 'LEO',
  agentConfig: {
    agentType: 'leo',
    displayName: 'LEO',
    personality: 'Friendly and helpful.',
    capabilities: ['query_products', 'query_posts', 'generate_image'],
    routingRules: {
      isDefault: true,
      channels: [{ channelSlug: 'general' }],
      keywords: [{ keyword: 'help' }, { keyword: 'product' }],
    },
  },
})

const supportAgent = mapToAgentContext({
  id: 2,
  email: 'support@system.spacesangels.com',
  name: 'Support Angel',
  agentConfig: {
    agentType: 'support',
    displayName: 'Support',
    personality: 'Patient and thorough.',
    capabilities: ['query_bookings', 'update_booking_status'],
    routingRules: {
      channels: [{ channelSlug: 'support' }, { channelSlug: 'help' }],
      keywords: [{ keyword: 'booking' }, { keyword: 'appointment' }, { keyword: 'cancel' }],
    },
  },
})

const merlinAgent = mapToAgentContext({
  id: 3,
  email: 'merlin@angelclaw.system',
  name: 'Merlin',
  agentConfig: {
    agentType: 'angelclaw',
    displayName: 'Merlin',
    personality: 'Bridge external AI agents.',
    capabilities: ['external_api', 'query_posts', 'query_products'],
    routingRules: {
      keywords: [{ keyword: 'merlin' }, { keyword: 'angelclaw' }, { keyword: 'external' }],
    },
  },
})

const agents = [leoAgent, supportAgent, merlinAgent]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mapToAgentContext', () => {
  it('maps all fields from agentConfig', () => {
    const ctx = mapToAgentContext({
      id: 1,
      email: 'test@system.local',
      name: 'Test',
      agentConfig: {
        agentType: 'custom',
        displayName: 'Test Bot',
        personality: 'Chill.',
        capabilities: ['query_posts'],
        handoffTo: 99,
        routingRules: {
          isDefault: false,
          channels: [{ channelSlug: 'test' }],
          keywords: [{ keyword: 'test' }],
        },
      },
    })
    expect(ctx.agentType).toBe('custom')
    expect(ctx.displayName).toBe('Test Bot')
    expect(ctx.capabilities).toEqual(['query_posts'])
    expect(ctx.handoffTo).toBe(99)
    expect(ctx.routingRules?.isDefault).toBe(false)
  })

  it('defaults agentType to "leo" when missing', () => {
    const ctx = mapToAgentContext({
      id: 1,
      email: 'test@system.local',
      name: 'Test',
    })
    expect(ctx.agentType).toBe('leo')
  })

  it('defaults displayName to agent name when missing', () => {
    const ctx = mapToAgentContext({
      id: 1,
      email: 'test@system.local',
      name: 'Fallback Name',
    })
    expect(ctx.displayName).toBe('Fallback Name')
  })

  it('defaults capabilities to empty array when missing', () => {
    const ctx = mapToAgentContext({
      id: 1,
      email: 'test@system.local',
      name: 'Test',
    })
    expect(ctx.capabilities).toEqual([])
  })
})

describe('Agent Routing Priority', () => {
  describe('1. Channel-based routing (highest priority)', () => {
    it('routes to support agent on support channel', () => {
      const result = simulateRouting(agents, { channelSlug: 'support' })
      expect(result?.agentType).toBe('support')
    })

    it('routes to LEO on general channel', () => {
      const result = simulateRouting(agents, { channelSlug: 'general' })
      expect(result?.agentType).toBe('leo')
    })

    it('falls through to keyword routing on unknown channel', () => {
      const result = simulateRouting(agents, {
        channelSlug: 'random',
        messageText: 'I need to cancel my booking',
      })
      expect(result?.agentType).toBe('support')
    })
  })

  describe('2. Keyword-based routing', () => {
    it('routes to support on "booking" keyword', () => {
      const result = simulateRouting(agents, {
        messageText: 'Can you check my booking status?',
      })
      expect(result?.agentType).toBe('support')
    })

    it('routes to merlin on "angelclaw" keyword', () => {
      const result = simulateRouting(agents, {
        messageText: 'Connect me to an angelclaw agent',
      })
      expect(result?.agentType).toBe('angelclaw')
    })

    it('keyword matching is case-insensitive', () => {
      // "MERLIN" (uppercase) should match merlin's keyword (lowercase)
      // Avoid "help" which LEO also matches
      const result = simulateRouting(agents, {
        messageText: 'Connect to MERLIN please',
      })
      expect(result?.agentType).toBe('angelclaw')
    })

    it('first keyword match wins', () => {
      // LEO has "help" keyword, Support has "cancel"
      const result = simulateRouting(agents, {
        messageText: 'help me cancel',
      })
      // LEO is first in the array and matches "help"
      expect(result?.agentType).toBe('leo')
    })
  })

  describe('3. Default agent fallback', () => {
    it('routes to default agent when no channel or keyword matches', () => {
      const result = simulateRouting(agents, {
        messageText: 'What is the meaning of life?',
      })
      expect(result?.agentType).toBe('leo')
      expect(result?.routingRules?.isDefault).toBe(true)
    })
  })

  describe('4. First-agent fallback', () => {
    it('falls back to first agent when no default is set', () => {
      const noDefault = agents.map((a) => ({
        ...a,
        routingRules: { ...a.routingRules, isDefault: false },
      }))
      const result = simulateRouting(noDefault, {
        messageText: 'Something completely unrelated',
      })
      expect(result?.id).toBe(1) // First agent
    })
  })

  describe('empty agent list', () => {
    it('returns null when no agents available', () => {
      const result = simulateRouting([], { messageText: 'hello' })
      expect(result).toBeNull()
    })
  })
})
