/**
 * AI Gateway — Smart Multi-Model Router via Vercel AI Gateway
 *
 * Routes LLM calls through Vercel AI Gateway, enabling access to 100+ models
 * (Anthropic Claude, Google Gemini, OpenAI, etc.) via a single API key.
 *
 * Features:
 *  - Task-based model tiering (match model cost to task complexity)
 *  - Credit-aware automatic downshifting when balance is low
 *  - Gateway-native fallback chains (no manual try/catch needed)
 *  - Per-request usage tracking (tenant + user tagging)
 *  - Per-tenant BYOAI keys with fallback to platform gateway key
 *
 * @see https://vercel.com/docs/ai-gateway
 */

import { createGateway } from '@ai-sdk/gateway'
import { tool as aiTool, jsonSchema } from 'ai'
import type { LanguageModel, ToolSet } from 'ai'
import type Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Supported model families and their gateway IDs
// ---------------------------------------------------------------------------

export const MODEL_CATALOG = {
  // Anthropic Claude (updated to latest 4.6 generation)
  'claude-sonnet': 'anthropic/claude-sonnet-4-6',
  'claude-opus': 'anthropic/claude-opus-4-6',
  'claude-haiku': 'anthropic/claude-haiku-4-5-20251001',

  // Google Gemini
  'gemini-pro': 'google/gemini-3.1-pro',
  'gemini-flash': 'google/gemini-2.5-flash',

  // OpenAI
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4o-mini': 'openai/gpt-4o-mini',
} as const

export type ModelAlias = keyof typeof MODEL_CATALOG

/** Default model — Gemini Flash (6x cheaper than Sonnet, capable for 90% of tasks) */
export const DEFAULT_MODEL = 'google/gemini-2.5-flash'

/** Fallback model when primary is unavailable */
export const FALLBACK_MODEL = 'anthropic/claude-sonnet-4-6'

// ---------------------------------------------------------------------------
// Task-Based Model Tiers — "Models as Commodities"
// ---------------------------------------------------------------------------

/**
 * Task complexity levels — LEO selects the appropriate tier based on
 * the nature of each request, routing to the cheapest capable model.
 *
 * Estimated cost per interaction (2K tokens in / 1.5K out):
 *  - low:      ~$0.005  (Gemini Flash)
 *  - medium:   ~$0.005  (Gemini Flash → Pro fallback)
 *  - high:     ~$0.022  (Gemini Pro → Sonnet fallback)
 *  - critical: ~$0.028  (Sonnet → Opus fallback)
 */
export type TaskComplexity = 'low' | 'medium' | 'high' | 'critical'

export const TASK_MODEL_MAP: Record<TaskComplexity, {
  primary: string
  fallbacks: string[]
}> = {
  /** Greetings, FAQ, simple tool calls, status checks */
  low: {
    primary: 'google/gemini-2.5-flash',
    fallbacks: ['google/gemini-3.1-pro'],
  },
  /** Product queries, booking workflows, standard chat, tool orchestration */
  medium: {
    primary: 'google/gemini-2.5-flash',
    fallbacks: ['google/gemini-3.1-pro', 'anthropic/claude-sonnet-4-6'],
  },
  /** Complex reasoning, multi-step analysis, enterprise reports */
  high: {
    primary: 'google/gemini-3.1-pro',
    fallbacks: ['anthropic/claude-sonnet-4-6'],
  },
  /** Board-level strategy, nuanced creative work, critical decisions */
  critical: {
    primary: 'anthropic/claude-sonnet-4-6',
    fallbacks: ['anthropic/claude-opus-4-6', 'google/gemini-3.1-pro'],
  },
}

// ---------------------------------------------------------------------------
// Credit Balance Monitoring
// ---------------------------------------------------------------------------

export interface CreditSnapshot {
  balance: number
  totalUsed: number
  checkedAt: number
}

let _creditCache: CreditSnapshot | null = null
const CREDIT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Checks the current AI Gateway credit balance.
 * Results are cached for 5 minutes to avoid excessive API calls.
 */
export async function checkCredits(): Promise<CreditSnapshot | null> {
  if (_creditCache && Date.now() - _creditCache.checkedAt < CREDIT_CACHE_TTL) {
    return _creditCache
  }

  const apiKey = resolveGatewayKey()
  if (!apiKey) return null

  try {
    const provider = createGateway({ apiKey })
    const credits = await provider.getCredits()
    _creditCache = {
      balance: parseFloat(credits.balance),
      totalUsed: parseFloat(credits.totalUsed),
      checkedAt: Date.now(),
    }
    return _creditCache
  } catch (err) {
    console.warn('[AI Gateway] Failed to check credits:', err instanceof Error ? err.message : err)
    return _creditCache
  }
}

