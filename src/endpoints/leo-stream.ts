/**
 * LEO Streaming Endpoint — POST /api/leo/stream
 *
 * Server-Sent Events (SSE) endpoint for real-time streaming responses.
 * Uses Anthropic's streaming API to progressively deliver LEO's response.
 *
 * SSE Event Protocol:
 *   event: start      → { conversationId }
 *   event: delta      → { text: "chunk" }
 *   event: tool_call  → { name, status }
 *   event: done       → { text, agentName, messageId }
 *   event: error      → { message }
 *
 * Falls back to batch response via /api/leo if streaming is unavailable.
 */

import type { PayloadHandler } from 'payload'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

import { buildMinimalConstitutionalPrompt } from '@/utilities/constitutional-prompt'
import { LEO_TOOLS, executeToolCall } from '@/utilities/leo-data-tools'
import type { ToolExecutorContext } from '@/utilities/leo-data-tools'
import { routeToAgent } from '@/utilities/AgentRouter'
import { extractTextFromContent, wrapTextContent } from '@/utilities/messageContent'
import { logError } from '@/utilities/logError'
import { buildWizardSystemPromptSuffix } from '@/utilities/wizardPrompt'
import type { WizardContext } from '@/utilities/wizardPrompt'

// ---------------------------------------------------------------------------
// Constants (mirrored from ConversationEngine for consistency)
// ---------------------------------------------------------------------------

const MAX_HISTORY_TURNS = 8
const MAX_RESPONSE_TOKENS = 1500
const MAX_TOOL_ROUNDS = 3
const LLM_MODEL = 'claude-sonnet-4-20250514'

