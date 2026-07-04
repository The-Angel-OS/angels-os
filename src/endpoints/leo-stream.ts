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

import { buildMinimalConstitutionalPrompt, buildCOOPromptSuffix, buildHealthDigest } from '@/utilities/constitutional-prompt'
import type { EnterpriseStage, NodeRole } from '@/utilities/constitutional-prompt'
import { leoLegacyEmail, leoSystemUserEmail } from '@/utilities/leoEmail'
import { LEO_TOOLS, executeToolCall } from '@/utilities/leo-data-tools'
import { extractAffectedUrls } from '@/utilities/affectedUrl'
import { truncateHistoryMessage } from '@/utilities/truncateHistoryMessage'
import { assembleHistoryTurns, turnEchoesUserMessage } from '@/utilities/assembleHistoryTurns'
import {
  hashContext as hashPheromoneContext,
  calculateStrength as calcPheromoneStrength,
  calculateDecayDate,
  PHEROMONE_TRAVERSAL_WEIGHT,
} from '@/utilities/pheromone-engine'
import type { Payload } from 'payload'
import type { ToolExecutorContext } from '@/utilities/leo-data-tools'
import { ExecutionTrace } from '@/utilities/executionTrace'
import { createLogger } from '@/utilities/createLogger'
import { routeToAgent } from '@/utilities/AgentRouter'
import { extractTextFromContent, wrapTextContent } from '@/utilities/messageContent'
import { logError } from '@/utilities/logError'
import { buildWizardSystemPromptSuffix } from '@/utilities/wizardPrompt'
import type { WizardContext } from '@/utilities/wizardPrompt'
import { getModel, getFallbackModel, isGatewayAvailable, convertToolsForAISDK, MODEL_CATALOG, DEFAULT_MODEL, FALLBACK_MODEL, resolveModelId, getSmartModel, TASK_MODEL_MAP, checkCredits, getEscalatedComplexity, parseAgentEscalation, DEFAULT_ESCALATION, liftComplexity, complexityFloorForRoles } from '@/utilities/ai-gateway'
import type { TaskComplexity, EscalationStrategy } from '@/utilities/ai-gateway'
import { trimToTokenBudget } from '@/utilities/contextWindow'
import { selectToolsForUser, allReadOnly, selectToolsForModel } from '@/utilities/leoToolSelection'
import { buildResponseTelemetry, type AiResponseTelemetry } from '@/utilities/aiUsage'
import { recordAiUsage } from '@/utilities/recordCostEvent'
import { buildByokModel } from '@/utilities/ai-gateway'
import { isBudgetEnforcementEnabled, getTenantAiBudgetStatusCached } from '@/utilities/aiBudget'

// ---------------------------------------------------------------------------
// Constants (mirrored from ConversationEngine for consistency)
// ---------------------------------------------------------------------------

const MAX_HISTORY_TURNS = 12
// Fetch a generous candidate set, then let the TOKEN budget (not a fixed count)
// govern what actually goes to the model — short turns keep more history, long
// ones never blow the window.
const HISTORY_FETCH_CEILING = MAX_HISTORY_TURNS * 3
const HISTORY_TOKEN_BUDGET = 6000
const MAX_RESPONSE_TOKENS = 1500
const MAX_TOOL_ROUNDS = 5
const LLM_MODEL = 'claude-sonnet-4-6'
// Within one request, stop hammering a tool that keeps failing (cheap guard;
// real cross-request breaking needs durable state, intentionally out of scope).
const TOOL_FAIL_LIMIT = 2

// Track health queries that have already warned to avoid log spam (once per deployment)
const _healthQueryWarned = new Set<string>()

// ---------------------------------------------------------------------------
// Slash command handler
// ---------------------------------------------------------------------------

/**
 * Handle /commands typed in chat. Returns response text or null if not a command.
 * Model switching is restricted to super_admin users for security.
 */