/** Invalidates the credit cache (call after top-up or significant usage). */
export function invalidateCreditCache(): void {
  _creditCache = null
}

// ---------------------------------------------------------------------------
// Credit-Aware Model Selection
// ---------------------------------------------------------------------------

const CREDIT_THRESHOLD_CRITICAL = 2
const CREDIT_THRESHOLD_LOW = 10
const CREDIT_THRESHOLD_WARN = 25

/**
 * Applies credit-based downshifting to task complexity.
 * When credits are low, automatically shifts to cheaper model tiers.
 */
export function applyCreditPressure(
  requested: TaskComplexity,
  credits: CreditSnapshot | null,
): TaskComplexity {
  if (!credits) return requested

  if (credits.balance < CREDIT_THRESHOLD_CRITICAL) {
    if (requested !== 'low') {
      console.warn(`[AI Gateway] Credits critical ($${credits.balance.toFixed(2)}) — forcing budget models`)
    }
    return 'low'
  }

  if (credits.balance < CREDIT_THRESHOLD_LOW) {
    const downshift: Record<TaskComplexity, TaskComplexity> = {
      critical: 'high',
      high: 'medium',
      medium: 'low',
      low: 'low',
    }
    const effective = downshift[requested]
    if (effective !== requested) {
      console.warn(`[AI Gateway] Credits low ($${credits.balance.toFixed(2)}) — downshifting ${requested}→${effective}`)
    }
    return effective
  }

  if (credits.balance < CREDIT_THRESHOLD_WARN) {
    console.info(`[AI Gateway] Credit balance: $${credits.balance.toFixed(2)} — monitor usage`)
  }

  return requested
}

// ---------------------------------------------------------------------------
// Smart Model Factory
// ---------------------------------------------------------------------------

export interface SmartModelResult {
  model: LanguageModel
  /** Pass directly to generateText/streamText providerOptions */
  providerOptions: Record<string, any>
  modelId: string
  complexity: TaskComplexity
  effectiveComplexity: TaskComplexity
}

/**
 * Returns a model + providerOptions pre-configured for the given task complexity.
 * Includes gateway-native fallback chains, credit-aware downshifting, and
 * per-request tracking tags.
 *
 * Usage:
 *   const smart = await getSmartModel('medium', { tenantId: 5, userId: 12 })
 *   const result = await generateText({ model: smart.model, providerOptions: smart.providerOptions, ... })
 *
 * The gateway handles fallback internally — no need for manual try/catch.
 */
export async function getSmartModel(
  complexity: TaskComplexity = 'medium',
  tracking?: { tenantId?: number; userId?: number; tags?: string[] },
): Promise<SmartModelResult | null> {
  const apiKey = resolveGatewayKey()
  if (!apiKey) {
    console.warn('[AI Gateway] AI_GATEWAY_API_KEY not set — gateway unavailable')
    return null
  }

  const credits = await checkCredits()
  const effectiveComplexity = applyCreditPressure(complexity, credits)
  const config = TASK_MODEL_MAP[effectiveComplexity]

  const provider = createGateway({ apiKey })
  const model = provider.languageModel(config.primary)

  // Build gateway provider options for native fallback + tracking
  const gatewayOpts: Record<string, unknown> = {
    models: config.fallbacks,
  }

  if (tracking?.tenantId || tracking?.userId) {
    gatewayOpts.user = `t${tracking.tenantId || 0}-u${tracking.userId || 0}`
  }
  const tags = [...(tracking?.tags || []), `tier-${effectiveComplexity}`]
  gatewayOpts.tags = tags

  return {
    model,
    providerOptions: { gateway: gatewayOpts },
    modelId: config.primary,
    complexity,
    effectiveComplexity,
  }
}

/**
 * Returns the model tier info for a given complexity (without creating a model).
 */
export function getModelTierInfo(complexity: TaskComplexity): {
  primary: string
  fallbacks: string[]
} {
  return TASK_MODEL_MAP[complexity]
}

// ---------------------------------------------------------------------------
// Env helper — reads AI_GATEWAY_API_KEY from .env.local/.env
// (Same pattern as ConversationEngine for consistency)
// ---------------------------------------------------------------------------

let _gatewayKeyCache: string | undefined

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

