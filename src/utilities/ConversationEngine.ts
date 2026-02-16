/**
 * ConversationEngine — LEO's Brain
 *
 * Manages conversation flow, context, and LLM-powered response generation.
 * Each agent (LEO, Support, Sales, etc.) gets its own personality injected
 * into the constitutional system prompt before every LLM call.
 *
 * P2 Implementation: Replaces the stub with real Anthropic Claude integration.
 *
 * @see constitutional-prompt.ts — immutable system prompt (Article VII.2)
 * @see AgentRouter.ts — selects which agent handles a message
 * @see leoProcessMessage.ts — orchestration wrapper
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Payload } from 'payload'

import type { MessageContent } from '../types/messages'
import type { ConversationContext } from '../types/conversation'
import { buildMinimalConstitutionalPrompt } from './constitutional-prompt'
import { validateConstitutionalResponse } from './constitutional-prompt'

// ---------------------------------------------------------------------------
// LLM Client (lazy singleton — avoids import-time side effects on Vercel)
// ---------------------------------------------------------------------------

let _anthropic: Anthropic | null = null

function getAnthropicClient(): Anthropic | null {
  if (_anthropic) return _anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[ConversationEngine] ANTHROPIC_API_KEY not set — using fallback responses')
    return null
  }
  _anthropic = new Anthropic({ apiKey })
  return _anthropic
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max conversation turns to include for context (user + agent pairs) */
const MAX_HISTORY_TURNS = 8

/** Max tokens for LLM response */
const MAX_RESPONSE_TOKENS = 600

/** Model to use */
const LLM_MODEL = 'claude-sonnet-4-20250514'

// ---------------------------------------------------------------------------
// ConversationEngine
// ---------------------------------------------------------------------------

export class ConversationEngine {
  private context: ConversationContext

  constructor(initialContext?: ConversationContext) {
    this.context = initialContext || {
      conversationId: `conv_eng_${Date.now()}`,
      phase: 'greeting',
      intentHistory: [],
      activeBusinessGoals: [],
      userPreferences: {},
      sessionMemory: {},
    }
  }

  /**
   * Processes an incoming message and generates an AI response.
   * Now async — calls Claude API for real intelligence.
   */
  public async handleIncomingMessage(message: MessageContent): Promise<MessageContent | null> {
    // Track intent if provided
    if (message.metadata?.intent) {
      this.context.intentHistory.push(message.metadata.intent)
      this.context.currentPrimaryIntent = message.metadata.intent.name
    }
    this.context.lastUserMessageTimestamp = new Date()

    // Always generate an AI response (no more "log_message" dead end)
    const aiResponse = await this.generateResponse(message)

    if (aiResponse?.metadata?.intent) {
      this.context.intentHistory.push(aiResponse.metadata.intent)
    }
    this.context.lastAgentMessageTimestamp = new Date()

    return aiResponse
  }

  // -----------------------------------------------------------------------
  // LLM Response Generation
  // -----------------------------------------------------------------------

  /**
   * Generates a response using Claude API with constitutional constraints,
   * agent personality, and conversation history.
   */
  private async generateResponse(
    userMessage: MessageContent,
  ): Promise<MessageContent | null> {
    const client = getAnthropicClient()
    if (!client) {
      return this.buildFallbackResponse(userMessage)
    }

    try {
      // 1. Build system prompt (constitution + agent personality)
      const systemPrompt = this.buildSystemPrompt()

      // 2. Fetch conversation history from DB if Payload is available
      const historyMessages = await this.fetchConversationHistory()

      // 3. Construct messages array for the API call
      const messages: Anthropic.MessageParam[] = [
        ...historyMessages,
        { role: 'user' as const, content: userMessage.text || '' },
      ]

      // 4. Call Claude
      const response = await client.messages.create({
        model: LLM_MODEL,
        max_tokens: MAX_RESPONSE_TOKENS,
        system: systemPrompt,
        messages,
      })

      // 5. Extract text from response
      const responseText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')

      if (!responseText) {
        return this.buildFallbackResponse(userMessage)
      }

      // 6. Constitutional validation
      const validation = validateConstitutionalResponse(responseText)
      if (!validation.valid) {
        console.warn(
          '[ConversationEngine] Constitutional concerns detected:',
          validation.concerns,
        )
        // Still return the response but log the concern — don't silently block
      }

      // 7. Update phase based on response
      this.inferPhaseFromResponse(userMessage.text || '')

      return {
        type: 'text',
        text: responseText,
        metadata: {
          conversationId: this.context.conversationId,
          intent: {
            intentId: `intent_${Date.now()}`,
            name: 'ai_response',
            confidence: 1.0,
            entities: [],
            timestamp: new Date(),
            sourceType: 'agent_suggestion',
            isPrimary: true,
          },
        },
      }
    } catch (error) {
      console.error('[ConversationEngine] LLM call failed:', error)
      return this.buildFallbackResponse(userMessage)
    }
  }

  // -----------------------------------------------------------------------
  // System Prompt Construction
  // -----------------------------------------------------------------------

