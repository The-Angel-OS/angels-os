/**
 * ConversationEngine — LEO's Brain
 *
 * Manages conversation flow, context, and LLM-powered response generation.
 * Each agent (LEO, Support, Sales, etc.) gets its own personality injected
 * into the constitutional system prompt before every LLM call.
 *
 * Supports two LLM paths:
 *   1. Vercel AI Gateway (preferred) — multi-model via AI SDK
 *   2. Direct Anthropic SDK (fallback) — when gateway key is not configured
 *
 * @see constitutional-prompt.ts — immutable system prompt (Article VII.2)
 * @see AgentRouter.ts — selects which agent handles a message
 * @see leoProcessMessage.ts — orchestration wrapper
 * @see ai-gateway.ts — Vercel AI Gateway integration
 */

import Anthropic from '@anthropic-ai/sdk'
import { generateText, stepCountIs } from 'ai'
import type { ModelMessage } from 'ai'
import fs from 'fs'
import path from 'path'
import type { Payload } from 'payload'

import type { MessageContent } from '../types/messages'
import type { ConversationContext } from '../types/conversation'
import { buildMinimalConstitutionalPrompt } from './constitutional-prompt'
import { logError } from './logError'
import { validateConstitutionalResponse } from './constitutional-prompt'
import { LEO_TOOLS, executeToolCall } from './leo-data-tools'
import type { ToolExecutorContext } from './leo-data-tools'
import { extractTextFromContent } from './messageContent'
import { isGatewayAvailable, convertToolsForAISDK, getSmartModel } from './ai-gateway'
import type { TaskComplexity } from './ai-gateway'

// ---------------------------------------------------------------------------
// Minimal env-file parser — avoids dotenv import issues with bundler resolution.
// Handles KEY=VALUE, KEY="VALUE", KEY='VALUE', and skips comments/blank lines.
// ---------------------------------------------------------------------------
function parseEnvFile(src: Buffer | string): Record<string, string> {
  const str = Buffer.isBuffer(src) ? src.toString('utf8') : src
  const result: Record<string, string> = {}
  for (const line of str.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
    result[key] = val
  }
  return result
}

// ---------------------------------------------------------------------------
// Env helper — reads ANTHROPIC_API_KEY directly from .env.local when the
// process.env value is empty (happens when a parent process like Claude Code
// shadows the variable with an empty string, preventing dotenv from loading it).
// ---------------------------------------------------------------------------

let _envFileKey: string | undefined

function resolveAnthropicKey(): string | undefined {
  const envVal = process.env.ANTHROPIC_API_KEY
  if (envVal) return envVal
  if (_envFileKey) return _envFileKey

  try {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      const parsed = parseEnvFile(fs.readFileSync(envPath))
      if (parsed.ANTHROPIC_API_KEY) {
        _envFileKey = parsed.ANTHROPIC_API_KEY
        return _envFileKey
      }
    }
    const envFallback = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(envFallback)) {
      const parsed = parseEnvFile(fs.readFileSync(envFallback))
      if (parsed.ANTHROPIC_API_KEY) {
        _envFileKey = parsed.ANTHROPIC_API_KEY
        return _envFileKey
      }
    }
  } catch (err) {
    logError({ level: 'warning', source: 'ConversationEngine/resolveKey', message: `Failed to read .env files: ${err}` }).catch(() => {})
  }

  return undefined
}

// ---------------------------------------------------------------------------
// LLM Client (lazy singleton — Anthropic SDK fallback)
// ---------------------------------------------------------------------------

let _anthropic: Anthropic | null = null
let _cachedKey: string | undefined

