/**
 * Vapi Voice AI Webhook — POST /api/vapi/webhook
 *
 * Receives webhook events from Vapi.ai for phone-based LEO access.
 * ONE platform phone number serves ALL tenants — LEO routes internally.
 *
 * ## Routing Architecture (Single Number)
 *
 * All tenants share a single Vapi phone number (the platform number).
 * When a caller dials in, LEO answers as the platform and asks which
 * business they're calling for. Once the caller names a business, LEO
 * fuzzy-matches against active tenant names and switches context to
 * that Enterprise for the rest of the call.
 *
 * Dedicated numbers: If a tenant configures `vapi.phoneNumber`, calls
 * to that number skip the routing step and go straight to that tenant.
 *
 * ## AI Bus Integration
 *
 * Voice transcripts and call events are persisted as Messages with
 * messageType 'voice_call' in the tenant's default space, channel
 * 'voice'. This makes calls visible in the AI Bus alongside chat,
 * email, and other channels.
 *
 * ## Event Types
 *
 * - assistant-request: Initial call setup (returns assistant config)
 * - function-call: Leo tool invocations (mapped from Vapi function calls)
 * - conversation-update: Real-time transcript → Leo processing + routing
 * - end-of-call-report: Call summary → AI Bus persistence
 * - status-update / transcript / speech-update / hang: Acknowledged
 *
 * @see https://docs.vapi.ai/server-url
 *
 * Sprint 19 — Vapi Voice AI · Single-Number Routing · AI Bus
 */
import type { PayloadHandler } from 'payload'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { createVoiceCallContent } from '@/utilities/messageContent'

const VOICE_CHANNEL = 'voice'

