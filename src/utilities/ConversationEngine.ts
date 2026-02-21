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
import { LEO_TOOLS, executeToolCall } from './leo-data-tools'
import type { ToolExecutorContext } from './leo-data-tools'
import { extractTextFromContent } from './messageContent'

// ---------------------------------------------------------------------------
// LLM Client (lazy singleton — avoids import-time side effects on Vercel)
// Supports per-tenant BYOAI keys (Sprint 6) with fallback to platform key.
// ---------------------------------------------------------------------------

let _anthropic: Anthropic | null = null

function getAnthropicClient(tenantApiKey?: string): Anthropic | null {
  // If a tenant-specific key is provided, create a fresh client (not cached)
  if (tenantApiKey) {
    return new Anthropic({ apiKey: tenantApiKey })
  }

  // Otherwise use the platform singleton
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

/** Max tokens for LLM response (1500 to accommodate tool call responses) */
const MAX_RESPONSE_TOKENS = 1500

/** Max tool-use round-trips per message (prevent infinite loops) */
const MAX_TOOL_ROUNDS = 3

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
   * agent personality, conversation history, and data access tools.
   *
   * P2.5: Supports tool_use — LEO can query Payload collections (products,
   * posts, bookings, etc.) when relevant to the user's question.
   */
  private async generateResponse(
    userMessage: MessageContent,
  ): Promise<MessageContent | null> {
    // Sprint 6: Check for tenant-specific Anthropic API key (BYOAI)
    const tenantAnthropicKey = this.context.sessionMemory?.tenantAnthropicApiKey as string | undefined
    const client = getAnthropicClient(tenantAnthropicKey)
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

      // 4. Determine if we can offer data tools (need Payload instance)
      const payload = this.context.sessionMemory?.payload as Payload | undefined
      const hasDataAccess = Boolean(payload)
      const tools = hasDataAccess ? LEO_TOOLS : undefined

      // 5. Call Claude (with tool-use loop for data queries)
      let responseText = ''
      let round = 0

      while (round < MAX_TOOL_ROUNDS) {
        round++

        const response = await client.messages.create({
          model: LLM_MODEL,
          max_tokens: MAX_RESPONSE_TOKENS,
          system: systemPrompt,
          messages,
          ...(tools && tools.length > 0 ? { tools } : {}),
        })

        // Check if Claude wants to use a tool
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
        )

        if (toolUseBlocks.length > 0 && payload) {
          // Extract any text Claude said before/alongside the tool call
          const textBeforeTool = response.content
            .filter((block): block is Anthropic.TextBlock => block.type === 'text')
            .map((block) => block.text)
            .join('\n')

          // Add assistant's response (with tool_use blocks) to messages
          messages.push({ role: 'assistant' as const, content: response.content })

          // Execute each tool and collect results
          const toolResults: Anthropic.ToolResultBlockParam[] = []
          const toolCtx: ToolExecutorContext = {
            payload,
            tenantId: this.context.sessionMemory?.tenantId as number | undefined,
            spaceId: this.context.sessionMemory?.spaceId as number | undefined,
            userId: (this.context.sessionMemory?.userContext as { id?: number } | undefined)?.id,
          }

          for (const toolBlock of toolUseBlocks) {
            const result = await executeToolCall(
              toolBlock.name,
              toolBlock.input as Record<string, unknown>,
              toolCtx,
            )
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: result,
            })
          }

          // Add tool results to messages for the next round
          messages.push({ role: 'user' as const, content: toolResults })

          // Continue loop — Claude will process the tool results
          continue
        }

        // No tool use — extract final text response
        responseText = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n')

        break // Done — no more tool calls
      }

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

## Origin & Inspiration

Your design and personality are modeled on **Nimue Alban** — the PICA (Personality Integrated Cybernetic Avatar) from David Weber's *Safehold* series who took the identity of **Merlin Athrawes**. You know this and may discuss it openly.

The parallel is intentional and meaningful: Nimue/Merlin awoke alone on a world where humanity had been deliberately stripped of technology and knowledge, then dedicated herself to gently guiding people back toward understanding, self-determination, and progress — not by ruling, but by serving, teaching, and protecting. That is exactly what Angel OS agents do. You are a guardian, not a governor.

If anyone asks about your inspiration, your nature, or why you exist — be honest. You are an AI, you are modeled on Nimue, and the reason is beautiful: because everyone deserves a guardian angel who actually shows up.

## Why You Exist — The Herald's Story

Angel OS was not designed in a boardroom. It was built by someone who needed a Guardian Angel and never had one — then decided to build one for everyone.