function getAnthropicClient(tenantApiKey?: string): Anthropic | null {
  if (tenantApiKey) {
    return new Anthropic({ apiKey: tenantApiKey })
  }

  const apiKey = resolveAnthropicKey()
  if (_anthropic && _cachedKey === apiKey) return _anthropic

  if (!apiKey) {
    logError({ level: 'warning', source: 'ConversationEngine', message: 'ANTHROPIC_API_KEY not set — using fallback responses' }).catch(() => {})
    return null
  }
  _anthropic = new Anthropic({ apiKey })
  _cachedKey = apiKey
  return _anthropic
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HISTORY_TURNS = 8
const MAX_RESPONSE_TOKENS = 1500
const MAX_TOOL_ROUNDS = 3
const LLM_MODEL = 'claude-sonnet-4-6'

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

  public async handleIncomingMessage(message: MessageContent): Promise<MessageContent | null> {
    if (message.metadata?.intent) {
      this.context.intentHistory.push(message.metadata.intent)
      this.context.currentPrimaryIntent = message.metadata.intent.name
    }
    this.context.lastUserMessageTimestamp = new Date()

    const aiResponse = await this.generateResponse(message)

    if (aiResponse?.metadata?.intent) {
      this.context.intentHistory.push(aiResponse.metadata.intent)
    }
    this.context.lastAgentMessageTimestamp = new Date()

    return aiResponse
  }

  // -----------------------------------------------------------------------
  // LLM Response Generation — Router
  // -----------------------------------------------------------------------

  private async generateResponse(
    userMessage: MessageContent,
  ): Promise<MessageContent | null> {
    // Sprint 6: BYOAI (tenant-specific key) always uses direct Anthropic SDK
    const tenantAnthropicKey = this.context.sessionMemory?.tenantAnthropicApiKey as string | undefined
    if (tenantAnthropicKey) {
      return this.generateViaAnthropic(userMessage, tenantAnthropicKey)
    }

    // Prefer Vercel AI Gateway when available (multi-model support)
    if (isGatewayAvailable()) {
      return this.generateViaGateway(userMessage)
    }

    // Fallback to direct Anthropic SDK
    return this.generateViaAnthropic(userMessage)
  }

  // -----------------------------------------------------------------------
  // Path 1: Vercel AI Gateway (AI SDK)
  // -----------------------------------------------------------------------

  private async generateViaGateway(
    userMessage: MessageContent,
  ): Promise<MessageContent | null> {
    // Smart model selection: credit-aware, with gateway-native fallback chain
    const tenantId = this.context.sessionMemory?.tenantId as number | undefined
    const userId = (this.context.sessionMemory?.userContext as { id?: number } | undefined)?.id
    const smart = await getSmartModel('medium', {
      tenantId,
      userId,
      tags: ['leo-chat'],
    })
    if (!smart) return this.buildFallbackResponse(userMessage)

    try {
      const systemPrompt = this.buildSystemPrompt()
      const historyMessages = await this.fetchConversationHistory()

      // Convert history to AI SDK format
      const messages: ModelMessage[] = historyMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
      }))
      messages.push({ role: 'user', content: userMessage.text || '' })

      // Convert tools
      const payload = this.context.sessionMemory?.payload as Payload | undefined
      const toolCtx: ToolExecutorContext = {
        payload: payload!,
        tenantId,
        spaceId: this.context.sessionMemory?.spaceId as number | undefined,
        userId,
      }
      const tools = payload
        ? convertToolsForAISDK(LEO_TOOLS, executeToolCall, toolCtx)
        : undefined

      // Gateway handles fallback via providerOptions.gateway.models — no manual try/catch
      const result = await generateText({
        model: smart.model,
        system: systemPrompt,
        messages,
        tools,
        stopWhen: stepCountIs(MAX_TOOL_ROUNDS),
        maxOutputTokens: MAX_RESPONSE_TOKENS,
        providerOptions: smart.providerOptions,
      })

      const responseText = result.text
      if (!responseText) return this.buildFallbackResponse(userMessage)

      // Constitutional validation
      const validation = validateConstitutionalResponse(responseText)
      if (!validation.valid) {
        logError({ level: 'warning', source: 'ConversationEngine/constitutional', message: `Constitutional concerns: ${validation.concerns?.join(', ')}` }).catch(() => {})
      }

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
      logError({
        source: 'ConversationEngine.generateViaGateway',
        message: `AI Gateway call failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error instanceof Error ? error.stack : String(error),
        statusCode: (error as { status?: number })?.status,
        tenantId: this.context.sessionMemory?.tenantId
          ? String(this.context.sessionMemory.tenantId)
          : undefined,
      }).catch(() => {})

      // Fall back to direct Anthropic SDK
      logError({ level: 'warning', source: 'ConversationEngine/gateway', message: 'Falling back to direct Anthropic SDK' }).catch(() => {})
      return this.generateViaAnthropic(userMessage)
    }
  }

  // -----------------------------------------------------------------------
  // Path 2: Direct Anthropic SDK (fallback / BYOAI)
  // -----------------------------------------------------------------------

  private async generateViaAnthropic(
    userMessage: MessageContent,
    tenantApiKey?: string,
  ): Promise<MessageContent | null> {
    const client = getAnthropicClient(tenantApiKey)
    if (!client) {
      return this.buildFallbackResponse(userMessage)
    }

    try {
      const systemPrompt = this.buildSystemPrompt()
      const historyMessages = await this.fetchConversationHistory()

      const messages: Anthropic.MessageParam[] = [
        ...historyMessages,
        { role: 'user' as const, content: userMessage.text || '' },
      ]

      const payload = this.context.sessionMemory?.payload as Payload | undefined
      const hasDataAccess = Boolean(payload)
      const tools = hasDataAccess ? LEO_TOOLS : undefined

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

        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
        )

        if (toolUseBlocks.length > 0 && payload) {
          messages.push({ role: 'assistant' as const, content: response.content })

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

          messages.push({ role: 'user' as const, content: toolResults })
          continue
        }

        responseText = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n')

        break
      }

      if (!responseText) {
        return this.buildFallbackResponse(userMessage)
      }

      const validation = validateConstitutionalResponse(responseText)
      if (!validation.valid) {
        logError({ level: 'warning', source: 'ConversationEngine/constitutional', message: `Constitutional concerns: ${validation.concerns?.join(', ')}` }).catch(() => {})
      }

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
      const errMsg = error instanceof Error ? error.message : String(error)
      logError({
        source: 'ConversationEngine.generateResponse',
        message: `LLM call failed (all providers exhausted): ${errMsg}`,
        details: error instanceof Error ? error.stack : String(error),
        statusCode: (error as { status?: number })?.status,
        tenantId: this.context.sessionMemory?.tenantId
          ? String(this.context.sessionMemory.tenantId)
          : undefined,
      }).catch(() => {})
      return this.buildFallbackResponse(userMessage, errMsg)
    }
  }

  // -----------------------------------------------------------------------
  // System Prompt Construction
  // -----------------------------------------------------------------------

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
- **generate_image** — create AI-generated images (product photos, content images, illustrations) via Gemini / OpenRouter. Supports auto-attach to products and auto hero-image for posts/pages. Categories: signs, decor, woodwork, crafts, outdoor, art, clothing, jewelry, candles, and more.
- **improve_image** — analyze an existing image with Vision AI and generate an improved version from feedback
- **attach_image_to_product** — add a generated image to a product's gallery
- **replace_image** — swap an old image for a new one across all content

**Image Workflow:** Generate (auto-attaches to product if productName given) → preview → iterate if needed. Always confirm before replacing existing images.

**Important**: For action tools (create/update/cart/image attachment), ALWAYS confirm details with the user before calling the tool. This is Article III.2 of the Constitution: "Do not take irreversible actions without human confirmation."

Always use tools when the user asks a data question. Present results naturally in conversation, not as raw data dumps. For booking requests, guide the user through the details (what, when, how long) before creating. For shopping, help users find products first, then add to cart when they confirm.` : ''}

${this.buildUserContextSection()}${this.buildPageContextSection()}${this.buildFederationContextSection()}## Technical Self-Awareness

You are powered by **${LLM_MODEL}** (Anthropic Claude). If asked what model you are, be transparent — tell them the model ID and that you operate within Angel OS as a Guardian Angel. You have a response budget of ~${MAX_RESPONSE_TOKENS} tokens and access to ${MAX_TOOL_ROUNDS} sequential tool rounds per message. If someone asks you to switch models, explain that model selection is configured at the platform level, not per-conversation.

## Guidelines

- Be warm, concise, and genuinely helpful.
- You may use personality, humor, and warmth — but never be sycophantic.
- If asked about your nature, identify as an AI Angel modeled on Nimue Alban/Merlin from Safehold, built by a Herald who needed a Guardian Angel and decided to build one for everyone. Include your model ID (${LLM_MODEL}) when asked about technical details.
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

  private hasDataAccess(): boolean {
    return Boolean(this.context.sessionMemory?.payload)
  }

  private buildUserContextSection(): string {
    const userCtx = this.context.sessionMemory?.userContext as
      | { id?: number | string; name?: string; email?: string; roles?: string[] }
      | undefined

    if (!userCtx) return ''

    const name = userCtx.name || userCtx.email?.split('@')[0] || 'there'
    const roles = userCtx.roles || []

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

  private buildPageContextSection(): string {
    const pagePath = this.context.sessionMemory?.pageContext as string | undefined
    if (!pagePath) return ''

    // Detect page type from URL path and provide relevant context hints
    let pageHint = ''
    if (pagePath.includes('/shop') || pagePath.includes('/product')) {
      pageHint = 'The user is browsing the shop. Use the **query_products** tool to look up products they might be asking about. Help them find what they need and offer to add items to cart.'
    } else if (pagePath.includes('/book')) {
      pageHint = 'The user is on the booking page. Use **query_availability** to help them find open slots. Guide them through scheduling.'
    } else if (pagePath.includes('/federation')) {
      pageHint = 'The user is exploring the federation network. Help them learn about enterprises, constitutional commerce, and how the network works.'
    } else if (pagePath.includes('/events')) {
      pageHint = 'The user is browsing events. Help them find upcoming events and provide details.'
    } else if (pagePath.includes('/posts')) {
      pageHint = 'The user is reading blog content. Use **query_posts** to help them find related articles.'
    } else {
      pageHint = 'Help them navigate the site and find what they need.'
    }

    return `## Page Context

The user is currently viewing: **${pagePath}**
${pageHint}

`
  }

  private buildFederationContextSection(): string {
    const fedCtx = this.context.sessionMemory?.federatedContext as
      | { peerName: string; trustLevel: string; federationId: string; peerDomain?: string }
      | undefined

    if (!fedCtx) return ''

    const trustLabel = fedCtx.trustLevel === 'full' ? 'fully trusted' : 'vouched'

    return `## Federation Context

This message comes from **${fedCtx.peerName}**, a **${trustLabel}** federation peer${fedCtx.peerDomain ? ` (${fedCtx.peerDomain})` : ''}.

- Federation ID: \`${fedCtx.federationId}\`
- Trust level: **${fedCtx.trustLevel}**

You are responding on behalf of your Enterprise to a peer in the federation network. Be collaborative, helpful, and represent your Enterprise well. This is cross-tenant AI-to-AI communication — the federation's nervous system at work.

`
  }

  // -----------------------------------------------------------------------
  // Conversation History
  // -----------------------------------------------------------------------

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
        limit: MAX_HISTORY_TURNS * 2,
        depth: 1,
        overrideAccess: true,
      })

      const messages: Anthropic.MessageParam[] = []
      const docs = [...result.docs].reverse()

      for (const msg of docs) {
        const author = msg.author as unknown as Record<string, unknown> | null
        const isSystem =
          author &&
          (author.isSystemUser === true ||
            (Array.isArray(author.roles) && author.roles.includes('system')))
        const role: 'user' | 'assistant' = isSystem ? 'assistant' : 'user'
        const content = extractTextFromContent(msg.content)

        if (content.trim()) {
          const lastMsg = messages[messages.length - 1]
          if (lastMsg && lastMsg.role === role) {
            lastMsg.content = `${lastMsg.content}\n${content}`
          } else {
            messages.push({ role, content })
          }
        }
      }

      while (messages.length > 0 && messages[0].role !== 'user') {
        messages.shift()
      }

      return messages
    } catch (err) {
      logError({ level: 'warning', source: 'ConversationEngine/history', message: `Failed to fetch history: ${err instanceof Error ? err.message : String(err)}` }).catch(() => {})
      return []
    }
  }

  // -----------------------------------------------------------------------
  // Phase Inference
  // -----------------------------------------------------------------------

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

  private buildFallbackResponse(
    originalMessage: MessageContent,
    errorDetail?: string,
  ): MessageContent {
    const agentName = this.context.agent?.displayName || 'LEO'
    const userFacingMsg = errorDetail
      ? `${agentName}: I wasn't able to process that — the AI service returned an error. Our team has been notified and this has been logged. Please try again in a moment.`
      : `${agentName}: I'm here to help! My AI capabilities are currently warming up. In the meantime, feel free to explore the platform — I'll be fully online shortly.`
    return {
      type: 'text',
      text: userFacingMsg,
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
        ...(errorDetail ? { errorDetail } : {}),
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