function resolveGatewayKey(): string | undefined {
  const envVal = process.env.AI_GATEWAY_API_KEY
  if (envVal) return envVal
  if (_gatewayKeyCache) return _gatewayKeyCache

  try {
    for (const file of ['.env.local', '.env']) {
      const envPath = path.resolve(process.cwd(), file)
      if (fs.existsSync(envPath)) {
        const parsed = parseEnvFile(fs.readFileSync(envPath))
        if (parsed.AI_GATEWAY_API_KEY) {
          _gatewayKeyCache = parsed.AI_GATEWAY_API_KEY
          return _gatewayKeyCache
        }
      }
    }
  } catch {
    // Non-critical
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a model identifier to a full gateway model ID.
 *
 * Accepts:
 *  - Full gateway ID: "anthropic/claude-sonnet-4-20250514"
 *  - Alias: "claude-sonnet", "gemini-pro"
 *  - Env override: reads LLM_MODEL from process.env
 */
export function resolveModelId(modelId?: string): string {
  const raw = modelId || process.env.LLM_MODEL || DEFAULT_MODEL

  // Check if it's an alias
  if (raw in MODEL_CATALOG) {
    return MODEL_CATALOG[raw as ModelAlias]
  }

  // Already a full gateway ID (contains a slash)
  if (raw.includes('/')) {
    return raw
  }

  // Fallback — return as-is, the gateway will validate
  return raw
}

// ---------------------------------------------------------------------------
// Gateway model factory (legacy — backwards compatible)
// ---------------------------------------------------------------------------

/**
 * Creates an AI SDK LanguageModel routed through Vercel AI Gateway.
 *
 * For new code, prefer `getSmartModel()` which includes credit-aware
 * routing and gateway-native fallback chains.
 *
 * Falls back to null if no gateway key is configured.
 */
export function getModel(modelId?: string): LanguageModel | null {
  const apiKey = resolveGatewayKey()
  if (!apiKey) {
    console.warn('[AI Gateway] AI_GATEWAY_API_KEY not set — gateway unavailable')
    return null
  }

  const resolvedId = resolveModelId(modelId)
  const provider = createGateway({ apiKey })
  return provider.languageModel(resolvedId)
}

/**
 * Returns a fallback model (Claude Sonnet 4.6) for when the primary model errors.
 * @deprecated Prefer `getSmartModel()` which uses gateway-native fallback chains.
 * @see MODEL_CATALOG for current model IDs
 */
export function getFallbackModel(): LanguageModel | null {
  const apiKey = resolveGatewayKey()
  if (!apiKey) return null
  const provider = createGateway({ apiKey })
  return provider.languageModel(FALLBACK_MODEL)
}

/**
 * Returns true if the AI Gateway is configured and available.
 */
export function isGatewayAvailable(): boolean {
  return Boolean(resolveGatewayKey())
}

/**
 * Returns the configured model ID (resolved from env or default).
 */
export function getConfiguredModelId(): string {
  return resolveModelId()
}

// ---------------------------------------------------------------------------
// Image model factory
// ---------------------------------------------------------------------------

/** Image models available through the AI Gateway */
export const IMAGE_MODEL_CATALOG = {
  'gemini-flash-image': 'google/gemini-2.5-flash',
  'gemini-pro-image': 'google/gemini-3.1-pro',
  'gpt-image': 'openai/gpt-5-image',
  'gpt-image-mini': 'openai/gpt-5-image-mini',
} as const

export type ImageModelAlias = keyof typeof IMAGE_MODEL_CATALOG

/** Default image model */
export const DEFAULT_IMAGE_MODEL = 'google/gemini-2.5-flash'

/**
 * Creates an AI SDK ImageModel routed through Vercel AI Gateway.
 * Returns null if no gateway key is configured.
 */
export function getImageModel(
  modelId?: string,
): ReturnType<ReturnType<typeof createGateway>['imageModel']> | null {
  const apiKey = resolveGatewayKey()
  if (!apiKey) return null

  const resolvedId =
    modelId && modelId in IMAGE_MODEL_CATALOG
      ? IMAGE_MODEL_CATALOG[modelId as ImageModelAlias]
      : modelId || DEFAULT_IMAGE_MODEL

  const provider = createGateway({ apiKey })
  return provider.imageModel(resolvedId)
}

// ---------------------------------------------------------------------------
// Tool converter — Anthropic format → AI SDK format
// ---------------------------------------------------------------------------

/**
 * Converts Anthropic-format tool definitions to AI SDK ToolSet format.
 * Binds each tool's execute function to the provided dispatcher + context.
 */
export function convertToolsForAISDK(
  anthropicTools: Anthropic.Tool[],
  executor: (name: string, input: Record<string, unknown>, ctx: any) => Promise<string>,
  ctx: unknown,
): ToolSet {
  const result: ToolSet = {}
  for (const t of anthropicTools) {
    result[t.name] = aiTool({
      description: t.description,
      parameters: jsonSchema(t.input_schema as Parameters<typeof jsonSchema>[0]),
      execute: async (params: any): Promise<string> => {
        return executor(t.name, params as Record<string, unknown>, ctx)
      },
    } as any)
  }
  return result
}