async function handleSlashCommand(msg: string, userRoles?: string[]): Promise<string | null> {
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
      lines.push(`\n**Smart Routing Tiers:**`)
      for (const [tier, cfg] of Object.entries(TASK_MODEL_MAP)) {
        lines.push(`• **${tier}** → \`${cfg.primary}\` (fallback: ${cfg.fallbacks.map(f => `\`${f}\``).join(', ')})`)
      }
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

  if (cmd === '/credits' && isSuperAdmin) {
    const credits = await checkCredits()
    if (!credits) {
      return '⚠️ Could not check credits — AI Gateway key may not be configured.'
    }
    const lines = [
      '**AI Gateway Credits**\n',
      `💰 **Balance:** $${credits.balance.toFixed(2)}`,
      `📊 **Total used:** $${credits.totalUsed.toFixed(2)}`,
      '',
    ]
    if (credits.balance < 2) {
      lines.push('🔴 **CRITICAL** — Budget models forced. Top up immediately.')
    } else if (credits.balance < 10) {
      lines.push('🟡 **LOW** — Model tiers are being downshifted to conserve credits.')
    } else if (credits.balance < 25) {
      lines.push('🟠 **MONITOR** — Usage is being tracked.')
    } else {
      lines.push('🟢 **Healthy** — All model tiers available.')
    }
    return lines.join('\n')
  }

  if (cmd === '/escalation' || cmd === '/rhythm') {
    const strat = DEFAULT_ESCALATION
    const lines = [
      '**🧠 Model Escalation Rhythm**\n',
      `Status: ${strat.enabled ? '✅ **Enabled**' : '⏸️ **Disabled**'}`,
      `Standard rounds: **${strat.standardRounds}** (${strat.standardTier} tier — fast/cheap)`,
      `Escalation round: every **${strat.standardRounds + 1}th** turn (${strat.escalationTier} tier — deep think)`,
      '',
      '**How it works:**',
      `Turns 1-${strat.standardRounds}: \`${TASK_MODEL_MAP[strat.standardTier].primary}\` (fast responses)`,
      `Turn ${strat.standardRounds + 1}: \`${TASK_MODEL_MAP[strat.escalationTier].primary}\` (**deep thinking**)`,
      `Then repeats...`,
      '',
      '**Why:** Most conversations need snappy responses, but periodically LEO',
      'escalates to a more powerful model for deeper reasoning, then drops back.',
      'This balances cost efficiency with intelligence.',
    ]
    if (isSuperAdmin) {
      lines.push('', '*Per-agent overrides available in agent config → Model Strategy.*')
    }
    return lines.join('\n')
  }

  if (cmd === '/help') {
    return [
      '**LEO Commands**\n',
      '• `/models` — List available AI models + smart routing tiers',
      '• `/escalation` — View model escalation rhythm (deep think schedule)',
      ...(isSuperAdmin ? ['• `/model <alias>` — Switch to a different model (super admin only)'] : []),
      ...(isSuperAdmin ? ['• `/credits` — Check AI Gateway credit balance (super admin only)'] : []),
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
// LEO Navigation Bridge — extract/strip nav directives from tool responses
// ---------------------------------------------------------------------------

function extractNavDirective(text: string): { path: string; label?: string } | null {
  const match = text.match(/<!--nav:(.*?)-->/)
  if (!match) return null
  try { return JSON.parse(match[1]) } catch { return null }
}

function stripNavDirective(text: string): string {
  return text.replace(/<!--nav:.*?-->/g, '').replace(/<!--affectedUrl:.*?-->/g, '').trim()
}

// Visual echo: collect the public surfaces content mutations touched (appended as
// <!--affectedUrl:...--> to tool results by executeToolCall), so the client can snapshot
// them before/after. extractAffectedUrls lives in src/utilities/affectedUrl.ts (shared
// source of truth with the producer); collectToolResultTexts pulls the strings here.
function collectToolResultTexts(messages: Anthropic.MessageParam[]): string[] {
  const out: string[] = []
  for (const msg of messages) {
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (typeof block === 'object' && 'type' in block && block.type === 'tool_result') {
          out.push(typeof block.content === 'string' ? block.content : '')
        }
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Pheromone Recording (fire-and-forget, best-effort)
// ---------------------------------------------------------------------------

/**
 * Record a pheromone trail when LEO navigates the user.
 * Creates or strengthens a trail so the swarm remembers successful paths.
 * Never blocks the SSE response — errors are silently swallowed.
 */
async function recordPheromoneTraversal(
  payload: Payload,
  opts: {
    contextHash: string
    path: string
    toolName?: string
    tenantId: number
  },
): Promise<void> {
  const now = new Date()

  // Find existing pheromone for this context+path+tenant
  const existing = await payload.find({
    collection: 'pheromones' as any,
    where: {
      and: [
        { contextHash: { equals: opts.contextHash } },
        { path: { equals: opts.path } },
        { tenant: { equals: opts.tenantId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs[0]) {
    // Reinforce existing trail — the ant followed the scent
    const doc = existing.docs[0] as any
    const ageMs = now.getTime() - new Date(doc.createdAt).getTime()
    const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24))
    const newTraversals = (doc.successfulTraversals || 0) + 1
    const newStrength = calcPheromoneStrength(newTraversals, ageDays, doc.abandonments || 0)

    await payload.update({
      collection: 'pheromones' as any,
      id: doc.id,
      data: {
        successfulTraversals: newTraversals,
        strength: newStrength,
        lastTraversedAt: now.toISOString(),
        decay: calculateDecayDate(now),
      } as any,
      overrideAccess: true,
    })
  } else {
    // First traversal — lay a new trail
    await payload.create({
      collection: 'pheromones' as any,
      data: {
        contextHash: opts.contextHash,
        path: opts.path,
        toolName: opts.toolName || 'unknown',
        strength: PHEROMONE_TRAVERSAL_WEIGHT,
        successfulTraversals: 1,
        abandonments: 0,
        lastTraversedAt: now.toISOString(),
        decay: calculateDecayDate(now),
        tenant: opts.tenantId,
      } as any,
      overrideAccess: true,
    })
  }
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

The most recent message is from **${displayName}** — address THEM. This channel may include other people; earlier messages in the history are prefixed with the speaker's name (e.g. "Alex: ..."). Never assume you are talking to someone who appears earlier in the history — always greet and address the current user, **${displayName}**.

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
- **generate_image** — create AI-generated images (product photos, content images, illustrations) via Gemini / OpenRouter. Auto-attaches to products when productName is provided.
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
      limit: HISTORY_FETCH_CEILING,
      depth: 1,
      overrideAccess: true,
    })

    const docs = [...result.docs].reverse()

    // Attribute human turns by speaker so LEO can tell participants apart in a
    // multi-user channel (else it parrots whichever name dominates the history —
    // the "greeted Tyler as Kenneth" bug). See assembleHistoryTurns.
    const messages: Anthropic.MessageParam[] = assembleHistoryTurns(
      docs.map((msg) => {
        const author = msg.author as unknown as Record<string, unknown> | null
        const isSystem = Boolean(
          author &&
            (author.isSystemUser === true ||
              (Array.isArray(author.roles) && author.roles.includes('system'))),
        )
        const authorName =
          (author && ((author.name as string) || (author.email as string)?.split('@')[0])) || 'User'
        return {
          isSystem,
          authorName,
          content: truncateHistoryMessage(extractTextFromContent(msg.content)),
        }
      }),
    )

    while (messages.length > 0 && messages[0].role !== 'user') {
      messages.shift()
    }

    // Token-aware windowing: keep the most recent turns within the budget,
    // dropping oldest first (also re-ensures the list starts with a user turn).
    return trimToTokenBudget(messages, HISTORY_TOKEN_BUDGET)
  } catch (historyErr) {
    console.warn('[LEO Stream] Failed to load conversation history — responding without context:', historyErr instanceof Error ? historyErr.message : historyErr)
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
    complete_enlistment: 7,
    sign_constitution: -1,
    ping_federation: 8,
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
            currentStep: Math.min(nextStep, 8),
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
// Proactive Health Context — Sprint 24
// ---------------------------------------------------------------------------

/**
 * Lightweight health context gathered at session start.
 * This provides LEO with situational awareness without the user asking.
 */
async function gatherHealthContext(
  payload: import('payload').Payload,
  tenantId: number,
): Promise<{
  healthDigest: string
  cooSuffix: string
} | null> {
  try {
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })
    if (!tenant) return null

    const createdAt = (tenant as any).createdAt || new Date().toISOString()
    const created = new Date(createdAt)
    const daysSinceCreation = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24))
    const stage: EnterpriseStage = daysSinceCreation <= 90 ? 'BIRTH' : daysSinceCreation <= 365 ? 'GROWTH' : 'ACTIVE'
    const daysInStage = stage === 'BIRTH' ? 90 - daysSinceCreation : stage === 'GROWTH' ? 365 - daysSinceCreation : undefined

    // Detect node role — flagship if domain matches or setup flag
    const domain = (tenant as any)?.domains?.[0]?.domain || ''
    const isFlagship = domain === 'spacesangels.com' || Boolean((tenant as any)?.setup?.isFlagship) // Sprint 42: `as any` removable after type regen

    // Quick parallel queries for health metrics (non-blocking, best-effort)
    const [pendingOrdersRes, overdueOrdersRes, productsRes, pendingCommentsRes, draftPostsRes, spacesRes, membershipsRes] = await Promise.allSettled([
      payload.find({ collection: 'orders' as any, where: { and: [{ tenant: { equals: tenantId } }, { status: { in: ['pending', 'processing'] } }] } as any, limit: 0, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'orders' as any, where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: 'processing' } }, { createdAt: { less_than: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() } }] } as any, limit: 0, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'products' as any, where: { tenant: { equals: tenantId } } as any, limit: 200, depth: 0, overrideAccess: true, select: { inventory: true, _status: true } as any }),
      payload.find({ collection: 'comments', where: { and: [{ tenant: { equals: tenantId } }, { isApproved: { equals: false } }] } as any, limit: 0, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'posts', where: { and: [{ tenant: { equals: tenantId } }, { _status: { equals: 'draft' } }] } as any, limit: 0, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'spaces', where: { tenant: { equals: tenantId } } as any, limit: 0, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'space-memberships', where: { tenant: { equals: tenantId } } as any, limit: 0, depth: 0, overrideAccess: true }),
    ])

    // Log any failed health queries so they don't silently show false zeros
    // Rate-limited: only warn once per query name per deployment to avoid log spam
    const healthQueries = { pendingOrdersRes, overdueOrdersRes, productsRes, pendingCommentsRes, draftPostsRes, spacesRes, membershipsRes }
    for (const [name, result] of Object.entries(healthQueries)) {
      if (result.status === 'rejected' && !_healthQueryWarned.has(name)) {
        _healthQueryWarned.add(name)
        // Drizzle wraps the real pg error: its own message is the (huge) SQL,
        // while `cause` holds the actionable part ("column X does not exist").
        // Lead with the cause — the SQL-only version made the kendev orders
        // schema drift undiagnosable from logs (260704).
        const reason = (result as PromiseRejectedResult).reason as (Error & { cause?: Error }) | undefined
        const detail = reason?.cause?.message || reason?.message || String(reason)
        console.warn(`[LEO Health] ${name} query failed (using 0):`, detail.slice(0, 500))
        logError({
          level: 'warning',
          source: 'leo-health.query',
          message: `LEO health query ${name} failed (treated as 0)`,
          details: detail.slice(0, 1500),
          tenantId: tenantId ? String(tenantId) : undefined,
        }).catch(() => {})
      }
    }

    const pendingOrders = pendingOrdersRes.status === 'fulfilled' ? pendingOrdersRes.value.totalDocs : 0
    const overdueOrders = overdueOrdersRes.status === 'fulfilled' ? overdueOrdersRes.value.totalDocs : 0

    // Inventory analysis
    let lowStockProducts = 0
    let outOfStockProducts = 0
    if (productsRes.status === 'fulfilled') {
      for (const doc of productsRes.value.docs) {
        const d = doc as any
        if (d._status === 'draft') continue
        const inv = d.inventory
        if (!inv || typeof inv !== 'object') continue
        if (!inv.trackInventory || typeof inv.quantity !== 'number') continue
        if (inv.quantity <= 0) outOfStockProducts++
        else if (inv.quantity <= (inv.lowStockThreshold || 5)) lowStockProducts++
      }
    }

    const pendingComments = pendingCommentsRes.status === 'fulfilled' ? pendingCommentsRes.value.totalDocs : 0
    const draftPosts = draftPostsRes.status === 'fulfilled' ? draftPostsRes.value.totalDocs : 0
    const spaceCount = spacesRes.status === 'fulfilled' ? spacesRes.value.totalDocs : 0
    const memberCount = membershipsRes.status === 'fulfilled' ? membershipsRes.value.totalDocs : 0

    // Federation status
    const setup = (tenant as any)?.setup || {}
    const completedSteps: number[] = Array.isArray(setup?.wizardProgress?.completedSteps) ? setup.wizardProgress.completedSteps : []
    const federationStatus: 'connected' | 'pending' | 'unknown' = completedSteps.includes(8) ? 'connected' : setup.federationId ? 'pending' : 'unknown'
    const stripeConnected = Boolean((tenant as any)?.stripe?.accountId)

    // Determine node role (simplified — no board query to keep this lightweight)
    const nodeRole: NodeRole = isFlagship ? 'flagship_user' : 'member_node_admin'

    const healthDigest = buildHealthDigest({
      stage,
      daysSinceCreation,
      daysInStage: daysInStage != null && daysInStage > 0 ? daysInStage : undefined,
      pendingOrders,
      overdueOrders,
      lowStockProducts,
      outOfStockProducts,
      pendingComments,
      draftPosts,
      federationStatus,
      stripeConnected,
      spaceCount,
      memberCount,
    })

    const cooSuffix = buildCOOPromptSuffix({
      stage,
      daysSinceCreation,
      nodeRole,
      isFlagship,
      isBoardMember: false, // Lightweight — skip board query at prompt build time
    })

    return { healthDigest, cooSuffix }
  } catch (err) {
    console.warn('[LEO Stream] Health context gathering failed (non-fatal):', err)
    return null
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

  // Enforce message length limit — prevents abuse and keeps within LLM context bounds
  const MAX_LEO_MESSAGE_LENGTH = 50_000
  if (message.length > MAX_LEO_MESSAGE_LENGTH) {
    return Response.json(
      { message: `Message too long (${message.length} chars). Maximum is ${MAX_LEO_MESSAGE_LENGTH}.` },
      { status: 400 },
    )
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

  // Resolve conversationId early — needed for slash command SSE responses
  const resolvedConversationId =
    typeof conversationId === 'string' ? conversationId : `conv_${Date.now()}`

  // ─── Slash Commands ──────────────────────────────────────────────────────
  const trimmedMsg = message.trim()
  if (trimmedMsg.startsWith('/')) {
    const reqUser = req.user as unknown as Record<string, unknown> | undefined
    const slashRoles = Array.isArray(reqUser?.roles) ? (reqUser.roles as string[]) : undefined
    const cmdResult = await handleSlashCommand(trimmedMsg, slashRoles)
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
  let tenantAiConfig: Record<string, unknown> | undefined
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
      const tenantDoc = tenants.docs?.[0] as any
      tenantId = tenantDoc?.id
      // Sprint 44: extract AI config for multi-provider routing
      if (tenantDoc?.aiConfig) {
        const ac = tenantDoc.aiConfig
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
      // Non-critical
    }
  }

  // Extract user context
  const user = req.user as unknown as Record<string, unknown> | undefined
  const userName = (user?.name as string) || undefined
  const userEmail = (user?.email as string) || undefined
  const userRoles = Array.isArray(user?.roles) ? (user.roles as string[]) : undefined

  // Tool subsetting: confirmed non-admins don't get admin/destructive tool
  // schemas (they can't call them anyway) — trims the prompt + removes footguns.
  const availableTools = selectToolsForUser(LEO_TOOLS, userRoles)

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

  // Sprint 24: Proactive health context injection (non-wizard mode only)
  let systemPrompt: string
  if (isWizardMode) {
    systemPrompt = baseSystemPrompt + buildWizardSystemPromptSuffix(wizardStep as number, wizardContext)
  } else if (tenantId) {
    // Gather health context for COO mode — lightweight, non-blocking
    const healthCtx = await gatherHealthContext(req.payload, tenantId)
    if (healthCtx) {
      systemPrompt = baseSystemPrompt + '\n\n' + healthCtx.cooSuffix + '\n\n' + healthCtx.healthDigest
    } else {
      systemPrompt = baseSystemPrompt
    }
  } else {
    systemPrompt = baseSystemPrompt
  }

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
          // Pass tenant explicitly (already resolved above) so the persist never
          // depends on the setTenantFromSpace hook's space lookup — when that lookup
          // fails, the required-tenant validator throws and the reply is silently
          // lost ("LEO reply vanishes on refresh"). Hook stays as the fallback.
          ...(tenantId ? { tenant: tenantId } : {}),
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
      let streamErrorDetail: string | undefined
      let streamTelemetry: AiResponseTelemetry | undefined
      let streamBilledToTenantKey = false

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

        // ─── Model Escalation Rhythm ─────────────────────────────────
        // Count user turns in conversation history to determine if this is
        // a "deep think" escalation round (e.g., every 5th turn uses a
        // more powerful model for complex reasoning).
        const userTurnCount = historyMessages.filter(m => m.role === 'user').length + 1 // +1 for current message

        // Resolve escalation strategy — per-agent override (dedicated field or responseRules fallback)
        const agentStrategy = parseAgentEscalation(
          (agent as any)?.modelStrategy || (agent as any)?.responseRules?.modelStrategy || null,
        )
        const escalationStrategy = agentStrategy || DEFAULT_ESCALATION
        const escalatedTier = getEscalatedComplexity(userTurnCount, escalationStrategy)
        const isEscalationRound = escalatedTier !== escalationStrategy.standardTier

        if (isEscalationRound) {
          console.info(`[LEO Stream] 🧠 Deep think round (turn ${userTurnCount}) — using ${TASK_MODEL_MAP[escalatedTier]?.primary || escalatedTier} tier`)
          // Inject deep-think context into system prompt so the model knows it has
          // extra reasoning capacity this round
          systemPrompt += `\n\n## 🧠 Deep Think Mode (Turn ${userTurnCount})

This is a deep-thinking round. You are running on a more powerful model (${TASK_MODEL_MAP[escalatedTier]?.primary || escalatedTier}) for this turn. Take advantage of this by:
- Providing more thorough, nuanced analysis
- Catching issues or opportunities you might miss in a quick response
- Offering strategic suggestions, not just tactical answers
- Connecting dots across the conversation so far
- Being more creative and insightful in your recommendations

After this turn, you'll return to the faster model for responsive day-to-day interactions.`
        }

        // Emit escalation tier in start event so UI can show "Deep thinking..."
        controller.enqueue(encoder.encode(sseEvent('tier', {
          tier: escalatedTier,
          isDeepThink: isEscalationRound,
          turnNumber: userTurnCount,
          model: TASK_MODEL_MAP[escalatedTier]?.primary || 'unknown',
        })))

        if (useGateway) {
          // ─── Path 1: Vercel AI Gateway via AI SDK ───────────────────
          try {
            const gwResult = await streamViaGateway({
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
              complexity: escalatedTier,
              isEscalationRound,
              tenantAiConfig,
              availableTools,
              resolvedChannel,
              userRoles,
            })
            fullText = gwResult.text
            streamTelemetry = gwResult.telemetry
            streamBilledToTenantKey = gwResult.billedToTenantKey ?? false
            if (gwResult.hadStreamError) {
              hadError = true
              streamErrorDetail = gwResult.errorMessage
              // Error PARTS (e.g. Groq "request too large") don't throw, so the
              // outer catch's logError never fires — log here so the real cause
              // lands in application-logs + the AI Bus errors channel.
              if (!fullText.trim()) {
                logError({
                  source: 'leo-stream.model',
                  message: `LLM stream error: ${streamErrorDetail || 'unknown error'}`,
                  details: streamErrorDetail,
                  tenantId: tenantId ? String(tenantId) : undefined,
                  userId: req.user?.id as number | undefined,
                }).catch(() => {})
              }
            }
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
                tenantAiConfig,
                availableTools,
                resolvedChannel,
                userRoles,
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
            tenantAiConfig,
            availableTools,
            resolvedChannel,
            userRoles,
          })
          fullText = result.fullText
        }
      } catch (error) {
        hadError = true
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        streamErrorDetail = errMsg
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
        // Strip navigation directives before persisting — they're ephemeral SSE-only
        const persistText = stripNavDirective(fullText)

        try {
          if (preCreatedMsgId) {
            // Update the pre-created placeholder with final content. This is the
            // streaming finalize, NOT an edit — skip message versioning so it never
            // shows "(edited)".
            await req.payload.update({
              collection: 'messages',
              id: preCreatedMsgId,
              data: {
                content: wrapTextContent(persistText),
                metadata: { streaming: false, model: resolveModelId(), partial: hadError, ...(streamTelemetry ?? {}) },
              } as any,
              overrideAccess: true,
              context: { skipMessageVersioning: true },
            })
          } else {
            // Fallback: pre-create failed, save now
            const saved = await req.payload.create({
              collection: 'messages',
              data: {
                content: wrapTextContent(persistText),
                space: resolvedSpaceId,
                channel: resolvedChannel,
                messageType: 'ai_agent',
                // Pass tenant explicitly — see the placeholder-create note above.
                ...(tenantId ? { tenant: tenantId } : {}),
                metadata: { streaming: false, ...(streamTelemetry ?? {}) },
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
      } else if (resolvedSpaceId && !fullText.trim()) {
        // Empty completion. The hadError path already logged at the model layer;
        // but a BLANK response with NO error flag (the model returned 200 with zero
        // text — a common vision failure: it couldn't read the image, hit a content
        // filter, or stopped without emitting) used to vanish silently, so LEO's own
        // log scan came back clean. Log it so it's analyzable — the image count is
        // the key clue for triaging vision/multimodal issues.
        if (!hadError) {
          const finishReason = (streamTelemetry as { finishReason?: string } | undefined)?.finishReason
          logError({
            level: 'warning',
            source: 'leo-stream.empty',
            message: `LEO returned an empty response${userImages.length ? ` with ${userImages.length} image(s) attached` : ''}`,
            details: JSON.stringify(
              {
                model: resolveModelId(),
                imageCount: userImages.length,
                imageMediaIds: userImages.map((i) => i.mediaId).filter(Boolean),
                finishReason: finishReason ?? null,
                telemetry: streamTelemetry ?? null,
                channel: resolvedChannel,
              },
              null,
              2,
            ),
            tenantId: tenantId ? String(tenantId) : undefined,
            userId: req.user?.id as number | undefined,
          }).catch(() => {})
        }
        // Pre-created but no response generated — clean up the placeholder
        // or mark it as an error so it's visible
        try {
          // Attach the real provider error so it's readable in-chat (not a black
          // box). The detail also lives in the AI Bus errors channel via logError.
          const detail = streamErrorDetail ? `\n\n> ${streamErrorDetail.slice(0, 500)}` : ''
          const errContent = hadError
            ? `⚠️ LEO couldn't complete this request.${detail}\n\n_Try a shorter message — this often means the request was too large or a provider hit a rate limit. It will route to a larger model on the next try._`
            : userImages.length
              ? `⚠️ I couldn't read that image — my current model may not support vision, or the image was too large. Try a smaller image, or tell me what's in it.`
              : 'LEO was unable to generate a response.'
          const errMeta = { streaming: false, error: true, model: resolveModelId(), errorDetail: streamErrorDetail, ...(streamTelemetry ?? {}) }
          if (preCreatedMsgId) {
            await req.payload.update({
              collection: 'messages',
              id: preCreatedMsgId,
              data: { content: wrapTextContent(errContent), metadata: errMeta } as any,
              overrideAccess: true,
              context: { skipMessageVersioning: true },
            })
          } else {
            // No placeholder (pre-create was skipped/failed) — CREATE the visible
            // error message so the empty response is never silent. Previously this
            // whole branch was gated on preCreatedMsgId, so an empty reply with no
            // placeholder vanished entirely ("message posts, LEO never replies").
            await req.payload.create({
              collection: 'messages',
              data: {
                content: wrapTextContent(errContent),
                space: resolvedSpaceId,
                channel: resolvedChannel,
                messageType: 'ai_agent',
                // Pass tenant explicitly — see the placeholder-create note above.
                ...(tenantId ? { tenant: tenantId } : {}),
                ...(leoUserId ? { author: leoUserId } : {}),
                metadata: errMeta,
              } as any,
              overrideAccess: true,
            })
          }
        } catch (cleanupErr) {
          console.error('[LEO Stream] Failed to update pre-created message with error state:', cleanupErr instanceof Error ? cleanupErr.message : cleanupErr)
        }
      }

      // Operating-Costs ledger — append this turn's AI cost (fire-and-forget,
      // fail-soft; no-ops until the cost-events table exists on this node).
      if (streamTelemetry && tenantId) {
        recordAiUsage(req.payload, {
          telemetry: streamTelemetry,
          tenantId,
          conversationId: resolvedConversationId ? String(resolvedConversationId) : undefined,
          userId: req.user?.id as number | undefined,
          messageRef: savedMessageId,
          billedToTenantKey: streamBilledToTenantKey,
        }).catch(() => {/* best-effort — never block SSE */})
      }

      // Send done event (even on error, if we have partial text)
      if (!hadError || fullText.trim()) {
        // LEO Navigation Bridge — extract nav directive before stripping
        const navDirective = extractNavDirective(fullText)
        const cleanText = stripNavDirective(fullText)

        // Pheromone Grid — record the scent trail (fire-and-forget)
        // Note: toolName is unavailable here (tracked inside streamViaGateway).
        // The contextHash still produces useful differentiation via query + tenantSlug.
        if (navDirective && tenantId) {
          recordPheromoneTraversal(req.payload, {
            contextHash: hashPheromoneContext({ query: trimmedMsg, tenantSlug }),
            path: navDirective.path,
            toolName: undefined,
            tenantId,
          }).catch(() => {/* best-effort — never block SSE */})
        }

        controller.enqueue(
          encoder.encode(
            sseEvent('done', {
              text: cleanText,
              agentName,
              messageId: savedMessageId,
              conversationId: resolvedConversationId,
              ...(hadError ? { partial: true } : {}),
              ...(navDirective ? { navigateTo: navDirective } : {}),
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
  /** Escalated complexity tier (from turn-based rhythm). Default: 'medium' */
  complexity?: TaskComplexity
  /** Whether this round is an escalation (deep think) round */
  isEscalationRound?: boolean
  /** Sprint 44: Per-tenant AI config for multi-provider routing */
  tenantAiConfig?: Record<string, unknown>
  /** Role-filtered tool subset (defaults to the full registry). */
  availableTools?: typeof LEO_TOOLS
  /** The channel LEO is answering in — threaded into the tool context. */
  resolvedChannel?: string
  /** Acting user's roles — threaded into the tool context for privileged-tool gates. */
  userRoles?: string[]
}): Promise<{ text: string; hadStreamError: boolean; errorMessage?: string; telemetry?: AiResponseTelemetry; billedToTenantKey?: boolean }> {
  const {
    controller, encoder, systemPrompt, historyMessages, userMessage,
    userImages, payload, tenantId, resolvedSpaceId, userId,
    isWizardMode, wizardStep, complexity = 'medium', isEscalationRound = false,
    tenantAiConfig, availableTools = LEO_TOOLS, resolvedChannel, userRoles,
  } = opts

  // Budget/BYOK enforcement (env-gated; OFF by default). When a tenant is over
  // its monthly AI budget AND has its own provider key, serve via that key — the
  // cost falls on the tenant ($0 to platform). Fail-soft: any hiccup falls
  // through to normal credit-aware routing, so LEO never stops answering.
  let smart: Awaited<ReturnType<typeof getSmartModel>> = null
  let billedToTenantKey = false
  if (isBudgetEnforcementEnabled() && tenantId) {
    try {
      const status = await getTenantAiBudgetStatusCached(payload, tenantId)
      if (status.overBudget && status.hasOwnKey) {
        const byok = await buildByokModel(tenantAiConfig)
        if (byok) {
          smart = { model: byok.model, providerOptions: {}, modelId: byok.modelId, complexity, effectiveComplexity: complexity }
          billedToTenantKey = true
          console.log(`[LEO Stream] 💳 Tenant ${tenantId} over budget → BYOK ${byok.modelId} ($0 to platform)`)
        }
      }
    } catch {
      /* fail-soft — fall through to normal routing */
    }
  }

  // Smart model selection: credit-aware tier + gateway-native fallback chain.
  // The complexity is the escalation rhythm's tier, LIFTED to the floor the
  // operator's stakes demand (a super_admin steering LEO is doing admin/agentic
  // work → strong tier). Credit pressure still downshifts inside getSmartModel.
  if (!smart) {
    const effectiveComplexity = liftComplexity(complexity, complexityFloorForRoles(userRoles))
    smart = await getSmartModel(effectiveComplexity, {
      tenantId,
      userId,
      tags: [
        'leo-stream',
        isWizardMode ? 'wizard' : 'chat',
        ...(isEscalationRound ? ['deep-think'] : []),
        ...(effectiveComplexity !== complexity ? ['steward-floor'] : []),
      ],
    })
  }
  if (!smart) throw new Error('AI Gateway model could not be created')
  const { model, providerOptions: smartProviderOptions, modelId: smartModelId, effectiveComplexity: servedTier } = smart

  // Telemetry: timestamps + the model that actually serves (updated on failover).
  const streamStart = Date.now()
  let ttftMs: number | undefined
  let servedModelId = smartModelId
  let failedOver = false

  // Small/free providers (Groq free tier, local 8GB) can't fit LEO's full tool
  // payload in their token budget — subset to the core toolset so the request
  // stays under their limit (e.g. Groq free = 8000 TPM). Cloud gateway keeps all.
  const effectiveTools = selectToolsForModel(availableTools, smartModelId)

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
  // Robust to assembleHistoryTurns' "Name: " attribution prefix — a raw === check
  // missed it in multi-user channels and doubled the turn (PlasmaPlasma).
  const alreadyInHistory =
    lastHistoryMsg?.role === 'user' &&
    turnEchoesUserMessage(lastHistoryMsg.content, userMessage)

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

  // Per-turn tool-chain audit trail — every executeToolCall records a step.
  const toolTrace = new ExecutionTrace('leo-toolchain')

  // Convert tools with execute functions bound to Payload context
  const toolCtx: ToolExecutorContext = {
    payload,
    tenantId,
    spaceId: resolvedSpaceId,
    userId,
    channelSlug: resolvedChannel,
    roles: userRoles,
    tenantAiConfig,
    trace: toolTrace,
  }
  const tools = convertToolsForAISDK(effectiveTools, executeToolCall, toolCtx)

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
    providerOptions: smartProviderOptions,
    onStepFinish: (step) => {
      // Track tool names for wizard advancement
      if (step.toolCalls) {
        for (const tc of step.toolCalls) {
          allToolNames.push((tc as any).toolName)
        }
      }
      // Track tool results for image URL extraction + error monitoring
      if (step.toolResults) {
        for (const tr of step.toolResults) {
          const output = (tr as any).output
          const toolName = (tr as any).toolName || 'unknown'
          if (typeof output === 'string') {
            allToolResults.push(output)
            // Log tool execution errors for observability (they don't throw but
            // return error strings). Into the real error log, not just stdout —
            // a turn that dies after repeated tool failures must be diagnosable
            // from application-logs, not only Vercel runtime logs (260704: a
            // stringified `where` bricked a gallery request invisibly). The
            // logError flood-guard dedups a tool failing in a retry loop.
            if (output.startsWith('Error') || output.startsWith('Input validation failed')) {
              console.warn(`[LEO Stream] Tool ${toolName} returned error:`, output.slice(0, 200))
              logError({
                level: 'warning',
                source: 'leo-stream.tool',
                message: `LEO tool ${toolName} returned an error`,
                details: output.slice(0, 1000),
                tenantId: tenantId ? String(tenantId) : undefined,
              }).catch(() => {})
            }
          }
        }
      }
    },
  })

  // Stream text deltas to SSE — capture fullText even on partial failure
  let fullText = ''
  let streamHadError = false
  let streamErrorDetail: string | undefined
  try {
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        if (ttftMs === undefined) ttftMs = Date.now() - streamStart
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
        const errDetail = (part as any).error
        console.error('[LEO Stream] AI SDK stream error part:', errDetail)
        streamHadError = true
        streamErrorDetail =
          errDetail instanceof Error
            ? errDetail.message
            : typeof errDetail === 'string'
              ? errDetail
              : (errDetail?.message ?? JSON.stringify(errDetail)?.slice(0, 400) ?? 'stream error')
        // Notify client so they can display a meaningful error
        controller.enqueue(
          encoder.encode(
            sseEvent('error', {
              message: streamErrorDetail || 'An error occurred during processing',
            }),
          ),
        )
      }
    }
  } catch (streamErr) {
    console.error('[LEO Stream] Gateway stream interrupted:', streamErr instanceof Error ? streamErr.message : streamErr)
    streamHadError = true
    streamErrorDetail = streamErr instanceof Error ? streamErr.message : String(streamErr)
    if (fullText.trim()) {
      // Return partial text instead of losing it — but notify client of the interruption
      controller.enqueue(
        encoder.encode(sseEvent('error', { message: 'Stream interrupted — partial response returned' })),
      )
      return { text: fullText, hadStreamError: true, errorMessage: streamErrorDetail }
    }
    // Retry with high-tier model if primary stream produced no output
    const retrySmart = await getSmartModel('high', {
      tenantId,
      userId,
      tags: ['leo-stream', 'retry'],
    })
    if (retrySmart) {
      console.warn(`[LEO Stream] Retrying with ${retrySmart.modelId}`)
      controller.enqueue(encoder.encode(sseEvent('delta', { text: '' })))
      const retryResult = streamText({
        model: retrySmart.model,
        system: systemPrompt,
        messages,
        tools,
        stopWhen: stepCountIs(MAX_TOOL_ROUNDS),
        maxOutputTokens: MAX_RESPONSE_TOKENS,
        providerOptions: retrySmart.providerOptions,
      })
      for await (const part of retryResult.fullStream) {
        if (part.type === 'text-delta') {
          fullText += part.text
          controller.enqueue(encoder.encode(sseEvent('delta', { text: part.text })))
        }
      }
      if (fullText.trim()) return { text: fullText, hadStreamError: true, errorMessage: streamErrorDetail }
    }
    throw streamErr
  }

  // An error PART (not a thrown error) that produced no text — e.g. Groq's
  // "request too large for model" — never reached the catch's retry above. Retry
  // once on the high tier (which routes to the gateway / a larger model, not the
  // small/free provider) so a provider-side limit recovers instead of dead-ending.
  if (streamHadError && !fullText.trim()) {
    try {
      const retrySmart = await getSmartModel('high', { tenantId, userId, tags: ['leo-stream', 'retry-errpart'] })
      if (retrySmart) {
        console.warn(`[LEO Stream] Error part with no text — retrying with ${retrySmart.modelId}`)
        controller.enqueue(encoder.encode(sseEvent('delta', { text: '' })))
        const retryResult = streamText({
          model: retrySmart.model,
          system: systemPrompt,
          messages,
          tools,
          stopWhen: stepCountIs(MAX_TOOL_ROUNDS),
          maxOutputTokens: MAX_RESPONSE_TOKENS,
          providerOptions: retrySmart.providerOptions,
        })
        for await (const part of retryResult.fullStream) {
          if (part.type === 'text-delta') {
            fullText += part.text
            controller.enqueue(encoder.encode(sseEvent('delta', { text: part.text })))
          }
        }
        if (fullText.trim()) {
          streamHadError = false // recovered on the larger model
          failedOver = true
          servedModelId = retrySmart.modelId
        }
      }
    } catch (retryErr) {
      console.error('[LEO Stream] High-tier retry failed:', retryErr instanceof Error ? retryErr.message : retryErr)
    }
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

  // Visual echo — surfaces a content mutation changed, for the client to snapshot.
  const affectedUrls = extractAffectedUrls(allToolResults)
  if (affectedUrls.length > 0) {
    controller.enqueue(encoder.encode(sseEvent('affectedUrl', { urls: affectedUrls })))
  }

  // ── Telemetry (fail-soft) — tokens, finish reason, latency, cost ──────────
  let telemetry: AiResponseTelemetry | undefined
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- usage shape varies by SDK/provider
    const usage = (await result.usage) as any
    const finishReason = (await result.finishReason) as string | undefined
    telemetry = buildResponseTelemetry({
      model: servedModelId,
      tier: servedTier,
      inputTokens: usage?.inputTokens ?? usage?.promptTokens,
      outputTokens: usage?.outputTokens ?? usage?.completionTokens,
      finishReason,
      toolNames: allToolNames,
      latencyMs: Date.now() - streamStart,
      ttftMs,
      failedOver,
    })
  } catch {
    /* telemetry is best-effort — never let it affect the response */
  }

  // Attach the tool-chain breadcrumb to telemetry → flows into Message.metadata
  // (persistence sites spread telemetry). Emit/escalate on failure.
  if (toolTrace.steps.length) {
    telemetry = { ...(telemetry ?? {}), toolChain: toolTrace.toJSON() } as AiResponseTelemetry
    await emitToolChainTrace(toolTrace, tenantId)
  }

  return { text: fullText, hadStreamError: streamHadError, errorMessage: streamHadError ? streamErrorDetail : undefined, telemetry, billedToTenantKey }
}

/**
 * Emit a finished LEO tool-chain trace. Silent on success (the trace is still
 * persisted to the assistant Message.metadata.toolChain for inspection); on
 * failure it logs through createLogger → ApplicationLogs + AI-Bus errors channel
 * + connector escalation (any medium). Fail-soft — never breaks the response.
 */
async function emitToolChainTrace(trace: ExecutionTrace, tenantId?: number): Promise<void> {
  if (!trace.steps.length || !trace.failed) return
  try {
    const log = createLogger('leo-toolchain', { tenantId })
    await log.error(`tool chain failed at ${trace.failedStep?.name}`, { details: trace.render() })
  } catch {
    /* observability must never break the answer */
  }
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
  /** Sprint 44: Per-tenant AI config for multi-provider routing */
  tenantAiConfig?: Record<string, unknown>
  /** Role-filtered tool subset (defaults to the full registry). */
  availableTools?: typeof LEO_TOOLS
  /** The channel LEO is answering in — threaded into the tool context. */
  resolvedChannel?: string
  /** Acting user's roles — threaded into the tool context for privileged-tool gates. */
  userRoles?: string[]
}): Promise<{ fullText: string }> {
  const {
    controller, encoder, client, systemPrompt, historyMessages, userMessage,
    userImages, payload, tenantId, resolvedSpaceId, userId,
    isWizardMode, wizardStep, tenantAiConfig, availableTools = LEO_TOOLS, resolvedChannel, userRoles,
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
  // Robust to assembleHistoryTurns' "Name: " attribution prefix (see other guard).
  const msgAlreadyInHistory =
    lastMsg?.role === 'user' &&
    turnEchoesUserMessage(lastMsg.content, userMessage)

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
  // Within-request guard: count failures per tool so we stop re-calling one that
  // keeps failing this session (persists across rounds).
  const toolFailCounts = new Map<string, number>()
  // Per-turn tool-chain audit trail — accumulates across all rounds of this turn.
  const toolTrace = new ExecutionTrace('leo-toolchain')

  while (round < MAX_TOOL_ROUNDS) {
    round++

    const response = await client.messages.create({
      model: LLM_MODEL,
      max_tokens: MAX_RESPONSE_TOKENS,
      system: systemPrompt,
      messages,
      ...(availableTools.length > 0 ? { tools: availableTools } : {}),
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
        channelSlug: resolvedChannel,
        roles: userRoles,
        tenantAiConfig,
        trace: toolTrace,
      }

      // Execute one tool, writing its result into a fixed index so order is
      // preserved regardless of whether we ran sequentially or concurrently.
      const orderedResults: Anthropic.ToolResultBlockParam[] = new Array(toolUseBlocks.length)
      const runTool = async (tool: { id: string; name: string; input: Record<string, unknown> }, idx: number) => {
        controller.enqueue(
          encoder.encode(sseEvent('tool_call', { name: tool.name, status: 'executing' })),
        )
        // Stop hammering a tool that already failed repeatedly this request.
        if ((toolFailCounts.get(tool.name) ?? 0) >= TOOL_FAIL_LIMIT) {
          orderedResults[idx] = {
            type: 'tool_result',
            tool_use_id: tool.id,
            content: `The ${tool.name} tool failed repeatedly this session and was skipped. Continue without it.`,
            is_error: true,
          }
          return
        }
        let result: string
        try {
          result = await executeToolCall(tool.name, tool.input, toolCtx)
          if (result.startsWith('Error') || result.startsWith('Input validation failed') || result.startsWith('Tool execution failed')) {
            toolFailCounts.set(tool.name, (toolFailCounts.get(tool.name) ?? 0) + 1)
          }
        } catch (toolErr) {
          console.error(`[LEO Stream] Tool ${tool.name} failed:`, toolErr)
          toolFailCounts.set(tool.name, (toolFailCounts.get(tool.name) ?? 0) + 1)
          result = `Tool execution failed: ${toolErr instanceof Error ? toolErr.message : 'Unknown error'}. I'll try to help without this tool.`
        }
        orderedResults[idx] = { type: 'tool_result', tool_use_id: tool.id, content: result }
      }

      // Pure-read rounds run concurrently; any side-effecting tool → sequential.
      if (allReadOnly(toolUseBlocks.map((t) => t.name))) {
        await Promise.all(toolUseBlocks.map((tool, idx) => runTool(tool, idx)))
      } else {
        for (let idx = 0; idx < toolUseBlocks.length; idx++) {
          await runTool(toolUseBlocks[idx], idx)
        }
      }
      toolResults.push(...orderedResults)

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

  // Visual echo — surfaces a content mutation changed, for the client to snapshot.
  const affectedUrls = extractAffectedUrls(collectToolResultTexts(messages))
  if (affectedUrls.length > 0) {
    controller.enqueue(encoder.encode(sseEvent('affectedUrl', { urls: affectedUrls })))
  }

  await emitToolChainTrace(toolTrace, tenantId)
  return { fullText }
}