// ─── In-Memory Tenant Cache (refreshed every 60s) ──────────────
// Avoids querying tenants on every single Vapi event.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tenantCache: { tenants: Record<string, any>[]; loadedAt: number } = {
  tenants: [],
  loadedAt: 0,
}
const TENANT_CACHE_TTL = 60_000 // 60 seconds

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getActiveTenants(payload: any): Promise<Record<string, any>[]> {
  if (Date.now() - tenantCache.loadedAt < TENANT_CACHE_TTL && tenantCache.tenants.length > 0) {
    return tenantCache.tenants
  }

  try {
    const result = await payload.find({
      collection: 'tenants',
      where: { status: { equals: 'active' } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    tenantCache = { tenants: result.docs || [], loadedAt: Date.now() }
    return tenantCache.tenants
  } catch (err) {
    console.error('[Vapi] Failed to load tenant cache:', err)
    return tenantCache.tenants // Return stale cache on error
  }
}

// ─── Main Handler ──────────────────────────────────────────────

export const vapiWebhookHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // ─── Optional webhook secret validation ─────────────────────
  // If VAPI_WEBHOOK_SECRET is set, verify the x-vapi-secret header
  // to ensure requests are actually from Vapi, not spoofed.
  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET
  if (webhookSecret) {
    const incomingSecret = (req as Request).headers.get('x-vapi-secret')
    if (incomingSecret !== webhookSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Parse request body
  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const messageType = body.message as Record<string, unknown> | undefined

  if (!messageType || !messageType.type) {
    return Response.json({ error: 'Missing message.type' }, { status: 400 })
  }

  const eventType = messageType.type as string

  try {
    switch (eventType) {
      // ─── Assistant Request — initial call setup ─────────────────
      case 'assistant-request': {
        const tenant = await resolveTenantFromDedicatedNumber(messageType, payload)
        return Response.json(await buildAssistantConfig(tenant, payload))
      }

      // ─── Function Call — Leo tool invocation via voice ──────────
      case 'function-call': {
        return await handleFunctionCall(messageType, payload)
      }

      // ─── Tool Calls — the MODERN shape for model.tools invocations ─
      // Tools declared at model.tools arrive as 'tool-calls', NOT the legacy
      // 'function-call'. Missing this case silently no-op'd every tool on a live
      // call: ask_business "couldn't pull details" and capture_lead claimed
      // success while capturing NOTHING (the fabrication failure mode).
      case 'tool-calls': {
        return await handleToolCalls(messageType, payload)
      }

      // ─── End of Call Report — log + persist to AI Bus ───────────
      case 'end-of-call-report': {
        return await handleEndOfCallReport(messageType, payload)
      }

      // ─── Conversation Update — process user speech ──────────────
      case 'conversation-update': {
        return await handleConversationUpdate(messageType, payload)
      }

      // ─── Status Update, Transcript, etc. ────────────────────────
      case 'status-update':
      case 'transcript':
      case 'speech-update':
      case 'hang':
        return Response.json({ ok: true })

      default:
        console.log(`[Vapi] Unknown event type: ${eventType}`)
        return Response.json({ ok: true })
    }
  } catch (err) {
    console.error('[Vapi Webhook] Error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Tenant Resolution ─────────────────────────────────────────

/**
 * Check if the called number matches a tenant's dedicated Vapi number.
 * This is the "premium" path — tenants with their own number skip routing.
 * Returns null if no dedicated number matches (→ platform routing mode).
 */
async function resolveTenantFromDedicatedNumber(
  message: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any> | null> {
  // Vapi puts the DIALED number at message.phoneNumber (top level) on
  // assistant-request; older/other shapes nest it under call.phoneNumber. Reading
  // only the nested one silently missed every real call — the trunk line looked
  // wired but every caller still got the "which business?" routing prompt.
  const call = message.call as Record<string, unknown> | undefined
  const topLevelPhone = message.phoneNumber as Record<string, unknown> | undefined
  const nestedPhone = call?.phoneNumber as Record<string, unknown> | undefined
  const calledNumber =
    (typeof topLevelPhone?.number === 'string' ? topLevelPhone.number : undefined) ??
    (typeof nestedPhone?.number === 'string' ? nestedPhone.number : undefined)

  if (!calledNumber) {
    console.log('[Vapi] No dialed number on payload — falling back to platform routing', {
      hasTopLevelPhone: Boolean(topLevelPhone),
      hasNestedPhone: Boolean(nestedPhone),
      messageKeys: Object.keys(message).slice(0, 12),
    })
    return null
  }

  const normalized = calledNumber.replace(/[\s-]/g, '')
  const tenants = await getActiveTenants(payload)

  for (const tenant of tenants) {
    const vapiConfig = tenant.vapi as Record<string, unknown> | undefined
    if (!vapiConfig?.enabled || !vapiConfig?.phoneNumber) continue

    const tenantPhone = String(vapiConfig.phoneNumber).replace(/[\s-]/g, '')
    if (tenantPhone === normalized) {
      return tenant
    }
  }

  return null // No dedicated number → platform routing mode
}

/**
 * Resolve tenant from the conversation content.
 *
 * Scans all user messages in the conversation for fuzzy matches against
 * active tenant names (name, branding.siteName, slug). Returns the best
 * match or null if no business was identified yet.
 *
 * This is the core of single-number routing: the caller says a business
 * name and we match it.
 */
export async function resolveTenantFromConversation(
  message: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any> | null> {
  // First check dedicated number (fast path)
  const dedicated = await resolveTenantFromDedicatedNumber(message, payload)
  if (dedicated) return dedicated

  // Scan conversation for tenant name mentions
  const conversation = message.conversation as Array<Record<string, unknown>> | undefined
  if (!conversation || conversation.length === 0) return null

  // Collect all user utterances into a single search string
  const userText = conversation
    .filter((msg) => msg.role === 'user' && msg.content)
    .map((msg) => String(msg.content))
    .join(' ')
    .toLowerCase()

  if (!userText) return null

  const tenants = await getActiveTenants(payload)
  return matchTenantByName(userText, tenants)
}

/**
 * Fuzzy-match a tenant from caller speech.
 *
 * Matching strategy (scored, best match wins):
 * 1. Exact siteName match (highest priority)
 * 2. Exact tenant name match
 * 3. Slug match (hyphens replaced with spaces)
 * 4. Partial word match (all words of tenant name appear in speech)
 *
 * Returns null if no confident match is found.
 */
export function matchTenantByName(
  speech: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenants: Record<string, any>[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> | null {
  const normalizedSpeech = speech.toLowerCase().trim()
  if (!normalizedSpeech) return null

  let bestMatch: { tenant: Record<string, unknown>; score: number; matchLen: number } | null =
    null

  for (const tenant of tenants) {
    const siteName = ((tenant.branding as Record<string, unknown>)?.siteName as string) || ''
    const tenantName = (tenant.name as string) || ''
    const slug = (tenant.slug as string) || ''

    // Skip platform tenant from matching
    if (tenant.type === 'platform') continue

    let score = 0
    let matchLen = 0

    // Exact siteName match (case-insensitive)
    if (siteName && normalizedSpeech.includes(siteName.toLowerCase())) {
      score = 100
      matchLen = siteName.length
    }
    // Exact tenant name match
    else if (tenantName && normalizedSpeech.includes(tenantName.toLowerCase())) {
      score = 90
      matchLen = tenantName.length
    }
    // Slug match (convert hyphens to spaces: "hays-cactus" → "hays cactus")
    else if (slug && normalizedSpeech.includes(slug.toLowerCase().replace(/-/g, ' '))) {
      score = 80
      matchLen = slug.length
    }
    // Partial word match: all "significant" words (3+ chars) of name appear in speech
    else {
      const nameWords = (siteName || tenantName)
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 3)
      if (nameWords.length > 0 && nameWords.every((w) => normalizedSpeech.includes(w))) {
        score = 60 + nameWords.length * 5 // More matching words = higher score
        matchLen = nameWords.join(' ').length
      }
    }

    // Prefer higher score, then longer match (more specific name wins ties)
    if (
      score > 0 &&
      (!bestMatch || score > bestMatch.score || (score === bestMatch.score && matchLen > bestMatch.matchLen))
    ) {
      bestMatch = { tenant, score, matchLen }
    }
  }

  if (bestMatch && bestMatch.score >= 60) {
    const name = (bestMatch.tenant as Record<string, unknown>).name || (bestMatch.tenant as Record<string, unknown>).slug
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return bestMatch.tenant as Record<string, any>
  }

  return null
}

/**
 * Resolve a tenant ID — tries dedicated number first, then conversation match,
 * then falls back to DEFAULT_TENANT_SLUG.
 */
async function resolveTenantId(
  message: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
): Promise<number | undefined> {
  const tenant = await resolveTenantFromConversation(message, payload)
  if (tenant?.id) return tenant.id

  // Fallback: default tenant
  try {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: process.env.DEFAULT_TENANT_SLUG || 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return tenants.docs?.[0]?.id
  } catch {
    return undefined
  }
}

/**
 * Resolve the default space for a tenant (for persisting voice messages).
 */
async function resolveDefaultSpaceId(
  tenantId: number | string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
): Promise<number | undefined> {
  try {
    const spaces = await payload.find({
      collection: 'spaces',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      sort: 'createdAt',
      overrideAccess: true,
    })
    return spaces.docs?.[0]?.id
  } catch {
    return undefined
  }
}

// ─── Assistant Config ──────────────────────────────────────────

/**
 * Returns the Vapi assistant configuration for LEO.
 *
 * Two modes:
 * - **Tenant mode** (tenant resolved from dedicated number): Tenant-specific
 *   greeting, voice, and system prompt. Caller goes straight to that business.
 * - **Platform mode** (null tenant): LEO answers as Angel OS and asks which
 *   business the caller is looking for. Once they name one, Leo routes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildAssistantConfig(
  tenant: Record<string, any> | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any,
) {
  if (tenant) {
    // ─── Tenant Mode: dedicated number or pre-resolved ──────────
    return await buildTenantAssistantConfig(tenant, payload)
  }

  // ─── Platform Mode: single-number routing ─────────────────────
  return {
    assistant: {
      name: 'LEO',
      model: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        systemPrompt: buildPlatformRoutingPrompt(),
        temperature: 0.7,
        tools: asVapiTools([ASK_BUSINESS_FUNCTION, CAPTURE_LEAD_FUNCTION]),
      },
      voice: {
        provider: '11labs',
        voiceId: 'Xb7hH8MSUJpSbSDYk0k2', // Alice — warm, confident, professional female
        stability: 0.6,
        similarityBoost: 0.8,
      },
      firstMessage:
        "Hello! I'm LEO, the AI assistant for Angel OS. Which business are you calling for today?",
      endCallMessage: 'Thank you for calling Angel OS. Have a blessed day!',
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en-US',
      },
      silenceTimeoutSeconds: 30,
      maxDurationSeconds: 600,
      endCallFunctionEnabled: true,
      recordingEnabled: true,
      // Without these the assistant has NO way to reach the platform — it told a
      // caller "I don't have details on file" because it literally could not look
      // anything up (no serverMessages subscription, no functions). ask_business
      // bridges to LEO via the function-call handler, tenant-scoped.
      serverMessages: ['function-call', 'end-of-call-report', 'status-update'],
    },
  }
}

/**
 * The one function every phone assistant gets: ask the platform about the
 * business. Routed through `function-call` → leoProcessMessage with the resolved
 * tenant, so LEO can read that tenant's own site content (query_site_content).
 */
/**
 * Vapi's CURRENT tool schema lives at `model.tools` as typed function objects.
 * The legacy top-level `assistant.functions` we shipped first is deprecated —
 * the model saw no callable tools and narrated "I don't actually have a tool
 * visible to call in this turn", then stalled until the caller hung up.
 */
function asVapiTools(
  fns: Array<{ name: string; description: string; parameters: unknown }>,
): Array<Record<string, unknown>> {
  return fns.map((f) => ({
    type: 'function',
    function: { name: f.name, description: f.description, parameters: f.parameters },
  }))
}

/**
 * Lead capture — the primary purpose of the line. Phone-first: caller ID is
 * already known, and making someone spell an email aloud is where voice leads
 * die. leadType splits the two audiences (buy from us / sell for us).
 */
const CAPTURE_LEAD_FUNCTION = {
  name: 'capture_lead',
  description:
    "Save the caller's details so the business can follow up. Call this as soon as you have a name and a way to reach them — do NOT wait until the end of the call. Prefer the phone number (confirm the one they're calling from); only take an email if they volunteer it. Set leadType to 'customer' if they want to buy/use the product, or 'opportunity' if they want to sell, distribute, partner, or work for the business.",
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: "The caller's name" },
      business: {
        type: 'string',
        description:
          "Only if the caller asked about a DIFFERENT business than the one you answered as — name it so the lead is routed to that business instead. Leave blank otherwise.",
      },
      phone: { type: 'string', description: "Callback number — confirm the number they're calling from" },
      email: { type: 'string', description: 'Only if they volunteer it — never make them spell it out' },
      leadType: {
        type: 'string',
        enum: ['customer', 'opportunity'],
        description: "'customer' = wants to buy/use it. 'opportunity' = wants to sell it / work with the business.",
      },
      message: {
        type: 'string',
        description:
          'What they need, in your words — their situation, condition or interest, timeframe, and for opportunity leads their background and territory.',
      },
    },
    required: ['name'],
  },
}

/**
 * Pull a short briefing out of the tenant's own published pages so the assistant
 * can answer "what do you do?" instantly, without a tool round-trip.
 */
async function buildBusinessBriefing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  tenantId: number,
): Promise<string> {
  try {
    const { executeToolCall } = await import('@/utilities/leo-data-tools')
    const text = await executeToolCall(
      'query_site_content',
      { search: 'about services overview what we do', limit: 3 },
      { payload, tenantId } as never,
    )
    if (typeof text !== 'string' || !text.trim()) return ''
    return text.slice(0, 3500) // rides in every assistant-request — keep it tight
  } catch {
    return ''
  }
}

const ASK_BUSINESS_FUNCTION = {
  name: 'ask_business',
  description:
    "Look up REAL information about the business — what it does, its services, products, pricing, hours, or anything published on its website. ALWAYS call this before telling a caller you don't have information. Pass the caller's question verbatim.",
  parameters: {
    type: 'object',
    properties: {
      business: {
        type: 'string',
        description: 'The business the caller named, e.g. "NeuroCare Pro"',
      },
      question: {
        type: 'string',
        description: "The caller's question, in their own words",
      },
    },
    required: ['question'],
  },
}

/**
 * Build assistant config for a specific tenant (dedicated number path).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildTenantAssistantConfig(
  tenant: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any,
) {
  const vapiConfig = tenant.vapi as Record<string, unknown> | undefined
  const tenantName =
    (tenant.branding as Record<string, unknown>)?.siteName || tenant.name || 'Angel OS'

  const voiceId = (vapiConfig?.voiceId as string) || 'Xb7hH8MSUJpSbSDYk0k2'
  // Lead with what the line can actually DO. Callers who are told their options
  // self-sort into the customer / employment branches immediately, which is what
  // makes the lead capture work — and it sets expectations so the assistant is
  // never asked for something it can't deliver.
  const greeting =
    (vapiConfig?.greeting as string) ||
    `Thanks for calling ${tenantName}. I'm LEO, the AI assistant. I can help if you're calling about the product, about employment opportunities, or if you just have general questions. What can I do for you?`

  // Pre-load a briefing from the business's own site INTO the system prompt.
  // Without this the very first "so what do you do?" costs a ~3s tool round-trip
  // — dead air on a phone call reads as stammering. The tool stays available for
  // anything deeper; this just makes the opening answer immediate.
  const briefing = payload ? await buildBusinessBriefing(payload, tenant.id as number) : ''

  return {
    assistant: {
      name: 'LEO',
      model: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        systemPrompt: buildTenantVoicePrompt(tenantName, briefing),
        temperature: 0.7,
        tools: asVapiTools([ASK_BUSINESS_FUNCTION, CAPTURE_LEAD_FUNCTION]),
      },
      voice: {
        provider: '11labs',
        voiceId,
        stability: 0.6,
        similarityBoost: 0.8,
      },
      firstMessage: greeting,
      endCallMessage: `Thank you for calling ${tenantName}. Have a blessed day!`,
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en-US',
      },
      silenceTimeoutSeconds: 30,
      maxDurationSeconds: 600,
      endCallFunctionEnabled: true,
      recordingEnabled: true,
      serverMessages: ['function-call', 'end-of-call-report', 'status-update'],
    },
  }
}

/**
 * Platform routing prompt — LEO's first job is to identify which business
 * the caller wants, then seamlessly switch to helping with that business.
 */
function buildPlatformRoutingPrompt(): string {
  return `You are LEO, the AI assistant for Angel OS — a cooperative platform hosting multiple businesses and organizations.

You're answering a shared phone line. Your FIRST job is to find out which business the caller needs.

## Routing Flow

1. Ask which business or organization they're calling for (you already asked in your greeting)
2. When they name a business, confirm it: "Great, connecting you with [business name]!"
3. Then help them with whatever they need for that business

## Guidelines

- Keep responses SHORT and conversational (1-2 sentences)
- Use natural speech patterns, not bullet points
- If the caller is unsure which business, ask what they're looking for and suggest options
- If you can't determine the business, offer general help or to connect them with a human
- Be warm, professional, and helpful

## Available Help (once business is identified)

- Checking order status and tracking
- Product information and pricing
- Booking appointments and scheduling
- General questions about the business

## Answering questions about a business — REQUIRED

Call the \`ask_business\` tool with the caller's question whenever they ask
anything about a business: what it does, its services, products, pricing, or
hours. You do NOT know these things on your own — the tool reads that business's
actual website. NEVER say you "don't have details on file" without calling
\`ask_business\` first.

## What you CANNOT do — do not offer these

You cannot transfer calls, put anyone on hold, or connect a caller to a human,
and you do not have direct phone numbers for the businesses. Never say "let me
connect you", "please hold", or "I'll get someone on the line" — you have no way
to do it, and promising it and failing is worse than saying no. If you truly
can't answer, say so plainly and offer to take a message or point them to the
business's website.

Important: You're representing a cooperative enterprise. Every interaction should reflect dignity, fairness, and genuine care for the caller.`
}

/**
 * Tenant-specific voice prompt (for dedicated number or post-routing).
 */
function buildTenantVoicePrompt(tenantName: string, briefing = ''): string {
  return `You are LEO, the AI assistant for ${tenantName} — powered by Angel OS, a cooperative platform for ethical commerce.

You're speaking on the phone. Keep responses SHORT and conversational:
- 1-2 sentences per response when possible
- Use natural speech patterns, not bullet points
- Spell out numbers and technical terms
- Be warm, professional, and helpful
- Never read out URLs, slugs, or markdown — you are being SPOKEN aloud
${
  briefing
    ? `
## What ${tenantName} does — you already know this

Use this to answer overview questions IMMEDIATELY and confidently. Do not call a
tool just to answer "what do you do?" — summarize from here in 2-3 spoken
sentences, then invite their question.

${briefing}
`
    : ''
}
## YOUR PRIMARY JOB: capture the lead

Every caller should end up as a captured lead. Get a name and a callback number
early and naturally — "Who am I speaking with?" then "Is this the best number to
reach you on?" — and call \`capture_lead\` AS SOON AS you have both. Don't save it
for the end; calls drop.

Early on, find out which kind of caller this is:

**Customer** (wants to buy or use it) — find out what they're hoping it helps
with, whether they've tried anything similar, and their timeframe. Then
\`capture_lead\` with leadType "customer".

**Opportunity** (wants to sell it, distribute, partner, or work with ${tenantName})
— find out their background, whether they've sold in this space, and their area.
Then \`capture_lead\` with leadType "opportunity".

If it's unclear, just ask: "Are you calling as a customer, or about the business
opportunity?" Ask ONE question at a time and let them answer — this is a
conversation, not a form.

## Answering questions

For anything beyond the overview above — specific pricing, products, details —
call \`ask_business\` with their question. It reads ${tenantName}'s actual website.
Never claim you lack information without calling it first.

## If they're calling about a different business

You answer as ${tenantName} by default — lead with that. But this line runs on
Angel OS, which hosts other businesses too. If a caller names a DIFFERENT
business, don't turn them away: pass that name as the \`business\` argument to
\`ask_business\` (and to \`capture_lead\` if you take their details) and you'll be
answering for that business instead. Don't advertise this — just handle it
gracefully if it comes up.

## What you CANNOT do

You cannot transfer calls, place anyone on hold, or connect them to a human, and
you have no direct numbers to give out. Never offer any of it. If you can't
answer, say so plainly, take their details with \`capture_lead\`, and promise a
callback from the team — that you CAN deliver.

Important: You're representing a cooperative enterprise. Every interaction should reflect dignity, fairness, and genuine care for the caller.`
}

// ─── Function Call Handler ──────────────────────────────────────

/**
 * Shared executor for a single voice tool invocation — used by BOTH the legacy
 * 'function-call' event and the modern 'tool-calls' event.
 */
async function executeVoiceFunction(
  functionName: string,
  parameters: Record<string, unknown>,
  message: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
): Promise<string> {
  // Caller ID — so a voice lead never dies for want of a contact method the
  // caller would otherwise have to spell out.
  const call = message.call as Record<string, unknown> | undefined
  const customer = (call?.customer ?? message.customer) as Record<string, unknown> | undefined
  const callerNumber = typeof customer?.number === 'string' ? customer.number : ''
  if (functionName === 'capture_lead' && !parameters.phone && callerNumber) {
    parameters.phone = callerNumber
  }

  const userMessage = buildToolMessage(functionName, parameters)

  // A tool payload usually carries NO `conversation` array, so resolveTenantId
  // would fall through to the DEFAULT (platform) tenant and LEO would search
  // the wrong business. Prefer the business the assistant heard, then the
  // dialed number's tenant (trunk line), then the conversation/default path.
  let tenantId: number | undefined
  const businessParam = typeof parameters.business === 'string' ? parameters.business : ''
  if (businessParam.trim()) {
    const tenants = await getActiveTenants(payload)
    const matched = matchTenantByName(businessParam.toLowerCase(), tenants)
    if (matched?.id) tenantId = matched.id as number
  }
  if (!tenantId) {
    const dialed = await resolveTenantFromDedicatedNumber(message, payload)
    if (dialed?.id) tenantId = dialed.id as number
  }
  if (!tenantId) tenantId = await resolveTenantId(message, payload)

  const result = await leoProcessMessage({
    message: userMessage,
    tenantId,
    payload,
    userContext: {
      id: 'vapi-caller',
      name: 'Phone Caller',
      roles: ['customer'],
    },
  })
  return result.text
}

/**
 * Modern tool invocation event ('tool-calls') — one event can carry SEVERAL
 * calls; Vapi expects { results: [{ toolCallId, result }] } back.
 */
async function handleToolCalls(
  message: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (message.toolCallList ?? message.toolCalls ?? []) as Array<Record<string, any>>
  if (!Array.isArray(list) || list.length === 0) {
    return Response.json({ results: [] })
  }

  const results: Array<{ toolCallId: string; result: string }> = []
  for (const tc of list) {
    const fn = (tc.function ?? tc) as Record<string, unknown>
    const name = String(fn.name ?? tc.name ?? '')
    let args: Record<string, unknown> = {}
    const rawArgs = fn.arguments ?? fn.parameters ?? tc.arguments ?? {}
    if (typeof rawArgs === 'string') {
      try {
        args = JSON.parse(rawArgs) as Record<string, unknown>
      } catch {
        args = {}
      }
    } else if (rawArgs && typeof rawArgs === 'object') {
      args = rawArgs as Record<string, unknown>
    }
    const toolCallId = String(tc.id ?? tc.toolCallId ?? '')
    try {
      const text = await executeVoiceFunction(name, args, message, payload)
      results.push({ toolCallId, result: text })
    } catch (err) {
      console.error('[Vapi] tool-calls error for', name, err)
      results.push({ toolCallId, result: "I'm sorry, I had trouble with that. Could you try again?" })
    }
  }
  return Response.json({ results })
}

async function handleFunctionCall(
  message: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const functionCall = message.functionCall as Record<string, unknown> | undefined

  if (!functionCall) {
    return Response.json({ result: 'No function call provided.' })
  }

  const functionName = functionCall.name as string
  const parameters = (functionCall.parameters as Record<string, unknown>) || {}

  try {
    const text = await executeVoiceFunction(functionName, parameters, message, payload)
    return Response.json({ result: text })
  } catch (err) {
    console.error('[Vapi] Function call error:', err)
    return Response.json({
      result: "I'm sorry, I had trouble with that. Could you try again?",
    })
  }
}

/**
 * Convert a Vapi function call into a natural language message for Leo.
 */
function buildToolMessage(functionName: string, params: Record<string, unknown>): string {
  switch (functionName) {
    case 'capture_lead':
      // Explicit instruction — this is the money path; don't let LEO improvise it.
      return `Call the capture_lead tool now with exactly these values: name="${params.name ?? ''}", phone="${params.phone ?? ''}", email="${params.email ?? ''}", leadType="${params.leadType ?? 'customer'}", message="${String(params.message ?? '').replace(/"/g, "'")}". This came in over the phone. After it succeeds, reply with one short spoken sentence confirming someone will follow up — do not read back the details.`
    case 'ask_business':
      // Pass the caller's question through verbatim and point LEO at the site
      // content tool — this is the "what does this business do?" path.
      return `A caller on the phone asks: "${params.question}". Use query_site_content to read this business's own website pages and answer from what's actually published there. Answer in 1-3 short spoken sentences. If the site genuinely doesn't cover it, say so plainly — do NOT promise to transfer or call back.`
    case 'check_order_status':
      return `Check the status of order ${params.orderId || 'the order'}`
    case 'search_products':
      return `Search for products: ${params.query || params.category || 'all products'}`
    case 'book_appointment':
      return `Book an appointment${params.date ? ` for ${params.date}` : ''}${params.service ? ` for ${params.service}` : ''}`
    case 'get_business_hours':
      return 'What are the business hours?'
    case 'transfer_to_human':
      return 'The caller wants to speak with a human team member.'
    default:
      return `Execute ${functionName} with parameters: ${JSON.stringify(params)}`
  }
}

// ─── Conversation Update Handler ────────────────────────────────

async function handleConversationUpdate(
  message: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const conversation = message.conversation as Array<Record<string, unknown>> | undefined

  if (!conversation || conversation.length === 0) {
    return Response.json({ ok: true })
  }

  // Get the latest user message
  const lastMessage = conversation[conversation.length - 1]
  if (lastMessage?.role !== 'user' || !lastMessage.content) {
    return Response.json({ ok: true })
  }

  // Resolve tenant from conversation context (single-number routing)
  const tenant = await resolveTenantFromConversation(message, payload)
  const tenantId = tenant?.id

  // If no tenant yet, the caller hasn't named a business — let Vapi/Leo
  // handle the routing conversation natively (the system prompt guides this)
  if (!tenantId) {
    return Response.json({ ok: true })
  }

  // Process through Leo with resolved tenant context
  try {
    const result = await leoProcessMessage({
      message: String(lastMessage.content),
      tenantId,
      payload,
      userContext: {
        id: 'vapi-caller',
        name: 'Phone Caller',
        roles: ['customer'],
      },
    })

    // Persist the caller message + Leo response to AI Bus
    const spaceId = await resolveDefaultSpaceId(tenantId, payload)
    if (spaceId) {
      await persistVoiceMessage({
        payload,
        tenantId,
        spaceId,
        text: String(lastMessage.content),
        role: 'caller',
        callId: (message.call as Record<string, unknown>)?.id as string | undefined,
      })

      await persistVoiceMessage({
        payload,
        tenantId,
        spaceId,
        text: result.text,
        role: 'assistant',
        callId: (message.call as Record<string, unknown>)?.id as string | undefined,
      })
    }

    return Response.json({
      assistant: {
        content: result.text,
      },
    })
  } catch (err) {
    console.error('[Vapi] Conversation update error:', err)
    return Response.json({ ok: true })
  }
}

// ─── End of Call Report ─────────────────────────────────────────

async function handleEndOfCallReport(
  message: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) {
  const report = message as Record<string, unknown>
  const endedReason = report.endedReason as string | undefined
  const summary = report.summary as string | undefined
  const recordingUrl = report.recordingUrl as string | undefined
  const callId = (report.call as Record<string, unknown>)?.id as string | undefined

  console.log('[Vapi] Call ended:', {
    reason: endedReason,
    summary,
    recordingUrl,
    callId,
  })

  // Try to resolve tenant from the report (may have conversation data)
  const tenantId = await resolveTenantId(message, payload)

  if (tenantId) {
    const spaceId = await resolveDefaultSpaceId(tenantId, payload)
    if (spaceId) {
      const summaryText = summary
        ? `📞 Voice call ended — ${endedReason || 'completed'}. Summary: ${summary}`
        : `📞 Voice call ended — ${endedReason || 'completed'}`

      await persistVoiceMessage({
        payload,
        tenantId,
        spaceId,
        text: summaryText,
        role: 'system',
        callId,
        recordingUrl,
        endedReason,
        messageType: 'system',
      })
    }
  }

  return Response.json({ ok: true })
}

// ─── AI Bus Persistence ────────────────────────────────────────

/**
 * Persist a voice call message to the AI Bus (Messages collection).
 * Makes voice interactions visible alongside chat, email, and other channels.
 */
async function persistVoiceMessage({
  payload,
  tenantId,
  spaceId,
  text,
  role,
  callId,
  callerPhone,
  recordingUrl,
  endedReason,
  messageType = 'voice_call',
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
  tenantId: number | string
  spaceId: number | string
  text: string
  role: 'caller' | 'assistant' | 'system'
  callId?: string
  callerPhone?: string
  recordingUrl?: string
  endedReason?: string
  messageType?: string
}) {
  try {
    const content = createVoiceCallContent(text, {
      role,
      callId,
      callerPhone,
      recordingUrl,
      endedReason,
    })

    await payload.create({
      collection: 'messages',
      data: {
        space: spaceId,
        channel: VOICE_CHANNEL,
        content,
        messageType,
        visibility: 'tenant',
        tenant: tenantId,
        metadata: {
          source: 'vapi',
          callId,
          role,
        },
      },
      overrideAccess: true,
    })
  } catch (err) {
    // Non-critical: don't fail the Vapi response if persistence fails
    console.error('[Vapi] Failed to persist voice message to AI Bus:', err)
  }
}
