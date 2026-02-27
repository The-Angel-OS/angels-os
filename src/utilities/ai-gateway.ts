/**
 * AI Gateway — Multi-Model Provider via Vercel AI Gateway
 *
 * Routes LLM calls through Vercel AI Gateway, enabling access to 100+ models
 * (Anthropic Claude, Google Gemini, OpenAI, etc.) via a single API key.
 *
 * Supports per-tenant BYOAI keys with fallback to platform gateway key.
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
  // Anthropic Claude
  'claude-sonnet': 'anthropic/claude-sonnet-4-20250514',
  'claude-opus': 'anthropic/claude-opus-4-20250514',
  'claude-haiku': 'anthropic/claude-haiku-4-5-20251001',

  // Google Gemini
  'gemini-pro': 'google/gemini-3.1-pro',
  'gemini-flash': 'google/gemini-2.5-flash',

  // OpenAI
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4o-mini': 'openai/gpt-4o-mini',
} as const

export type ModelAlias = keyof typeof MODEL_CATALOG

/** Default model — Gemini 3.1 Pro (7x cheaper than Opus, 30% cheaper than Sonnet) */
export const DEFAULT_MODEL = 'google/gemini-3.1-pro'

/** Fallback model when Gemini is unavailable */
export const FALLBACK_MODEL = 'anthropic/claude-sonnet-4-20250514'

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
// Gateway model factory
// ---------------------------------------------------------------------------

/**
 * Creates an AI SDK LanguageModel routed through Vercel AI Gateway.
 *
 * Usage:
 *   import { getModel } from '@/utilities/ai-gateway'
 *   const model = getModel('gemini-pro')
 *   const { text } = await generateText({ model, prompt: '...' })
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
 * Use in try/catch blocks around generateText/streamText calls.
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