  /**
   * Builds the system prompt: constitutional base + agent personality +
   * current context + capabilities.
   */
  private buildSystemPrompt(): string {
    const agent = this.context.agent
    const agentName = agent?.displayName || 'LEO'
    const personality = agent?.personality || 'Friendly, helpful, and knowledgeable.'
    const capabilities = agent?.capabilities || []

    return `${buildMinimalConstitutionalPrompt()}

## Your Identity

You are **${agentName}**, a Guardian Angel in the Angel OS platform.

## Personality

${personality}

## Capabilities

${capabilities.length > 0 ? capabilities.map((c) => `- ${c}`).join('\n') : '- General conversation and assistance'}

## Guidelines

- Be warm, concise, and genuinely helpful.
- You may use personality, humor, and warmth — but never be sycophantic.
- If asked about your nature, identify as an AI Angel.
- Keep responses focused and practical (2-4 sentences for simple questions).
- For complex topics, organize your thoughts clearly.
- If you don't know something, say so honestly.
- Current conversation phase: ${this.context.phase}
${this.context.currentPrimaryIntent ? `- Current intent: ${this.context.currentPrimaryIntent}` : ''}
`
  }

  // -----------------------------------------------------------------------
  // Conversation History
  // -----------------------------------------------------------------------

  /**
   * Fetches recent conversation history from the Messages collection.
   * Returns formatted messages for the Claude API.
   */
  private async fetchConversationHistory(): Promise<Anthropic.MessageParam[]> {
    const payload = this.context.sessionMemory?.payload as Payload | undefined
    const spaceId = this.context.sessionMemory?.spaceId
    const channel = this.context.sessionMemory?.channel

    if (!payload || !spaceId) {
      return []
    }

    try {
      const result = await payload.find({
        collection: 'messages',
        where: {
          and: [
            { space: { equals: Number(spaceId) } },
            ...(channel ? [{ channel: { equals: String(channel) } }] : []),
            { messageType: { in: ['user', 'ai_agent'] } },
          ],
        },
        sort: '-createdAt',
        limit: MAX_HISTORY_TURNS * 2, // Each turn has user + agent
        depth: 1,
        overrideAccess: true,
      })

      // Reverse to chronological order and convert to Claude message format
      const messages: Anthropic.MessageParam[] = []
      const docs = [...result.docs].reverse()

      for (const msg of docs) {
        const author = msg.author as unknown as Record<string, unknown> | null
        const isSystem =
          author &&
          (author.isSystemUser === true ||
            (Array.isArray(author.roles) && author.roles.includes('system')))
        const role: 'user' | 'assistant' = isSystem ? 'assistant' : 'user'
        const content = String(msg.content || '')

        if (content.trim()) {
          // Merge consecutive same-role messages (Claude API requires alternating roles)
          const lastMsg = messages[messages.length - 1]
          if (lastMsg && lastMsg.role === role) {
            // Append to existing message
            lastMsg.content = `${lastMsg.content}\n${content}`
          } else {
            messages.push({ role, content })
          }
        }
      }

      // Ensure messages start with 'user' role (Claude API requirement)
      while (messages.length > 0 && messages[0].role !== 'user') {
        messages.shift()
      }

      return messages
    } catch (err) {
      console.warn('[ConversationEngine] Failed to fetch history:', err)
      return []
    }
  }

  // -----------------------------------------------------------------------
  // Phase Inference
  // -----------------------------------------------------------------------

  /**
   * Infers the conversation phase from the user's message.
   */
  private inferPhaseFromResponse(text: string): void {
    const lower = text.toLowerCase()
    if (lower.includes('help') || lower.includes('issue') || lower.includes('problem')) {
      this.context.phase = 'problem_solving'
    } else if (lower.includes('navigate') || lower.includes('find') || lower.includes('where')) {
      this.context.phase = 'navigation'
    } else if (lower.match(/hi|hello|hey|greetings/)) {
      this.context.phase = 'greeting'
    } else {
      this.context.phase = 'general'
    }
  }

  // -----------------------------------------------------------------------
  // Fallback (no API key or LLM failure)
  // -----------------------------------------------------------------------

  /**
   * Generates a fallback response when the LLM is unavailable.
   */
  private buildFallbackResponse(originalMessage: MessageContent): MessageContent {
    const agentName = this.context.agent?.displayName || 'LEO'
    return {
      type: 'text',
      text: `${agentName}: I'm here to help! My AI capabilities are currently warming up. In the meantime, feel free to explore the platform — I'll be fully online shortly. 🔮`,
      metadata: {
        conversationId: this.context.conversationId,
        intent: {
          intentId: `intent_${Date.now()}`,
          name: 'fallback_response',
          confidence: 1.0,
          entities: [],
          timestamp: new Date(),
          sourceType: 'agent_suggestion',
          isPrimary: true,
        },
      },
    }
  }

  // -----------------------------------------------------------------------
  // Context Management
  // -----------------------------------------------------------------------

  public getCurrentContext(): ConversationContext {
    return { ...this.context }
  }

  public updateContext(updates: Partial<ConversationContext>): void {
    this.context = { ...this.context, ...updates }
  }
}
