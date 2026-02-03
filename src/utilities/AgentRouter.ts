/**
 * Agent Router – determines which system agent should handle a message.
 * Routes based on channel, keywords, and agent configuration.
 *
 * @see src/collections/Users/index.ts (agentConfig)
 * @see src/utilities/ConversationEngine.ts
 */
import type { Payload } from 'payload'

export interface AgentContext {
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

export interface RoutingContext {
  tenantId: number | string
  channelSlug?: string
  messageText?: string
  userId?: number | string
}

/**
 * Find the appropriate agent for a message based on routing rules.
 */
export async function routeToAgent(
  payload: Payload,
  context: RoutingContext,
): Promise<AgentContext | null> {
  // Find all system agents for this tenant
  const agents = await payload.find({
    collection: 'users',
    where: {
      and: [
        { isSystemUser: { equals: true } },
        { servesTenant: { equals: context.tenantId } },
      ],
    },
    depth: 0,
    overrideAccess: true,
    limit: 100,
  })

  if (!agents.docs || agents.docs.length === 0) {
    return null
  }

  const systemAgents = agents.docs as Array<{
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
  }>

  // 1. Channel-based routing
  if (context.channelSlug) {
    const channelAgent = systemAgents.find((agent) => {
      const channels = agent.agentConfig?.routingRules?.channels ?? []
      return channels.some((ch) => ch.channelSlug === context.channelSlug)
    })
    if (channelAgent) {
      return mapToAgentContext(channelAgent)
    }
  }

  // 2. Keyword-based routing
  if (context.messageText) {
    const text = context.messageText.toLowerCase()
    const keywordAgent = systemAgents.find((agent) => {
      const keywords = agent.agentConfig?.routingRules?.keywords ?? []
      return keywords.some((kw) => text.includes(kw.keyword.toLowerCase()))
    })
    if (keywordAgent) {
      return mapToAgentContext(keywordAgent)
    }
  }

  // 3. Default agent (usually LEO)
  const defaultAgent = systemAgents.find(
    (agent) => agent.agentConfig?.routingRules?.isDefault === true,
  )
  if (defaultAgent) {
    return mapToAgentContext(defaultAgent)
  }

  // 4. Fallback to first agent (usually LEO)
  return mapToAgentContext(systemAgents[0])
}

/**
 * Get agent by ID.
 */
export async function getAgentById(
  payload: Payload,
  agentId: number | string,
): Promise<AgentContext | null> {
  const agent = await payload.findByID({
    collection: 'users',
    id: agentId,
    depth: 0,
    overrideAccess: true,
  })

  if (!agent || !(agent as { isSystemUser?: boolean }).isSystemUser) {
    return null
  }

  return mapToAgentContext(agent as any)
}

/**
 * Get all agents for a tenant.
 */
export async function getTenantAgents(
  payload: Payload,
  tenantId: number | string,
): Promise<AgentContext[]> {
  const agents = await payload.find({
    collection: 'users',
    where: {
      and: [
        { isSystemUser: { equals: true } },
        { servesTenant: { equals: tenantId } },
      ],
    },
    depth: 0,
    overrideAccess: true,
    limit: 100,
  })

  if (!agents.docs || agents.docs.length === 0) {
    return []
  }

  return agents.docs.map((agent) => mapToAgentContext(agent as any))
}

/**
 * Map user doc to AgentContext.
 */
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
