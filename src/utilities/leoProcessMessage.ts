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
import type { MessageContent } from '@/types/messages'

export type UserContext = {
  id: number | string
  name?: string
  email?: string
  roles?: string[]
}

/** Context from a federation peer when message arrives via cross-tenant AI Bus */
export type FederatedContext = {
  /** Display name of the sending peer (e.g. 'Clearwater Angels') */
  peerName: string
  /** Trust level of the peer: 'vouched' | 'full' */
  trustLevel: string
  /** Peer's federation ID */
  federationId: string
  /** Peer's domain */
  peerDomain?: string
}

export type ProcessMessageOptions = {
  message: string
  conversationId?: string
  tenantId?: number | string
  channelSlug?: string
  spaceId?: number | string
  agentId?: number | string
  payload?: Payload
  userContext?: UserContext
  /** Current page path (e.g. '/shop/product-slug') — gives LEO browsing context */
  pageContext?: string
  /** Federation context when message arrives from a cross-tenant peer */
  federatedContext?: FederatedContext
}

export type ProcessMessageResult = {
  text: string
  conversationId: string
  phase?: string
  agentName?: string
  agentType?: string
  /** True when the node is agent-cold (FEDERATION_AGENT_AUTORESPOND=false) and
   * skipped the LLM entirely — callers should not post a reply. */
  suppressed?: boolean
}

/**
 * Whether this node auto-responds with the LLM. A federation TEST node (e.g.
 * kendev.co / Node B) sets FEDERATION_AGENT_AUTORESPOND=false so it coordinates,
 * heartbeats, and replicates over the (token-free) protocol, but never spends
 * model tokens auto-thinking. Default (unset) = enabled, so prod is unaffected.
 */
export function agentAutoRespondEnabled(): boolean {
  return process.env.FEDERATION_AGENT_AUTORESPOND !== 'false'
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
  const { message, conversationId, tenantId, channelSlug, spaceId, agentId, payload, userContext, pageContext, federatedContext } =
    options

  // Agent-cold: skip the LLM entirely on a node configured not to auto-respond
  // (federation test peers). Zero tokens; callers see `suppressed` and stay quiet.
  if (!agentAutoRespondEnabled()) {
    return {
      text: '',
      conversationId: conversationId ?? `conv_${Date.now()}`,
      agentName: 'LEO',
      agentType: 'leo',
      suppressed: true,
    }
  }

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

  // Sprint 6→44: Resolve tenant AI config for BYOAI key support (multi-provider)
  let tenantAnthropicApiKey: string | undefined
  let tenantAiConfig: Record<string, unknown> | undefined
  if (payload && tenantId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tenant = await payload.findByID({ collection: 'tenants', id: Number(tenantId), depth: 0 }) as any
      if (tenant?.aiConfig) {
        const ac = tenant.aiConfig
        if (ac.anthropicApiKey) tenantAnthropicApiKey = ac.anthropicApiKey
        // Pass full aiConfig so image gen + tool executor can resolve providers
        tenantAiConfig = {
          anthropicApiKey: ac.anthropicApiKey || undefined,
          openrouterApiKey: ac.openrouterApiKey || undefined,
          openaiApiKey: ac.openaiApiKey || undefined,
          googleAiApiKey: ac.googleAiApiKey || undefined,
          cloudflareAccountId: ac.cloudflareAccountId || undefined,
          cloudflareAiToken: ac.cloudflareAiToken || undefined,
          preferredImageProvider: ac.preferredImageProvider || 'auto',
        }
      }
    } catch {
      // Non-fatal — fall back to platform key
    }
  }

  const engine = new ConversationEngine({
    conversationId: conversationId ?? `conv_${Date.now()}`,
    phase: 'greeting',
    intentHistory: [],
    sessionMemory: payload
      ? {
          payload,
          ...(tenantId ? { tenantId: Number(tenantId) } : {}),
          ...(spaceId ? { spaceId: Number(spaceId) } : {}),
          ...(channelSlug ? { channel: channelSlug } : {}),
          ...(userContext ? { userContext } : {}),
          ...(tenantAnthropicApiKey ? { tenantAnthropicApiKey } : {}),
          ...(tenantAiConfig ? { tenantAiConfig } : {}),
          ...(pageContext ? { pageContext } : {}),
          ...(federatedContext ? { federatedContext } : {}),
        }
      : {},
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
    metadata: { conversationId: conversationId ?? undefined },
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
