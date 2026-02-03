/**
 * Processes a message through the ConversationEngine with agent routing.
 * Used by MCP leo_respond tool and future chat API.
 *
 * @see ConversationEngine
 * @see AgentRouter
 * @see src/types/conversation.ts
 */
import type { Payload } from 'payload'

import { ConversationEngine } from './ConversationEngine'
import { routeToAgent } from './AgentRouter'
import type { MessageContent } from '@/types/conversation'

export type ProcessMessageOptions = {
  message: string
  conversationId?: string
  tenantId?: number | string
  channelSlug?: string
  agentId?: number | string
  payload?: Payload
}

export type ProcessMessageResult = {
  text: string
  conversationId: string
  phase?: string
  agentName?: string
  agentType?: string
}

/**
 * Process a user message through the ConversationEngine with agent routing.
 * When payload is provided, the engine can use it for data-rich intents
 * (e.g., "show recent posts" -> payload.find posts).
 * 
 * Agent selection:
 * 1. If agentId provided, use that agent
 * 2. Otherwise, route based on tenantId, channelSlug, and message content
 * 3. Fallback to default agent (usually LEO)
 */
export async function leoProcessMessage(
  options: ProcessMessageOptions,
): Promise<ProcessMessageResult> {
  const { message, conversationId, tenantId, channelSlug, agentId, payload } = options

  // Determine which agent should handle this message
  let agent = null
  if (payload && tenantId) {
    if (agentId) {
      const { getAgentById } = await import('./AgentRouter')
      agent = await getAgentById(payload, agentId)
    } else {
      agent = await routeToAgent(payload, {
        tenantId,
        channelSlug,
        messageText: message,
      })
    }
  }

  const engine = new ConversationEngine({
    conversationId: conversationId ?? `conv_${Date.now()}`,
    sessionMemory: payload ? { payload } : {},
    agent: agent ? {
      id: agent.id,
      agentType: agent.agentType,
      displayName: agent.displayName ?? agent.name,
      personality: agent.personality,
      capabilities: agent.capabilities,
      responseRules: agent.responseRules,
    } : undefined,
  })

  const msg: MessageContent = {
    type: 'text',
    text: message,
    metadata: { timestamp: new Date().toISOString() },
  }

  const response = await engine.handleIncomingMessage(msg)
  const context = engine.getCurrentContext()

  if (response?.text) {
    return {
      text: response.text,
      conversationId: context.conversationId,
      phase: context.phase,
      agentName: agent?.displayName ?? 'LEO',
      agentType: agent?.agentType ?? 'leo',
    }
  }

  // No explicit response - generate a default (e.g. for "log_message" action)
  const agentName = agent?.displayName ?? 'LEO'
  return {
    text: `${agentName}: I received your message. How can I assist you today?`,
    conversationId: context.conversationId,
    phase: context.phase,
    agentName,
    agentType: agent?.agentType ?? 'leo',
  }
}