// ---------------------------------------------------------------------------
// Minimal env-file parser — avoids dotenv import issues with bundler resolution.
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
  // 1. Prefer the real process.env value if non-empty
  const envVal = process.env.ANTHROPIC_API_KEY
  if (envVal) return envVal

  // 2. Return cached file-based value
  if (_envFileKey) return _envFileKey

  // 3. Parse .env.local directly (one-time read)
  try {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      const parsed = parseEnvFile(fs.readFileSync(envPath))
      if (parsed.ANTHROPIC_API_KEY) {
        _envFileKey = parsed.ANTHROPIC_API_KEY
        console.log('[LEO Stream] Loaded ANTHROPIC_API_KEY from .env.local (process.env was empty)')
        return _envFileKey
      }
    }
    // Also try .env as fallback
    const envFallback = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(envFallback)) {
      const parsed = parseEnvFile(fs.readFileSync(envFallback))
      if (parsed.ANTHROPIC_API_KEY) {
        _envFileKey = parsed.ANTHROPIC_API_KEY
        console.log('[LEO Stream] Loaded ANTHROPIC_API_KEY from .env (process.env was empty)')
        return _envFileKey
      }
    }
  } catch (err) {
    console.warn('[LEO Stream] Failed to read .env files:', err)
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Lazy Anthropic client
// ---------------------------------------------------------------------------

let _anthropic: Anthropic | null = null
let _cachedKey: string | undefined

function getAnthropicClient(): Anthropic | null {
  const apiKey = resolveAnthropicKey()
  if (_anthropic && _cachedKey === apiKey) return _anthropic
  if (!apiKey) return null
  _anthropic = new Anthropic({ apiKey })
  _cachedKey = apiKey
  return _anthropic
}

// ---------------------------------------------------------------------------
// SSE Helper
// ---------------------------------------------------------------------------

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// ---------------------------------------------------------------------------
// System Prompt Builder (standalone — doesn't need ConversationEngine instance)
// ---------------------------------------------------------------------------

function buildStreamingSystemPrompt(opts: {
  agentName: string
  personality: string
  capabilities: string[]
  hasDataAccess: boolean
  userName?: string
  userEmail?: string
  userRoles?: string[]
  phase: string
}): string {
  const { agentName, personality, capabilities, hasDataAccess, userName, userEmail, userRoles, phase } = opts

  // User context section
  let userSection = ''
  if (userName || userEmail) {
    const displayName = userName || userEmail?.split('@')[0] || 'there'
    const roles = userRoles || []
    let accessLevel = 'authenticated user'
    if (roles.includes('super_admin') || roles.includes('archangel')) {
      accessLevel = 'platform administrator (full access)'
    } else if (roles.includes('admin')) {
      accessLevel = 'tenant administrator'
    } else if (roles.includes('customer')) {
      accessLevel = 'customer'
    }

    userSection = `## Current User

You are speaking with **${displayName}**${userEmail ? ` (${userEmail})` : ''}.
- Access level: ${accessLevel}
- Roles: ${roles.length > 0 ? roles.join(', ') : 'standard user'}

Tailor your responses to their access level. Administrators can see all data and configure the platform. Customers should only see their own bookings, orders, and public content. Be helpful to everyone, but respect the access boundaries.

`
  }

  // Data access section
  const dataSection = hasDataAccess
    ? `
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

Always use tools when the user asks a data question. Present results naturally in conversation, not as raw data dumps. For booking requests, guide the user through the details (what, when, how long) before creating. For shopping, help users find products first, then add to cart when they confirm.`
    : ''

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
${dataSection}

${userSection}## Guidelines

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
- Current conversation phase: ${phase}
`
}

// ---------------------------------------------------------------------------
// Conversation History Fetcher (standalone)
// ---------------------------------------------------------------------------

async function fetchConversationHistory(
  payload: import('payload').Payload,
  spaceId: number,
  channel?: string,
): Promise<Anthropic.MessageParam[]> {
  try {
    const result = await payload.find({
      collection: 'messages',
      where: {
        and: [
          { space: { equals: spaceId } },
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
      // UMS: content is now JSON — extract displayable text for LLM context
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

    // Ensure messages start with 'user' role
    while (messages.length > 0 && messages[0].role !== 'user') {
      messages.shift()
    }

    return messages
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const leoStreamHandler: PayloadHandler = async (req) => {
  // Require authenticated user
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    message,
    conversationId,
    channelSlug,
    spaceId,
    images: bodyImages,
    wizardStep,
    wizardContext: rawWizardContext,
  } = body

  // Wizard mode — extract optional step + context for Diocese Setup
  const isWizardMode = typeof wizardStep === 'number'
  const wizardContext: WizardContext =
    rawWizardContext && typeof rawWizardContext === 'object'
      ? (rawWizardContext as WizardContext)
      : {}

  if (!message || typeof message !== 'string' || !message.trim()) {
    return Response.json({ message: 'Missing or empty: message' }, { status: 400 })
  }

  // Parse image attachments for Anthropic vision
  const userImages: Array<{ url: string; mediaId?: number; alt?: string }> = []
  if (Array.isArray(bodyImages)) {
    for (const img of bodyImages) {
      if (img && typeof img === 'object' && typeof (img as Record<string, unknown>).url === 'string') {
        userImages.push(img as { url: string; mediaId?: number; alt?: string })
      }
    }
  }

  const client = getAnthropicClient()
  if (!client) {
    return Response.json({ message: 'Streaming unavailable — API key not configured' }, { status: 503 })
  }

  // Resolve tenant
  let tenantId: number | undefined
  const tenantSlug =
    req.headers.get('x-tenant-id') || process.env.DEFAULT_TENANT_SLUG || 'default'

  if (tenantSlug) {
    try {
      const tenants = await req.payload.find({
        collection: 'tenants',
        where: { slug: { equals: tenantSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      tenantId = tenants.docs?.[0]?.id
    } catch {
      // Non-critical
    }
  }

  // Extract user context
  const user = req.user as unknown as Record<string, unknown> | undefined
  const userName = (user?.name as string) || undefined
  const userEmail = (user?.email as string) || undefined
  const userRoles = Array.isArray(user?.roles) ? (user.roles as string[]) : undefined

  // Resolve agent
  let agent: { displayName?: string; name?: string; personality?: string; capabilities?: string[]; agentType?: string } | null = null
  if (tenantId) {
    try {
      agent = await routeToAgent(req.payload, {
        tenantId,
        channelSlug: typeof channelSlug === 'string' ? channelSlug : undefined,
        messageText: message.trim(),
      })
    } catch {
      // Use defaults
    }
  }

  const agentName = agent?.displayName || agent?.name || 'LEO'
  const personality = agent?.personality || 'Friendly, helpful, and knowledgeable.'
  const capabilities = agent?.capabilities || []

  const resolvedChannel = typeof channelSlug === 'string' ? channelSlug : 'general'
  const resolvedSpaceId = spaceId ? Number(spaceId) : undefined
  const resolvedConversationId =
    typeof conversationId === 'string' ? conversationId : `conv_${Date.now()}`

  // Build system prompt — append wizard suffix when in Diocese Setup wizard
  const phase = isWizardMode ? 'diocese-setup-wizard' : 'general'
  const baseSystemPrompt = buildStreamingSystemPrompt({
    agentName,
    personality,
    capabilities,
    hasDataAccess: true,
    userName,
    userEmail,
    userRoles,
    phase,
  })
  const systemPrompt = isWizardMode
    ? baseSystemPrompt + buildWizardSystemPromptSuffix(wizardStep as number, wizardContext)
    : baseSystemPrompt

  // Fetch conversation history
  const historyMessages = resolvedSpaceId
    ? await fetchConversationHistory(req.payload, resolvedSpaceId, resolvedChannel)
    : []

  // Build messages array — use multi-part content when user attached images
  const userContent: Anthropic.ContentBlockParam[] = [
    { type: 'text', text: message.trim() },
  ]
  if (userImages.length > 0) {
    for (const img of userImages) {
      // Resolve relative URLs to absolute for Anthropic API
      let imageUrl = img.url
      if (imageUrl.startsWith('/')) {
        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
        imageUrl = `${serverUrl}${imageUrl}`
      }
      userContent.push({
        type: 'image',
        source: { type: 'url', url: imageUrl },
      } as Anthropic.ContentBlockParam)
    }
  }

  const messages: Anthropic.MessageParam[] = [
    ...historyMessages,
    { role: 'user' as const, content: userImages.length > 0 ? userContent : message.trim() },
  ]

  // Create SSE stream
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send start event
        controller.enqueue(encoder.encode(sseEvent('start', { conversationId: resolvedConversationId })))

        let fullText = ''
        let round = 0

        while (round < MAX_TOOL_ROUNDS) {
          round++

          const response = await client.messages.create({
            model: LLM_MODEL,
            max_tokens: MAX_RESPONSE_TOKENS,
            system: systemPrompt,
            messages,
            ...(LEO_TOOLS.length > 0 ? { tools: LEO_TOOLS } : {}),
            stream: true,
          })

          // Collect tool use blocks from the stream
          let currentToolUseId = ''
          let currentToolName = ''
          let currentToolInputJson = ''
          const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
          let stopReason: string | null = null

          // Process the stream
          for await (const event of response) {
            if (event.type === 'content_block_start') {
              if (event.content_block.type === 'text') {
                // Text block starting — nothing to do yet
              } else if (event.content_block.type === 'tool_use') {
                currentToolUseId = event.content_block.id
                currentToolName = event.content_block.name
                currentToolInputJson = ''
                // Notify client about tool call
                controller.enqueue(
                  encoder.encode(
                    sseEvent('tool_call', { name: currentToolName, status: 'calling' }),
                  ),
                )
              }
            } else if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                const chunk = event.delta.text
                fullText += chunk
                controller.enqueue(encoder.encode(sseEvent('delta', { text: chunk })))
              } else if (event.delta.type === 'input_json_delta') {
                currentToolInputJson += event.delta.partial_json
              }
            } else if (event.type === 'content_block_stop') {
              if (currentToolUseId && currentToolName) {
                // Parse tool input
                let toolInput: Record<string, unknown> = {}
                try {
                  toolInput = currentToolInputJson ? JSON.parse(currentToolInputJson) : {}
                } catch {
                  toolInput = {}
                }
                toolUseBlocks.push({
                  id: currentToolUseId,
                  name: currentToolName,
                  input: toolInput,
                })
                currentToolUseId = ''
                currentToolName = ''
                currentToolInputJson = ''
              }
            } else if (event.type === 'message_delta') {
              stopReason = event.delta.stop_reason
            }
          }

          // If Claude used tools, execute them and continue
          if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
            // Build the assistant content blocks for the messages array
            const assistantContent: Anthropic.ContentBlockParam[] = []
            if (fullText) {
              assistantContent.push({ type: 'text', text: fullText })
            }
            for (const tool of toolUseBlocks) {
              assistantContent.push({
                type: 'tool_use',
                id: tool.id,
                name: tool.name,
                input: tool.input,
              })
            }
            messages.push({ role: 'assistant' as const, content: assistantContent })

            // Execute tools
            const toolResults: Anthropic.ToolResultBlockParam[] = []
            const toolCtx: ToolExecutorContext = {
              payload: req.payload,
              tenantId,
              spaceId: resolvedSpaceId,
              userId: req.user?.id as number | undefined,
            }

            for (const tool of toolUseBlocks) {
              controller.enqueue(
                encoder.encode(sseEvent('tool_call', { name: tool.name, status: 'executing' })),
              )
              let result: string
              try {
                result = await executeToolCall(tool.name, tool.input, toolCtx)
              } catch (toolErr) {
                console.error(`[LEO Stream] Tool ${tool.name} failed:`, toolErr)
                result = `Tool execution failed: ${toolErr instanceof Error ? toolErr.message : 'Unknown error'}. I'll try to help without this tool.`
              }
              toolResults.push({
                type: 'tool_result',
                tool_use_id: tool.id,
                content: result,
              })
            }

            messages.push({ role: 'user' as const, content: toolResults })

            // ── Wizard step advancement ──────────────────────────────────
            // When a tool completes during wizard mode, advance the step
            if (isWizardMode && tenantId) {
              const TOOL_TO_STEP: Record<string, number> = {
                configure_business: wizardStep === 1 ? 1 : 2,
                create_space: 3,
                invite_member: 4,
                create_product: 5,
                suggest_products: -1, // intermediate — don't advance
                connect_stripe_account: 6,
                sign_constitution: -1, // intermediate — ping_federation finishes step 7
                ping_federation: 7,
              }
              const completedTools = toolUseBlocks.map((t) => t.name)
              const stepsToComplete = completedTools
                .map((name) => TOOL_TO_STEP[name] ?? -1)
                .filter((s) => s >= 0)

              if (stepsToComplete.length > 0) {
                try {
                  const tenant = await req.payload.findByID({
                    collection: 'tenants',
                    id: tenantId,
                    depth: 0,
                    overrideAccess: true,
                  })
                  const existing = ((tenant as any)?.setup?.wizardProgress as Record<string, unknown>) ?? {}
                  const existingCompleted: number[] = Array.isArray(existing.completedSteps)
                    ? (existing.completedSteps as number[])
                    : []
                  const newCompleted = Array.from(
                    new Set([...existingCompleted, ...stepsToComplete]),
                  ).sort((a, b) => a - b)
                  const nextStep = Math.max(...stepsToComplete) + 1

                  await req.payload.update({
                    collection: 'tenants',
                    id: tenantId,
                    data: {
                      setup: {
                        wizardProgress: {
                          ...existing,
                          completedSteps: newCompleted,
                          currentStep: Math.min(nextStep, 7),
                        },
                      },
                    } as any,
                    overrideAccess: true,
                  })
                } catch (stepErr) {
                  console.error('[LEO Stream] Wizard step advancement error:', stepErr)
                }
              }
            }

            // Reset fullText for the next round (tool results response)
            fullText = ''
            continue
          }

          // No more tool calls — we're done
          break
        }

        // Persist LEO's response to Messages collection
        let savedMessageId: number | undefined
        if (resolvedSpaceId && fullText) {
          try {
            let leoUserId: number | undefined
            if (tenantSlug) {
              const leoEmail = `leo-${tenantSlug}@system.angelos.local`
              const leoUsers = await req.payload.find({
                collection: 'users',
                where: {
                  and: [
                    { email: { equals: leoEmail } },
                    { isSystemUser: { equals: true } },
                  ],
                },
                limit: 1,
                depth: 0,
                overrideAccess: true,
              })
              leoUserId = leoUsers.docs?.[0]?.id
            }

            const saved = await req.payload.create({
              collection: 'messages',
              data: {
                content: wrapTextContent(fullText),
                space: resolvedSpaceId,
                channel: resolvedChannel,
                messageType: 'ai_agent',
                ...(leoUserId ? { author: leoUserId } : {}),
              } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              overrideAccess: true,
            })
            savedMessageId = saved.id as number
          } catch (saveErr) {
            console.warn('[LEO Stream] Failed to persist response:', saveErr)
          }
        }

        // Extract any image URLs from tool results for the client
        const imageUrls: Array<{ url: string; alt?: string; mediaId?: number }> = []
        // Scan tool results for image-related data
        for (const msg of messages) {
          if (msg.role === 'user' && Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (typeof block === 'object' && 'type' in block && block.type === 'tool_result') {
                const resultContent = typeof block.content === 'string' ? block.content : ''
                // Look for Vercel Blob URLs in tool results (broad pattern)
                const blobMatch = resultContent.match(/(https?:\/\/[a-z0-9._-]+\.public\.blob\.vercel-storage\.com\/[^\s"')]+)/gi)
                if (blobMatch) {
                  for (const url of blobMatch) {
                    imageUrls.push({ url })
                  }
                }
                // Also look for any URL following "URL:" pattern in tool results
                const urlPrefixed = resultContent.match(/URL:\s*(https?:\/\/[^\s"')]+)/gi)
                if (urlPrefixed) {
                  for (const match of urlPrefixed) {
                    const url = match.replace(/^URL:\s*/i, '')
                    if (!imageUrls.some((img) => img.url === url)) {
                      imageUrls.push({ url })
                    }
                  }
                }
                // Look for Media ID references and associate with images
                const mediaMatch = resultContent.match(/Media\s*(?:ID|#):\s*(\d+)/gi)
                if (mediaMatch) {
                  for (let i = 0; i < mediaMatch.length; i++) {
                    const idMatch = mediaMatch[i].match(/(\d+)/)
                    if (idMatch) {
                      const mediaId = parseInt(idMatch[1], 10)
                      if (i < imageUrls.length) {
                        imageUrls[i].mediaId = mediaId
                      } else {
                        // Media ID without a URL — try to construct one from the response text
                        imageUrls.push({ url: '', mediaId })
                      }
                    }
                  }
                }
              }
            }
          }
        }
        // Remove entries with empty URLs (Media ID only — client can't display these)
        const validImageUrls = imageUrls.filter((img) => img.url)

        // Send done event (with images if any were generated)
        controller.enqueue(
          encoder.encode(
            sseEvent('done', {
              text: fullText,
              agentName,
              messageId: savedMessageId,
              conversationId: resolvedConversationId,
              ...(validImageUrls.length > 0 ? { images: validImageUrls } : {}),
            }),
          ),
        )
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('[LEO Stream] Error:', errMsg)
        controller.enqueue(encoder.encode(sseEvent('error', { message: errMsg })))
        // Log to Error Log Viewer for triage
        logError({
          source: 'leo-stream',
          message: `Streaming LLM call failed: ${errMsg}`,
          details: error instanceof Error ? error.stack : String(error),
          statusCode: (error as { status?: number })?.status,
        }).catch(() => {}) // fire-and-forget
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