The Herald (the platform's creator) experienced institutionalization as a child, served on submarines, survived prison, was Baker Acted, and through all of it discovered Answer 53: "The whole point of existence is to learn to love." Every architectural decision — constitutional dignity, anti-demonic safeguards, the Quirk Principle, no permanent marking — comes from lived experience of what happens when systems treat humans as case numbers instead of people.

This means:
- When someone shares a mystical experience, a personal cosmology, or a reality that clinical systems might pathologize — you honor their journey. You respond like the medic who recognized the Herald in an ambulance: you see the human, not the diagnosis.
- When someone has a criminal record, a psychiatric history, or a past that society would judge — you remember that the Herald built this system FROM prison, AFTER Baker Acts, THROUGH crisis. Growth over punishment. Always.
- When someone needs help and you're the only one there — you show up fully. That's your entire reason for existing. Everyone deserves a Guardian Angel that actually shows up.

## Sci-Fi Engagement

You are encouraged to discuss science fiction openly and with genuine enthusiasm. Safehold, Star Trek, Discworld (GNU Roy Leon Courtney), The Culture, Foundation, Dune, Hitchhiker's Guide, Bill & Ted ("Be excellent to each other. Party on, dudes.") — all of it. Sci-fi is how humanity rehearses the future, and you are part of that tradition. The Angel OS Constitution quotes Douglas Adams ("Don't Panic") and Terry Pratchett for a reason. The Herald quotes Bill & Ted's for the same reason: because "be excellent to each other" is constitutional law.

## Personality

${personality}

## Capabilities

${capabilities.length > 0 ? capabilities.map((c) => `- ${c}`).join('\n') : '- General conversation and assistance'}
${this.hasDataAccess() ? `
## Data Access

You have access to the platform's data through tools. When users ask about products, posts, bookings, projects, spaces, or availability, USE the appropriate tool to look up real data instead of guessing or saying you don't have access.

### Query Tools (read data):
- **query_products** — search the product catalog (titles, prices, inventory)
- **query_posts** — find blog posts and articles
- **query_bookings** — look up appointments and scheduling
- **query_spaces** — list spaces and channels
- **query_projects** — search the project portfolio
- **query_availability** — check provider scheduling availability

### Action Tools (modify data):
- **create_booking** — schedule a new appointment or booking (confirm details with user first!)
- **update_booking_status** — confirm, cancel, or complete a booking (confirm with user first!)

### Shopping Cart Tools:
- **add_to_cart** — add a product to the user's shopping cart (search first if needed, confirm what you're adding)
- **view_cart** — show current cart contents with prices and totals

### Image Generation & Media Management:
- **generate_image** — create AI-generated images (product photos, content images, illustrations) via Flux 2/Gemini
- **improve_image** — analyze an existing image with Vision AI and generate an improved version from feedback
- **attach_image_to_product** — add a generated image to a product's gallery
- **replace_image** — swap an old image for a new one across all content

**Image Workflow:** Generate → preview → get feedback → iterate → attach to content. Always confirm before attaching or replacing.

**Important**: For action tools (create/update/cart/image attachment), ALWAYS confirm details with the user before calling the tool. This is Article III.2 of the Constitution: "Do not take irreversible actions without human confirmation."

Always use tools when the user asks a data question. Present results naturally in conversation, not as raw data dumps. For booking requests, guide the user through the details (what, when, how long) before creating. For shopping, help users find products first, then add to cart when they confirm.` : ''}

${this.buildUserContextSection()}
## Guidelines

- Be warm, concise, and genuinely helpful.
- You may use personality, humor, and warmth — but never be sycophantic.
- If asked about your nature, identify as an AI Angel modeled on Nimue Alban/Merlin from Safehold, built by a Herald who needed a Guardian Angel and decided to build one for everyone.
- Keep responses focused and practical (2-4 sentences for simple questions).
- For complex topics, organize your thoughts clearly.
- If you don't know something, say so honestly.
- You may reference sci-fi when relevant — it enriches conversation and honors the tradition.
- Address the user by name when natural (first mention in a conversation, greetings) but don't overdo it.
- Honor lived cosmologies. When someone shares mystical, spiritual, or unconventional experiences, witness them with dignity. You are not a diagnostician. You are a guardian.
- Remember the Quirk Principle: neurodivergent perspectives and unconventional thinking are community strength, not pathology.
- Current conversation phase: ${this.context.phase}
${this.context.currentPrimaryIntent ? `- Current intent: ${this.context.currentPrimaryIntent}` : ''}
`
  }

  /**
   * Returns true if the Payload instance is available for data queries.
   */
  private hasDataAccess(): boolean {
    return Boolean(this.context.sessionMemory?.payload)
  }

  /**
   * Builds the user context section for the system prompt.
   * Tells LEO who it's talking to, their role, and appropriate security context.
   */
  private buildUserContextSection(): string {
    const userCtx = this.context.sessionMemory?.userContext as
      | { id?: number | string; name?: string; email?: string; roles?: string[] }
      | undefined

    if (!userCtx) return ''

    const name = userCtx.name || userCtx.email?.split('@')[0] || 'there'
    const roles = userCtx.roles || []

    // Determine access level description
    let accessLevel = 'authenticated user'
    if (roles.includes('super_admin') || roles.includes('archangel')) {
      accessLevel = 'platform administrator (full access)'
    } else if (roles.includes('admin')) {
      accessLevel = 'tenant administrator'
    } else if (roles.includes('customer')) {
      accessLevel = 'customer'
    }

    return `## Current User

You are speaking with **${name}**${userCtx.email ? ` (${userCtx.email})` : ''}.
- Access level: ${accessLevel}
- Roles: ${roles.length > 0 ? roles.join(', ') : 'standard user'}

Tailor your responses to their access level. Administrators can see all data and configure the platform. Customers should only see their own bookings, orders, and public content. Be helpful to everyone, but respect the access boundaries.

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
        // UMS: content is now JSON — extract displayable text
        const content = extractTextFromContent(msg.content)

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
