/**
 * LEO Streaming Endpoint — POST /api/leo/stream
 *
 * Server-Sent Events (SSE) endpoint for real-time streaming responses.
 * Supports two LLM paths:
 *   1. Vercel AI Gateway (preferred) — multi-model via AI SDK streamText
 *   2. Direct Anthropic SDK (fallback) — when gateway key is not configured
 *
 * SSE Event Protocol:
 *   event: start      → { conversationId }
 *   event: delta      → { text: "chunk" }
 *   event: tool_call  → { name, status }
 *   event: done       → { text, agentName, messageId }
 *   event: error      → { message }
 *
 * @see ai-gateway.ts — Vercel AI Gateway integration
 */

import type { PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import Anthropic from '@anthropic-ai/sdk'
import { streamText, stepCountIs } from 'ai'
import type { ModelMessage } from 'ai'
import fs from 'fs'
import path from 'path'

import { buildMinimalConstitutionalPrompt } from '@/utilities/constitutional-prompt'
import { leoLegacyEmail, leoSystemUserEmail } from '@/utilities/leoEmail'
import { LEO_TOOLS, executeToolCall } from '@/utilities/leo-data-tools'
import type { ToolExecutorContext } from '@/utilities/leo-data-tools'
import { routeToAgent } from '@/utilities/AgentRouter'
import { extractTextFromContent, wrapTextContent } from '@/utilities/messageContent'
import { logError } from '@/utilities/logError'
import { buildWizardSystemPromptSuffix } from '@/utilities/wizardPrompt'
import type { WizardContext } from '@/utilities/wizardPrompt'
import { getModel, getFallbackModel, isGatewayAvailable, convertToolsForAISDK, MODEL_CATALOG, DEFAULT_MODEL, FALLBACK_MODEL, resolveModelId } from '@/utilities/ai-gateway'

// ---------------------------------------------------------------------------
// Constants (mirrored from ConversationEngine for consistency)
// ---------------------------------------------------------------------------

const MAX_HISTORY_TURNS = 8
const MAX_RESPONSE_TOKENS = 1500
const MAX_TOOL_ROUNDS = 3
const LLM_MODEL = 'claude-sonnet-4-20250514'

// ---------------------------------------------------------------------------
// Slash command handler
// ---------------------------------------------------------------------------

/**
 * Handle /commands typed in chat. Returns response text or null if not a command.
 * Model switching is restricted to super_admin users for security.
 */
function handleSlashCommand(msg: string, userRoles?: string[]): string | null {
  const parts = msg.split(/\s+/)
  const cmd = parts[0]?.toLowerCase()
  const isSuperAdmin = userRoles?.includes('super_admin') ?? false

  if (cmd === '/model' || cmd === '/models') {
    const subCmd = parts[1]?.toLowerCase()

    if (!subCmd || subCmd === 'list') {
      const current = resolveModelId()
      const lines = ['**Available Models**\n']
      for (const [alias, id] of Object.entries(MODEL_CATALOG)) {
        const marker = id === current ? ' ← **active**' : ''
        lines.push(`• \`${alias}\` → \`${id}\`${marker}`)
      }
      lines.push(`\n**Default:** \`${DEFAULT_MODEL}\``)
      lines.push(`**Fallback:** \`${FALLBACK_MODEL}\``)
      if (isSuperAdmin) {
        lines.push(`\nSwitch with: \`/model <alias>\` (e.g. \`/model gemini-pro\`)`)
        lines.push(`Or set \`LLM_MODEL\` env var for a persistent override.`)
      } else {
        lines.push(`\n*Model switching is restricted to super admins.*`)
      }
      return lines.join('\n')
    }

    // Model switching — super_admin only
    if (!isSuperAdmin) {
      return `🔒 **Model switching is restricted to super admins.**\n\nYou can view available models with \`/models\`.`
    }

    // /model <alias> — switch
    const alias = subCmd
    if (alias in MODEL_CATALOG) {
      process.env.LLM_MODEL = alias
      const resolved = resolveModelId(alias)
      return `✅ Switched model to **${alias}** (\`${resolved}\`).\n\nThis applies for the current server session. Set \`LLM_MODEL=${alias}\` in \`.env.local\` to persist.`
    }

    // Check if it's a full model ID
    if (alias.includes('/')) {
      process.env.LLM_MODEL = alias
      return `✅ Switched model to \`${alias}\`.\n\nThis applies for the current server session.`
    }

    return `❌ Unknown model: \`${alias}\`\n\nAvailable aliases: ${Object.keys(MODEL_CATALOG).map(k => `\`${k}\``).join(', ')}`
  }

  if (cmd === '/help') {
    return [
      '**LEO Commands**\n',
      '• `/models` — List available AI models',
      ...(isSuperAdmin ? ['• `/model <alias>` — Switch to a different model (super admin only)'] : []),
      '• `/help` — Show this help',
    ].join('\n')
  }

  return null // Not a recognized command
}

// ---------------------------------------------------------------------------
// Minimal env-file parser
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
// Anthropic key resolution (fallback path)
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
        console.log('[LEO Stream] Loaded ANTHROPIC_API_KEY from .env.local (process.env was empty)')
        return _envFileKey
      }
    }
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
// Lazy Anthropic client (fallback path)
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
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Wizard Step Advancement Helper
// ---------------------------------------------------------------------------

async function advanceWizardStep(
  payload: import('payload').Payload,
  tenantId: number,
  wizardStep: number,
  toolNames: string[],
): Promise<void> {
  const TOOL_TO_STEP: Record<string, number> = {
    configure_business: wizardStep === 1 ? 1 : 2,
    create_space: 3,
    invite_member: 4,
    create_product: 5,
    suggest_products: -1,
    connect_stripe_account: 6,
    sign_constitution: -1,
    ping_federation: 7,
  }
  const stepsToComplete = toolNames
    .map((name) => TOOL_TO_STEP[name] ?? -1)
    .filter((s) => s >= 0)

  if (stepsToComplete.length === 0) return

  try {
    const tenant = await payload.findByID({
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

    await payload.update({
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

// ---------------------------------------------------------------------------
// Image URL extraction from tool results
// ---------------------------------------------------------------------------

function extractImageUrls(messages: Anthropic.MessageParam[]): Array<{ url: string; alt?: string; mediaId?: number }> {
  const imageUrls: Array<{ url: string; alt?: string; mediaId?: number }> = []
  for (const msg of messages) {
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (typeof block === 'object' && 'type' in block && block.type === 'tool_result') {
          const resultContent = typeof block.content === 'string' ? block.content : ''
          const blobMatch = resultContent.match(/(https?:\/\/[a-z0-9._-]+\.public\.blob\.vercel-storage\.com\/[^\s"')]+)/gi)
          if (blobMatch) {
            for (const url of blobMatch) {
              imageUrls.push({ url })
            }
          }
          const urlPrefixed = resultContent.match(/URL:\s*(https?:\/\/[^\s"')]+)/gi)
          if (urlPrefixed) {
            for (const match of urlPrefixed) {
              const url = match.replace(/^URL:\s*/i, '')
              if (!imageUrls.some((img) => img.url === url)) {
                imageUrls.push({ url })
              }
            }
          }
          const mediaMatch = resultContent.match(/Media\s*(?:ID|#):\s*(\d+)/gi)
          if (mediaMatch) {
            for (let i = 0; i < mediaMatch.length; i++) {
              const idMatch = mediaMatch[i].match(/(\d+)/)
              if (idMatch) {
                const mediaId = parseInt(idMatch[1], 10)
                if (i < imageUrls.length) {
                  imageUrls[i].mediaId = mediaId
                } else {
                  imageUrls.push({ url: '', mediaId })
                }
              }
            }
          }
        }
      }
    }
  }
  return imageUrls.filter((img) => img.url)
}

// ---------------------------------------------------------------------------
// Image URL extraction from AI SDK tool results (string-based)
// ---------------------------------------------------------------------------

function extractImageUrlsFromText(toolResultTexts: string[]): Array<{ url: string; alt?: string; mediaId?: number }> {
  const imageUrls: Array<{ url: string; alt?: string; mediaId?: number }> = []
  for (const resultContent of toolResultTexts) {
    const blobMatch = resultContent.match(/(https?:\/\/[a-z0-9._-]+\.public\.blob\.vercel-storage\.com\/[^\s"')]+)/gi)
    if (blobMatch) {
      for (const url of blobMatch) {
        imageUrls.push({ url })
      }
    }
    const urlPrefixed = resultContent.match(/URL:\s*(https?:\/\/[^\s"')]+)/gi)
    if (urlPrefixed) {
      for (const match of urlPrefixed) {
        const url = match.replace(/^URL:\s*/i, '')
        if (!imageUrls.some((img) => img.url === url)) {
          imageUrls.push({ url })
        }
      }
    }
    const mediaMatch = resultContent.match(/Media\s*(?:ID|#):\s*(\d+)/gi)
    if (mediaMatch) {
      for (let i = 0; i < mediaMatch.length; i++) {
        const idMatch = mediaMatch[i].match(/(\d+)/)
        if (idMatch) {
          const mediaId = parseInt(idMatch[1], 10)
          if (i < imageUrls.length) {
            imageUrls[i].mediaId = mediaId
          } else {
            imageUrls.push({ url: '', mediaId })
          }
        }
      }
    }
  }
  return imageUrls.filter((img) => img.url)
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const leoStreamHandler: PayloadHandler = async (req) => {
  // Require authenticated user
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit: 5 streaming requests/min per user (SSE streams are expensive)
  const rateLimited = applyRateLimit(req, 'leo_stream')
  if (rateLimited) return rateLimited

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

  const isWizardMode = typeof wizardStep === 'number'
  const wizardContext: WizardContext =
    rawWizardContext && typeof rawWizardContext === 'object'
      ? (rawWizardContext as WizardContext)
      : {}

  if (!message || typeof message !== 'string' || !message.trim()) {
    return Response.json({ message: 'Missing or empty: message' }, { status: 400 })
  }

  // Parse image attachments
  const userImages: Array<{ url: string; mediaId?: number; alt?: string }> = []
  if (Array.isArray(bodyImages)) {
    for (const img of bodyImages) {
      if (img && typeof img === 'object' && typeof (img as Record<string, unknown>).url === 'string') {
        userImages.push(img as { url: string; mediaId?: number; alt?: string })
      }
    }
  }

  // ─── Slash Commands ──────────────────────────────────────────────────────
  const trimmedMsg = message.trim()
  if (trimmedMsg.startsWith('/')) {
    const reqUser = req.user as unknown as Record<string, unknown> | undefined
    const slashRoles = Array.isArray(reqUser?.roles) ? (reqUser.roles as string[]) : undefined
    const cmdResult = handleSlashCommand(trimmedMsg, slashRoles)
    if (cmdResult) {
      // Return slash command response as a quick SSE stream
      const cmdEncoder = new TextEncoder()
      const cmdStream = new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(cmdEncoder.encode(sseEvent('start', { conversationId: resolvedConversationId })))
          ctrl.enqueue(cmdEncoder.encode(sseEvent('delta', { text: cmdResult })))
          ctrl.enqueue(cmdEncoder.encode(sseEvent('done', { text: cmdResult, agentName: 'System' })))
          ctrl.close()
        },
      })
      return new Response(cmdStream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
      })
    }
  }

  // Check if we have any LLM backend available
  const useGateway = isGatewayAvailable()
  const client = useGateway ? null : getAnthropicClient()
  if (!useGateway && !client) {
    return Response.json({ message: 'Streaming unavailable — no LLM backend configured' }, { status: 503 })
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

  // Build system prompt
  const phase = isWizardMode ? 'enterprise-setup-wizard' : 'general'
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

  // ─── Pre-create LEO response message (empty) ────────────────────────
  // Create the message record BEFORE streaming so partial responses survive
  // connection drops, timeouts, or unexpected stream termination.
  let preCreatedMsgId: number | undefined
  let leoUserId: number | undefined
  if (resolvedSpaceId) {
    try {
      if (tenantSlug) {
        const leoEmail = leoSystemUserEmail(tenantSlug)
        const leoUsers = await req.payload.find({
          collection: 'users',
          where: { and: [{ email: { equals: leoEmail } }, { isSystemUser: { equals: true } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        leoUserId = leoUsers.docs?.[0]?.id
        // Fallback: try legacy email pattern during migration
        if (!leoUserId) {
          const legacyLeo = await req.payload.find({
            collection: 'users',
            where: { and: [{ email: { equals: leoLegacyEmail(tenantSlug) } }, { isSystemUser: { equals: true } }] },
            limit: 1, depth: 0, overrideAccess: true,
          })
          leoUserId = legacyLeo.docs?.[0]?.id
        }
      }

      const placeholder = await req.payload.create({
        collection: 'messages',
        data: {
          content: wrapTextContent('...'),
          space: resolvedSpaceId,
          channel: resolvedChannel,
          messageType: 'ai_agent',
          ...(leoUserId ? { author: leoUserId } : {}),
          metadata: { streaming: true, model: resolveModelId() },
        } as any,
        overrideAccess: true,
      })
      preCreatedMsgId = placeholder.id as number
    } catch (preCreateErr) {
      console.warn('[LEO Stream] Failed to pre-create message:', preCreateErr)
      // Non-fatal — fall back to save-on-end
    }
  }

  // Create SSE stream
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // fullText lives outside try/catch so partial responses survive errors
      let fullText = ''
      let hadError = false

      // SSE heartbeat — keeps connection alive through proxies (Cloudflare, Vercel, ALBs)
      // Sends a comment line every 15s, which SSE clients silently ignore.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          // Stream already closed — clean up
          clearInterval(heartbeat)
        }
      }, 15_000)

      try {
        controller.enqueue(encoder.encode(sseEvent('start', {
          conversationId: resolvedConversationId,
          ...(preCreatedMsgId ? { messageId: preCreatedMsgId } : {}),
        })))

        if (useGateway) {
          // ─── Path 1: Vercel AI Gateway via AI SDK ───────────────────
          try {
            fullText = await streamViaGateway({
              controller,
              encoder,
              systemPrompt,
              historyMessages,
              userMessage: message.trim(),
              userImages,
              payload: req.payload,
              tenantId,
              resolvedSpaceId,
              userId: req.user?.id as number | undefined,
              isWizardMode,
              wizardStep: wizardStep as number,
            })
          } catch (gwErr) {
            // Gateway failed — log to AI Bus then try Anthropic fallback
            const gwErrMsg = gwErr instanceof Error ? gwErr.message : String(gwErr)
            logError({
              level: 'warning',
              source: 'leo-stream.gateway',
              message: `AI Gateway primary model failed, falling back to Sonnet: ${gwErrMsg}`,
              details: gwErr instanceof Error ? gwErr.stack : String(gwErr),
              statusCode: (gwErr as { status?: number })?.status,
              tenantId: tenantId ? String(tenantId) : undefined,
              userId: req.user?.id as number | undefined,
            }).catch(() => {})
            const fallbackClient = getAnthropicClient()
            if (fallbackClient) {
              console.warn('[LEO Stream] Gateway failed, falling back to Anthropic:', gwErrMsg)
              const result = await streamViaAnthropic({
                controller,
                encoder,
                client: fallbackClient,
                systemPrompt,
                historyMessages,
                userMessage: message.trim(),
                userImages,
                payload: req.payload,
                tenantId,
                resolvedSpaceId,
                userId: req.user?.id as number | undefined,
                isWizardMode,
                wizardStep: wizardStep as number,
                tenantSlug,
              })
              fullText = result.fullText
            } else {
              throw gwErr // No fallback available
            }
          }
        } else {
          // ─── Path 2: Direct Anthropic SDK (fallback) ────────────────
          const result = await streamViaAnthropic({
            controller,
            encoder,
            client: client!,
            systemPrompt,
            historyMessages,
            userMessage: message.trim(),
            userImages,
            payload: req.payload,
            tenantId,
            resolvedSpaceId,
            userId: req.user?.id as number | undefined,
            isWizardMode,
            wizardStep: wizardStep as number,
            tenantSlug,
          })
          fullText = result.fullText
        }
      } catch (error) {
        hadError = true
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('[LEO Stream] Error (all providers exhausted):', errMsg)
        controller.enqueue(encoder.encode(sseEvent('error', {
          message: `LEO encountered an error: ${errMsg}. Please try again.`,
          provider: 'gateway+fallback',
        })))
        logError({
          source: 'leo-stream',
          message: `Streaming LLM call failed (all providers exhausted): ${errMsg}`,
          details: error instanceof Error ? error.stack : String(error),
          statusCode: (error as { status?: number })?.status,
          tenantId: tenantId ? String(tenantId) : undefined,
          userId: req.user?.id as number | undefined,
        }).catch(() => {})
      }

      // ─── Persist: update pre-created message or create new one ──────
      let savedMessageId: number | undefined = preCreatedMsgId
      if (resolvedSpaceId && fullText.trim()) {
        try {
          if (preCreatedMsgId) {
            // Update the pre-created placeholder with final content
            await req.payload.update({
              collection: 'messages',
              id: preCreatedMsgId,
              data: {
                content: wrapTextContent(fullText),
                metadata: { streaming: false, model: resolveModelId(), partial: hadError },
              } as any,
              overrideAccess: true,
            })
          } else {
            // Fallback: pre-create failed, save now
            const saved = await req.payload.create({
              collection: 'messages',
              data: {
                content: wrapTextContent(fullText),
                space: resolvedSpaceId,
                channel: resolvedChannel,
                messageType: 'ai_agent',
                ...(leoUserId ? { author: leoUserId } : {}),
              } as any,
              overrideAccess: true,
            })
            savedMessageId = saved.id as number
          }
        } catch (saveErr) {
          console.warn('[LEO Stream] Failed to persist response:', saveErr)
          // Log the lost response so it can be recovered
          logError({
            source: 'leo-stream.persist',
            message: `Failed to save LEO response (${fullText.length} chars lost)`,
            details: `Response text: ${fullText.slice(0, 500)}...\nSave error: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`,
            tenantId: tenantId ? String(tenantId) : undefined,
            userId: req.user?.id as number | undefined,
          }).catch(() => {})
        }
      } else if (preCreatedMsgId && !fullText.trim()) {
        // Pre-created but no response generated — clean up the placeholder
        // or mark it as an error so it's visible
        try {
          const errContent = hadError
            ? 'LEO encountered an error processing this request.'
            : 'LEO was unable to generate a response.'
          await req.payload.update({
            collection: 'messages',
            id: preCreatedMsgId,
            data: {
              content: wrapTextContent(errContent),
              metadata: { streaming: false, error: true, model: resolveModelId() },
            } as any,
            overrideAccess: true,
          })
        } catch {
          // Best-effort cleanup
        }
      }

      // Send done event (even on error, if we have partial text)
      if (!hadError || fullText.trim()) {
        controller.enqueue(
          encoder.encode(
            sseEvent('done', {
              text: fullText,
              agentName,
              messageId: savedMessageId,
              conversationId: resolvedConversationId,
              ...(hadError ? { partial: true } : {}),
            }),
          ),
        )
      }

      clearInterval(heartbeat)
      controller.close()
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

// ---------------------------------------------------------------------------
// Path 1: Vercel AI Gateway streaming via AI SDK
// ---------------------------------------------------------------------------

async function streamViaGateway(opts: {
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
  systemPrompt: string
  historyMessages: Anthropic.MessageParam[]
  userMessage: string
  userImages: Array<{ url: string; mediaId?: number; alt?: string }>
  payload: import('payload').Payload
  tenantId?: number
  resolvedSpaceId?: number
  userId?: number
  isWizardMode: boolean
  wizardStep: number
}): Promise<string> {
  const {
    controller, encoder, systemPrompt, historyMessages, userMessage,
    userImages, payload, tenantId, resolvedSpaceId, userId,
    isWizardMode, wizardStep,
  } = opts

  const model = getModel() ?? getFallbackModel()
  if (!model) throw new Error('AI Gateway model could not be created')

  // Convert history to AI SDK format
  const messages: ModelMessage[] = historyMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: typeof m.content === 'string' ? m.content : '',
  }))

  // Prevent "split-brain" echo: the user message was already saved to DB
  // before calling /api/leo/stream, so fetchConversationHistory() already
  // includes it. Only append the current message if it ISN'T already the
  // last entry in history (handles both race-condition and no-history cases).
  const lastHistoryMsg = messages[messages.length - 1]
  const alreadyInHistory =
    lastHistoryMsg?.role === 'user' &&
    typeof lastHistoryMsg.content === 'string' &&
    lastHistoryMsg.content.trim() === userMessage.trim()

  if (!alreadyInHistory) {
    // Build user message (with images if present)
    if (userImages.length > 0) {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: URL }> = [
        { type: 'text', text: userMessage },
      ]
      for (const img of userImages) {
        let imageUrl = img.url
        if (imageUrl.startsWith('/')) {
          imageUrl = `${serverUrl}${imageUrl}`
        }
        parts.push({ type: 'image', image: new URL(imageUrl) })
      }
      messages.push({ role: 'user', content: parts })
    } else {
      messages.push({ role: 'user', content: userMessage })
    }
  } else if (userImages.length > 0) {
    // History has the text but not the images — replace the last entry
    // with a multimodal message so the LLM can see both text and images.
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: URL }> = [
      { type: 'text', text: userMessage },
    ]
    for (const img of userImages) {
      let imageUrl = img.url
      if (imageUrl.startsWith('/')) {
        imageUrl = `${serverUrl}${imageUrl}`
      }
      parts.push({ type: 'image', image: new URL(imageUrl) })
    }
    messages[messages.length - 1] = { role: 'user', content: parts }
  }

  // Convert tools with execute functions bound to Payload context
  const toolCtx: ToolExecutorContext = {
    payload,
    tenantId,
    spaceId: resolvedSpaceId,
    userId,
  }
  const tools = convertToolsForAISDK(LEO_TOOLS, executeToolCall, toolCtx)

  // Track tool calls for wizard step advancement and image extraction
  const allToolNames: string[] = []
  const allToolResults: string[] = []

  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_TOOL_ROUNDS),
    maxOutputTokens: MAX_RESPONSE_TOKENS,
    onStepFinish: (step) => {
      // Track tool names for wizard advancement
      if (step.toolCalls) {
        for (const tc of step.toolCalls) {
          allToolNames.push((tc as any).toolName)
        }
      }
      // Track tool results for image URL extraction
      if (step.toolResults) {
        for (const tr of step.toolResults) {
          const output = (tr as any).output
          if (typeof output === 'string') {
            allToolResults.push(output)
          }
        }
      }
    },
  })

  // Stream text deltas to SSE — capture fullText even on partial failure
  let fullText = ''
  try {
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        fullText += part.text
        controller.enqueue(encoder.encode(sseEvent('delta', { text: part.text })))
      } else if (part.type === 'tool-call') {
        controller.enqueue(
          encoder.encode(sseEvent('tool_call', { name: part.toolName, status: 'calling' })),
        )
      } else if (part.type === 'tool-result') {
        controller.enqueue(
          encoder.encode(sseEvent('tool_call', { name: part.toolName, status: 'executed' })),
        )
      } else if (part.type === 'error') {
        console.error('[LEO Stream] AI SDK stream error part:', (part as any).error)
      }
    }
  } catch (streamErr) {
    console.error('[LEO Stream] Gateway stream interrupted:', streamErr instanceof Error ? streamErr.message : streamErr)
    if (fullText.trim()) {
      // Return partial text instead of losing it
      return fullText
    }
    // Retry with fallback model (Sonnet 4.6) if primary produced no output
    const fallback = getFallbackModel()
    if (fallback) {
      console.warn('[LEO Stream] Retrying with fallback model (Sonnet 4.6)')
      controller.enqueue(encoder.encode(sseEvent('delta', { text: '' })))
      const retryResult = streamText({
        model: fallback,
        system: systemPrompt,
        messages,
        tools,
        stopWhen: stepCountIs(MAX_TOOL_ROUNDS),
        maxOutputTokens: MAX_RESPONSE_TOKENS,
      })
      for await (const part of retryResult.fullStream) {
        if (part.type === 'text-delta') {
          fullText += part.text
          controller.enqueue(encoder.encode(sseEvent('delta', { text: part.text })))
        }
      }
      if (fullText.trim()) return fullText
    }
    throw streamErr
  }

  // Wizard step advancement
  if (isWizardMode && tenantId && allToolNames.length > 0) {
    await advanceWizardStep(payload, tenantId, wizardStep, allToolNames)
  }

  // Extract and append image URLs from tool results
  const validImageUrls = extractImageUrlsFromText(allToolResults)
  if (validImageUrls.length > 0) {
    // Re-emit done with images — the main handler will send its own done event too,
    // but we include images here for the client to pick up
    controller.enqueue(
      encoder.encode(sseEvent('images', { images: validImageUrls })),
    )
  }

  return fullText
}

// ---------------------------------------------------------------------------
// Path 2: Direct Anthropic SDK streaming (fallback)
// ---------------------------------------------------------------------------

async function streamViaAnthropic(opts: {
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
  client: Anthropic
  systemPrompt: string
  historyMessages: Anthropic.MessageParam[]
  userMessage: string
  userImages: Array<{ url: string; mediaId?: number; alt?: string }>
  payload: import('payload').Payload
  tenantId?: number
  resolvedSpaceId?: number
  userId?: number
  isWizardMode: boolean
  wizardStep: number
  tenantSlug: string
}): Promise<{ fullText: string }> {
  const {
    controller, encoder, client, systemPrompt, historyMessages, userMessage,
    userImages, payload, tenantId, resolvedSpaceId, userId,
    isWizardMode, wizardStep,
  } = opts

  // Build user content (with images if present)
  const userContent: Anthropic.ContentBlockParam[] = [
    { type: 'text', text: userMessage },
  ]
  if (userImages.length > 0) {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
    for (const img of userImages) {
      let imageUrl = img.url
      if (imageUrl.startsWith('/')) {
        imageUrl = `${serverUrl}${imageUrl}`
      }
      userContent.push({
        type: 'image',
        source: { type: 'url', url: imageUrl },
      } as Anthropic.ContentBlockParam)
    }
  }

  // Prevent "split-brain" echo: the user message was already saved to DB
  // before calling /api/leo/stream, so fetchConversationHistory() already
  // includes it. Only append the current message if it ISN'T already the
  // last entry in history.
  const lastMsg = historyMessages[historyMessages.length - 1]
  const msgAlreadyInHistory =
    lastMsg?.role === 'user' &&
    typeof lastMsg.content === 'string' &&
    lastMsg.content.trim() === userMessage.trim()

  let messages: Anthropic.MessageParam[]
  if (msgAlreadyInHistory && userImages.length > 0) {
    // History has text but not images — replace last entry with multimodal version
    messages = [
      ...historyMessages.slice(0, -1),
      { role: 'user' as const, content: userContent },
    ]
  } else if (msgAlreadyInHistory) {
    // Already in history, no images — use history as-is
    messages = [...historyMessages]
  } else {
    // Not in history (race condition / first message) — append it
    messages = [
      ...historyMessages,
      { role: 'user' as const, content: userImages.length > 0 ? userContent : userMessage },
    ]
  }

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

    let currentToolUseId = ''
    let currentToolName = ''
    let currentToolInputJson = ''
    const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
    let stopReason: string | null = null

    for await (const event of response) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolUseId = event.content_block.id
          currentToolName = event.content_block.name
          currentToolInputJson = ''
          controller.enqueue(
            encoder.encode(sseEvent('tool_call', { name: currentToolName, status: 'calling' })),
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
          let toolInput: Record<string, unknown> = {}
          try {
            toolInput = currentToolInputJson ? JSON.parse(currentToolInputJson) : {}
          } catch {
            toolInput = {}
          }
          toolUseBlocks.push({ id: currentToolUseId, name: currentToolName, input: toolInput })
          currentToolUseId = ''
          currentToolName = ''
          currentToolInputJson = ''
        }
      } else if (event.type === 'message_delta') {
        stopReason = event.delta.stop_reason
      }
    }

    if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
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

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      const toolCtx: ToolExecutorContext = {
        payload,
        tenantId,
        spaceId: resolvedSpaceId,
        userId,
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
        toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: result })
      }

      messages.push({ role: 'user' as const, content: toolResults })

      // Wizard step advancement
      if (isWizardMode && tenantId) {
        const completedTools = toolUseBlocks.map((t) => t.name)
        await advanceWizardStep(payload, tenantId, wizardStep, completedTools)
      }

      fullText = ''
      continue
    }

    break
  }

  // Extract image URLs from tool results
  const validImageUrls = extractImageUrls(messages)
  if (validImageUrls.length > 0) {
    controller.enqueue(
      encoder.encode(sseEvent('images', { images: validImageUrls })),
    )
  }

  return { fullText }
}
