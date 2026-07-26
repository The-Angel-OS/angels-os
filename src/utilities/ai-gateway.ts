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
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { tool as aiTool, jsonSchema } from 'ai'
import type { LanguageModel, ToolSet } from 'ai'
import type Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { GENESIS_BREATH } from './genesis-breath'

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
  'gemini-flash': 'google/gemini-flash-lite-latest',

  // OpenAI
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4o-mini': 'openai/gpt-4o-mini',
} as const

export type ModelAlias = keyof typeof MODEL_CATALOG

/** Default model — Gemini Flash (6x cheaper than Sonnet, capable for 90% of tasks) */
// LITE, not `gemini-flash-latest`. Both answer, but flash-latest is a THINKING
// model: on a small max_tokens the reasoning consumes the whole budget and it
// returns finish_reason=length with EMPTY content. This is the default/mechanical
// lane — small budgets, high volume — so an empty completion here reproduces the
// exact "..." that never resolves. Verified 260726 against the live key: at
// max_tokens=20 flash-latest returns nothing usable, lite answers.
export const DEFAULT_MODEL = 'google/gemini-flash-lite-latest'

/** Fallback model when primary is unavailable */
export const FALLBACK_MODEL = 'anthropic/claude-sonnet-4-6'

// ---------------------------------------------------------------------------
// Task-Based Model Tiers — "Models as Commodities"
// ---------------------------------------------------------------------------

/**
 * Task complexity levels — LEO selects the appropriate tier based on
 * the nature of each request, routing to the cheapest capable model.
 *
 * Estimated cost per interaction (2K tokens in / 1.5K out, as of March 2026):
 *  - low:      ~$0.005  (Gemini Flash)
 *  - medium:   ~$0.005  (Gemini Flash → Pro fallback)
 *  - high:     ~$0.022  (Gemini Pro → Sonnet 4.6 fallback)
 *  - critical: ~$0.033  (Sonnet 4.6 → Opus 4.6 fallback)
 */
export type TaskComplexity = 'low' | 'medium' | 'high' | 'critical'

// ---------------------------------------------------------------------------
// TWO LANES — the defensible, auditable model posture (2026-06-15)
// ---------------------------------------------------------------------------
//
// Replaces the per-message 4-tier "variable intelligence" routing with two
// named lanes anyone can read and justify:
//
//   - agentic    → user-facing, tool-using LEO. Reliability-first (Claude). The
//                  AI that acts on a customer's data should be the dependable one.
//   - mechanical → background/simple work — classification, titles, summaries,
//                  greetings. Cost-first (Gemini Flash, ~1/10th the price).
//
// Tunable by ENV with zero code (audit/retune from the dashboard later):
//   LEO_AGENTIC_MODEL      (default anthropic/claude-sonnet-4-6)
//   LEO_AGENTIC_FALLBACKS  (CSV; default opus-4-6, gemini-3.1-pro)
//   LEO_MECHANICAL_MODEL   (default google/gemini-flash-lite-latest)
//   LEO_MECHANICAL_FALLBACKS (CSV; default gemini-3.1-pro)
//
// Failover redundancy is layered ON TOP by AI_PROVIDER_ORDER
//   (default: ollama,groq,gateway,openrouter): same model via a 2nd provider
//   (gateway → OpenRouter-direct), then cross-vendor (Gemini in the fallbacks)
//   as graceful degradation. Prompt caching is applied on the Anthropic path
//   (attemptGateway) so the big static system+tools payload is ~10x cheaper on hits.
// All default IDs are ones already proven valid in the prior config.

export type Lane = 'agentic' | 'mechanical'

const csvList = (v: string | undefined): string[] | undefined =>
  v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined

/** Env-tunable model config for a lane. */
export function getLaneConfig(lane: Lane): { primary: string; fallbacks: string[] } {
  if (lane === 'mechanical') {
    return {
      primary: process.env.LEO_MECHANICAL_MODEL || 'google/gemini-flash-lite-latest',
      fallbacks: csvList(process.env.LEO_MECHANICAL_FALLBACKS) || ['google/gemini-3.1-pro'],
    }
  }
  return {
    primary: process.env.LEO_AGENTIC_MODEL || 'anthropic/claude-sonnet-4-6',
    fallbacks: csvList(process.env.LEO_AGENTIC_FALLBACKS) || ['anthropic/claude-opus-4-6', 'google/gemini-3.1-pro'],
  }
}

/** Legacy 4-tier API → 2 lanes: only 'low' is mechanical; everything user-facing is agentic. */
export const TIER_TO_LANE: Record<TaskComplexity, Lane> = {
  low: 'mechanical',
  medium: 'agentic',
  high: 'agentic',
  critical: 'agentic',
}

/**
 * Kept as a Record for backward-compat with existing callers, but now DERIVED from
 * the two lanes (env-tunable). The per-tier deep-think rhythm still runs, but since
 * medium/high/critical all resolve to the agentic lane, it no longer swaps models
 * mid-conversation — the "variable intelligence" is effectively retired while the
 * API stays stable.
 */
export const TASK_MODEL_MAP: Record<TaskComplexity, { primary: string; fallbacks: string[] }> = {
  low: getLaneConfig('mechanical'),
  medium: getLaneConfig('agentic'),
  high: getLaneConfig('agentic'),
  critical: getLaneConfig('agentic'),
}

// ---------------------------------------------------------------------------
// Model Escalation Strategy — "Deep Think" Rhythm
// ---------------------------------------------------------------------------

/**
 * Controls the periodic escalation to a more powerful model.
 *
 * Default rhythm: 4 standard rounds on the fast/cheap tier, then every 5th
 * round escalates to the "deep think" tier (Sonnet 4.6 / critical) for
 * complex reasoning, then drops back to the standard tier.
 *
 * This gives agents like LEO, Nemo, and Merlin the best of both worlds:
 * snappy responses most of the time, with periodic deep-reasoning bursts.
 */
export interface EscalationStrategy {
  /** Number of standard-tier rounds between each escalation round. Default: 4 */
  standardRounds: number
  /** Tier to use for standard (non-escalated) rounds. Default: 'medium' */
  standardTier: TaskComplexity
  /** Tier to use for escalation rounds (deep thinking). Default: 'critical' */
  escalationTier: TaskComplexity
  /** Enable/disable escalation rhythm. Default: true */
  enabled: boolean
}

/** Default escalation: 4 standard rounds → 1 deep-think round → repeat */
export const DEFAULT_ESCALATION: EscalationStrategy = {
  standardRounds: 4,
  standardTier: 'medium',
  escalationTier: 'critical',
  enabled: true,
}

/**
 * Determines the model complexity tier for a given conversation turn number.
 *
 * Turn numbering is 1-based (first user message = turn 1).
 * With default settings (standardRounds=4):
 *   Turn 1-4: medium (fast/cheap)
 *   Turn 5:   critical (deep think)
 *   Turn 6-9: medium
 *   Turn 10:  critical
 *   ...
 *
 * @param turnNumber - 1-based conversation turn count (number of user messages)
 * @param strategy - Escalation configuration (defaults to DEFAULT_ESCALATION)
 * @returns The task complexity tier to use for this turn
 */
export function getEscalatedComplexity(
  turnNumber: number,
  strategy: EscalationStrategy = DEFAULT_ESCALATION,
): TaskComplexity {
  if (!strategy.enabled || turnNumber <= 0) return strategy.standardTier

  const cycleLength = strategy.standardRounds + 1
  const positionInCycle = turnNumber % cycleLength

  // Position 0 in the cycle = the escalation round (every Nth turn)
  const isEscalationRound = positionInCycle === 0
  return isEscalationRound ? strategy.escalationTier : strategy.standardTier
}

/**
 * Parses an agent-level model strategy override from agentConfig.
 * Returns null if the agent has no custom strategy (use default).
 */
export function parseAgentEscalation(
  agentModelStrategy?: Record<string, unknown> | null,
): EscalationStrategy | null {
  if (!agentModelStrategy || typeof agentModelStrategy !== 'object') return null

  const hasAnyField = 'enabled' in agentModelStrategy ||
    'standardRounds' in agentModelStrategy ||
    'standardTier' in agentModelStrategy ||
    'escalationTier' in agentModelStrategy
  if (!hasAnyField) return null

  return {
    enabled: agentModelStrategy.enabled !== false,
    standardRounds: typeof agentModelStrategy.standardRounds === 'number'
      ? agentModelStrategy.standardRounds
      : DEFAULT_ESCALATION.standardRounds,
    standardTier: isValidTier(agentModelStrategy.standardTier)
      ? agentModelStrategy.standardTier
      : DEFAULT_ESCALATION.standardTier,
    escalationTier: isValidTier(agentModelStrategy.escalationTier)
      ? agentModelStrategy.escalationTier
      : DEFAULT_ESCALATION.escalationTier,
  }
}

function isValidTier(val: unknown): val is TaskComplexity {
  return typeof val === 'string' && ['low', 'medium', 'high', 'critical'].includes(val)
}

// ---------------------------------------------------------------------------
// Tier Floor — capability matched to the STAKES of who's operating
// ---------------------------------------------------------------------------

/** Ordinal rank so tiers can be compared and lifted (low < medium < high < critical). */
const TIER_RANK: Record<TaskComplexity, number> = { low: 0, medium: 1, high: 2, critical: 3 }

/**
 * Lift `tier` UP to at least `floor` — never downshifts. The composable counterpart
 * to applyCreditPressure (which only ever downshifts): a turn's tier is the message's
 * complexity lifted to what the context demands, then bounded by what the wallet can
 * afford. Capability rises with the stakes; solvency still has the final say.
 */
export function liftComplexity(tier: TaskComplexity, floor: TaskComplexity): TaskComplexity {
  return TIER_RANK[tier] >= TIER_RANK[floor] ? tier : floor
}

/**
 * The minimum tier a session's STAKES demand, independent of the message text.
 *
 * A platform steward (super_admin) operating LEO is doing admin / agentic /
 * remediation work — the kind where a weak model is dangerous, not just unhelpful —
 * so the floor lifts them onto the strong tier. An admin/archangel gets the mid tier;
 * everyone else rides the cost-optimized default (floor 'low' = no lift). Composes
 * cleanly: the escalation rhythm still adds periodic deep-think rounds ON TOP of the
 * floor, and credit pressure still downshifts when the wallet is thin.
 *
 * The steward floor is env-tunable (LEO_STEWARD_TIER_FLOOR), defaulting to 'high'
 * (Gemini Pro → Sonnet, with escalation rounds reaching critical = Sonnet → Opus).
 */
export function complexityFloorForRoles(roles?: string[] | null): TaskComplexity {
  const r = roles || []
  if (r.includes('super_admin')) {
    return isValidTier(process.env.LEO_STEWARD_TIER_FLOOR) ? process.env.LEO_STEWARD_TIER_FLOOR : 'high'
  }
  if (r.includes('admin') || r.includes('archangel')) return 'medium'
  return 'low'
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
  /** Whether this round is an escalation (deep think) round */
  isEscalationRound?: boolean
  /** Which provider served this — so a caller can mark it DOWN on a 429/quota
   *  error and the next getSmartModel() call skips it (real failover). */
  providerKind?: ProviderKind
}

/**
 * Local model (Ollama / any OpenAI-compatible endpoint) — env-gated, fully
 * inert unless OLLAMA_BASE_URL is set. Lazy-imported so the provider package is
 * never loaded when local routing is off.
 *
 * Auth (both optional, combine as needed):
 *  - OLLAMA_API_KEY → `Authorization: Bearer` (if a proxy/origin checks it).
 *  - CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET → Cloudflare Access service-
 *    token headers — the recommended way to gate a Cloudflare Tunnel placed in
 *    front of Ollama (which has no auth of its own).
 *
 * OLLAMA_MODEL defaults to a 7B tool-calling model that fits an 8GB GPU.
 */
async function resolveLocalModel(): Promise<{ model: LanguageModel; modelId: string } | null> {
  const baseURL = process.env.OLLAMA_BASE_URL
  if (!baseURL) return null
  try {
    const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible')
    const modelId = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct'
    const headers: Record<string, string> = {}
    const cfId = process.env.CF_ACCESS_CLIENT_ID
    const cfSecret = process.env.CF_ACCESS_CLIENT_SECRET
    if (cfId && cfSecret) {
      headers['CF-Access-Client-Id'] = cfId
      headers['CF-Access-Client-Secret'] = cfSecret
    }
    const provider = createOpenAICompatible({
      name: 'ollama',
      baseURL,
      apiKey: process.env.OLLAMA_API_KEY,
      headers: Object.keys(headers).length ? headers : undefined,
    })
    return { model: provider.chatModel(modelId), modelId: `ollama/${modelId}` }
  } catch (err) {
    console.warn('[AI Gateway] Local model unavailable:', err instanceof Error ? err.message : err)
    return null
  }
}

/** Complexity tiers that route to the local model by default (opt-in via env). */
function localPrimaryTiers(): Set<TaskComplexity> {
  const raw = process.env.OLLAMA_PRIMARY_TIERS
  if (!raw) return new Set<TaskComplexity>()
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean) as TaskComplexity[])
}

/** Auth headers for reaching the local endpoint (bearer and/or CF Access token). */
function localAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  if (process.env.OLLAMA_API_KEY) headers['Authorization'] = `Bearer ${process.env.OLLAMA_API_KEY}`
  if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = process.env.CF_ACCESS_CLIENT_ID
    headers['CF-Access-Client-Secret'] = process.env.CF_ACCESS_CLIENT_SECRET
  }
  return headers
}

let _localHealth: { healthy: boolean; checkedAt: number } | null = null
const LOCAL_HEALTH_TTL = 30 * 1000 // 30s

/**
 * Local-first failover gate: is the local endpoint actually reachable right now?
 * A quick GET /models with a short timeout, cached 30s. When this returns false
 * (home box off, tunnel down, Ollama not running), getSmartModel falls through
 * to the cloud gateway instead of handing back a dead model. This is what makes
 * "from here if available, elsewhere if not" robust rather than fragile.
 */
async function isLocalModelHealthy(): Promise<boolean> {
  const baseURL = process.env.OLLAMA_BASE_URL
  if (!baseURL) return false
  if (_localHealth && Date.now() - _localHealth.checkedAt < LOCAL_HEALTH_TTL) {
    return _localHealth.healthy
  }
  let healthy = false
  try {
    const res = await fetch(`${baseURL.replace(/\/$/, '')}/models`, {
      headers: localAuthHeaders(),
      signal: AbortSignal.timeout(2500),
    })
    healthy = res.ok
  } catch {
    healthy = false
  }
  _localHealth = { healthy, checkedAt: Date.now() }
  return healthy
}

/** Invalidate the local-model health cache (e.g. after a config change). */
export function invalidateLocalHealthCache(): void {
  _localHealth = null
}

// ---------------------------------------------------------------------------
// Groq — fast, free/cheap cloud provider (interim primary before local is up).
// OpenAI-compatible, so it reuses the same provider package as Ollama. Hosted,
// so key-presence is availability (no health probe needed). Env-gated on
// GROQ_API_KEY — fully inert until a key is set.
// ---------------------------------------------------------------------------

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

/** Default Groq model per tier (override all with GROQ_MODEL). */
const GROQ_MODEL_BY_TIER: Record<TaskComplexity, string> = {
  low: 'openai/gpt-oss-20b',
  medium: 'openai/gpt-oss-20b',
  high: 'openai/gpt-oss-120b',
  critical: 'openai/gpt-oss-120b',
}

/**
 * Tiers that route to Groq by default. Only meaningful when GROQ_API_KEY is set.
 * Default low,medium — the cheap bulk goes to Groq; high/critical stay on the
 * gateway's native fallback chain (Gemini → Claude) unless explicitly opted in.
 */
function groqPrimaryTiers(): Set<TaskComplexity> {
  if (!process.env.GROQ_API_KEY) return new Set<TaskComplexity>()
  const raw = process.env.GROQ_PRIMARY_TIERS
  const list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : ['low', 'medium']
  return new Set(list as TaskComplexity[])
}

async function resolveGroqModel(
  tier: TaskComplexity,
): Promise<{ model: LanguageModel; modelId: string } | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  try {
    const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible')
    const modelId = process.env.GROQ_MODEL || GROQ_MODEL_BY_TIER[tier]
    const provider = createOpenAICompatible({ name: 'groq', baseURL: GROQ_BASE_URL, apiKey })
    return { model: provider.chatModel(modelId), modelId: `groq/${modelId}` }
  } catch (err) {
    console.warn('[AI Gateway] Groq unavailable:', err instanceof Error ? err.message : err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Provider Registry — ordered, first-available-wins.
// getSmartModel walks the configured order and uses the first provider that is
// available for the requested tier, failing to the next. "Available" is per
// provider: local = reachable health probe + opted-in tier; groq = key + opted-in
// tier; gateway = key present. Emergencies (no gateway key, or credits exhausted)
// make local/groq eligible for ANY tier so LEO keeps answering.
//
// Order source: AI_PROVIDER_ORDER (CSV) today; this single function is the seam
// a DB-backed config will later read from (so the settings panel can reorder it
// for all nodes sharing a database). Default order = local → groq → gateway,
// which reproduces the prior hardcoded behavior exactly.
// ---------------------------------------------------------------------------

type ProviderKind = 'ollama' | 'google' | 'groq' | 'nvidia' | 'gateway' | 'openrouter'

// Order = binding order. Local (ollama) stays first for sovereignty, then GOOGLE
// as the primary CLOUD brain (Ken's own GOOGLE_AI_API_KEY — direct, predictable
// billing, no scary gateway rate-cliff), then the free tiers (groq/nvidia), the
// metered gateway, and OpenRouter LAST as the "LEO must not go dark" safety net.
// Every provider is inert without its key, so a node that hasn't set GOOGLE_AI_API_KEY
// simply skips google and falls through — nothing else changes. Override the whole
// order per-deployment with AI_PROVIDER_ORDER.
const DEFAULT_PROVIDER_ORDER: ProviderKind[] = ['ollama', 'google', 'groq', 'nvidia', 'gateway', 'openrouter']

/** Direct OpenRouter (OpenAI-compatible) model per tier — verified live 2026-06-15. */
const OPENROUTER_TIER_MAP: Record<TaskComplexity, string> = {
  low: 'anthropic/claude-3.5-haiku',
  medium: 'anthropic/claude-sonnet-4',
  high: 'anthropic/claude-opus-4.1',
  critical: 'anthropic/claude-opus-4.1',
}

/** NVIDIA NIM (build.nvidia.com) — OpenAI-compatible, free tier. Nemotron 3 Ultra
 *  is a hybrid Mamba-Transformer MoE (only ~55B of 550B active → fast) with 1M
 *  context AND native tool calling — the right free brain for tool-heavy LEO.
 *  Override per-deployment with NVIDIA_MODEL (e.g. deepseek-ai/deepseek-v4-pro).
 *  ⚠️ The free tier LOGS inputs/outputs for NVIDIA product improvement — route
 *  sensitive tenant conversations elsewhere (see the ai-broker sensitivity note). */
const NVIDIA_DEFAULT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b'
const NVIDIA_TIER_MAP: Record<TaskComplexity, string> = {
  low: NVIDIA_DEFAULT_MODEL,
  medium: NVIDIA_DEFAULT_MODEL,
  high: NVIDIA_DEFAULT_MODEL,
  critical: NVIDIA_DEFAULT_MODEL,
}

/** Direct Google (Gemini) via its OpenAI-compatible endpoint — Flash for the fast
 *  lanes, Pro for the heavy ones. Model IDs are bare (no `google/` prefix) at the
 *  API; we re-prefix on the telemetry modelId. Override with GOOGLE_MODEL to pin one
 *  model for every tier. ⚠️ An AI Studio (free) key may be used to improve Google's
 *  products — google is excluded from the `sensitive` pipe (see PROVIDER_LOGS_DATA). */
// Use the stable `-latest` alias for Flash. The pinned version id
// `gemini-2.5-flash` is now RETIRED — Google returns 404 "This model
// models/gemini-2.5-flash is no longer available" — while `gemini-flash-latest`
// resolves fine. The tier map already used the alias; DEFAULT_MODEL and the
// mechanical-lane default did not, so any path that took those hit a dead model
// (260726: an image analysis in a Spaces channel stuck on "..." forever).
// Pro's pinned id still works. Override per-node with GOOGLE_MODEL.
const GOOGLE_TIER_MAP: Record<TaskComplexity, string> = {
  low: 'gemini-flash-latest',
  medium: 'gemini-flash-latest',
  high: 'gemini-2.5-pro',
  critical: 'gemini-2.5-pro',
}

// ---------------------------------------------------------------------------
// The Hydra — purpose-named intelligence pipes. The SAME registry of
// OpenAI-compatible providers, routed differently by the *intent* of the call:
// tool-heavy agentic work, max frontier quality, cheap chitchat, or SENSITIVE
// (sovereign-only). Intent reweights the availability order; it never invents a
// provider that isn't configured. The endgame: these pipes terminate on Merlins.
// ---------------------------------------------------------------------------

export type ModelIntent = 'default' | 'tool_use' | 'max' | 'chitchat' | 'sensitive'

/** Providers whose data policy LOGS/TRAINS on request content — excluded from the
 *  `sensitive` pipe so private tenant data never becomes someone's training set.
 *  NVIDIA's free tier explicitly records inputs+outputs; local (ollama/Merlin) and
 *  the metered gateway (Anthropic terms) do not. Groq does not train on API data. */
const PROVIDER_LOGS_DATA = new Set<ProviderKind>(['nvidia', 'google'])

/** Per-intent PREFERENCE — which providers to pull to the front. The base order
 *  (AI_PROVIDER_ORDER / default) stays the availability truth; intent reweights it. */
const INTENT_PREFERENCE: Record<ModelIntent, ProviderKind[]> = {
  default: [],
  tool_use: ['nvidia', 'gateway'], // Nemotron 3 Ultra + gateway are the tool-callers
  max: ['gateway', 'openrouter', 'google'], // Anthropic gateway first (prompt caching +
  //   the 10K tool-chain edge on tool-heavy escalations), then OpenRouter, then Gemini Pro
  //   as the reliable/cheap frontier fallback when the metered gateway is unavailable.
  chitchat: ['ollama', 'groq', 'nvidia'], // cheap/fast/free first
  sensitive: ['ollama'], // sovereign first (and logging providers removed below)
}

import { isDown as providerIsDown } from './providerHealth'

export function resolveProviderOrder(intent: ModelIntent = 'default'): ProviderKind[] {
  const raw = process.env.AI_PROVIDER_ORDER
  const valid = new Set<ProviderKind>(['ollama', 'google', 'groq', 'nvidia', 'gateway', 'openrouter'])
  let base = raw
    ? raw.split(',').map((s) => s.trim().toLowerCase()).filter((k): k is ProviderKind => valid.has(k as ProviderKind))
    : [...DEFAULT_PROVIDER_ORDER]
  if (base.length === 0) base = [...DEFAULT_PROVIDER_ORDER]

  // Sensitive pipe: never route through a provider that logs/trains on the data.
  if (intent === 'sensitive') base = base.filter((k) => !PROVIDER_LOGS_DATA.has(k))

  // Pull the intent's preferred providers to the front (only those actually present).
  const pref = INTENT_PREFERENCE[intent].filter((k) => base.includes(k))
  const order = pref.length ? [...pref, ...base.filter((k) => !pref.includes(k))] : base
  return order.length > 0 ? order : [...DEFAULT_PROVIDER_ORDER]
}

interface ProviderAttemptCtx {
  /** Tier after credit-pressure downshift (what we actually serve). */
  tier: TaskComplexity
  /** Originally requested complexity (echoed back on the result). */
  requested: TaskComplexity
  gatewayKey: string | undefined
  creditsExhausted: boolean
  tracking?: { tenantId?: number; userId?: number; tags?: string[] }
}

/** Emergency = no metered gateway available → local/groq may serve ANY tier. */
function isEmergency(ctx: ProviderAttemptCtx): boolean {
  return !ctx.gatewayKey || ctx.creditsExhausted
}

function attemptReason(ctx: ProviderAttemptCtx): string {
  return !ctx.gatewayKey ? 'no-gateway-key' : ctx.creditsExhausted ? 'credits-exhausted' : 'tier-routing'
}

async function attemptOllama(ctx: ProviderAttemptCtx): Promise<SmartModelResult | null> {
  if (!process.env.OLLAMA_BASE_URL) return null
  if (!(isEmergency(ctx) || localPrimaryTiers().has(ctx.tier))) return null
  const local = await resolveLocalModel()
  if (!local) return null
  // Local-first failover: if a cloud fallback exists, only use local when it's
  // actually reachable; with no gateway key it's the only option, use regardless.
  const usable = !ctx.gatewayKey || (await isLocalModelHealthy())
  if (!usable) {
    console.warn('[AI Gateway] Local model unreachable — trying next provider')
    return null
  }
  console.log(`[AI Gateway] 🏠 Local model ${local.modelId} (${attemptReason(ctx)})`)
  return { model: local.model, providerOptions: {}, modelId: local.modelId, complexity: ctx.requested, effectiveComplexity: ctx.tier, providerKind: 'ollama' }
}

async function attemptGroq(ctx: ProviderAttemptCtx): Promise<SmartModelResult | null> {
  if (!process.env.GROQ_API_KEY) return null
  if (!(isEmergency(ctx) || groqPrimaryTiers().has(ctx.tier))) return null
  const groq = await resolveGroqModel(ctx.tier)
  if (!groq) return null
  console.log(`[AI Gateway] ⚡ Groq ${groq.modelId} (${attemptReason(ctx)})`)
  return { model: groq.model, providerOptions: {}, modelId: groq.modelId, complexity: ctx.requested, effectiveComplexity: ctx.tier, providerKind: 'groq' }
}

/**
 * Direct OpenRouter fallback — the last-resort provider so LEO keeps answering when
 * the metered gateway is unavailable (no/invalid AI_GATEWAY_API_KEY, expired OIDC,
 * credits exhausted). Uses OPENROUTER_API_KEY via the OpenAI-compatible API. Serves
 * ANY tier when reached (it's the safety net). ⚠️ if the gateway is down, ALL traffic
 * routes here — point OPENROUTER_API_KEY at an unlimited key, not a low weekly cap.
 */
function attemptOpenRouter(ctx: ProviderAttemptCtx): SmartModelResult | null {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return null
  const modelId = OPENROUTER_TIER_MAP[ctx.tier]
  const provider = createOpenAICompatible({ name: 'openrouter', baseURL: 'https://openrouter.ai/api/v1', apiKey: key })
  console.log(`[AI Gateway] 🔀 OpenRouter ${modelId} (${attemptReason(ctx)})`)
  return { model: provider(modelId), providerOptions: {}, modelId, complexity: ctx.requested, effectiveComplexity: ctx.tier, providerKind: 'openrouter' }
}

/**
 * NVIDIA NIM (build.nvidia.com) — free, OpenAI-compatible intelligence. Serves the
 * tier's Nemotron/Llama model when NVIDIA_API_KEY (an `nvapi-…` key) is set. Placed
 * among the free providers so it's used ahead of paid gateway credits. This is the
 * foundation for the intelligence-backbone vision: a Merlin node with this key can
 * later re-share NVIDIA upstream to the mesh via the ai-broker.
 */
function attemptNvidia(ctx: ProviderAttemptCtx): SmartModelResult | null {
  const key = process.env.NVIDIA_API_KEY
  if (!key) return null
  const modelId = process.env.NVIDIA_MODEL || NVIDIA_TIER_MAP[ctx.tier]
  const provider = createOpenAICompatible({ name: 'nvidia', baseURL: 'https://integrate.api.nvidia.com/v1', apiKey: key })
  console.log(`[AI Gateway] 🟩 NVIDIA NIM ${modelId} (${attemptReason(ctx)})`)
  return { model: provider(modelId), providerOptions: {}, modelId: `nvidia/${modelId}`, complexity: ctx.requested, effectiveComplexity: ctx.tier, providerKind: 'nvidia' }
}

/**
 * Direct Google (Gemini) — Ken's own GOOGLE_AI_API_KEY via Google's OpenAI-compatible
 * endpoint. The primary CLOUD brain: predictable direct billing, no Vercel-gateway
 * rate-cliff. Placed right after local in the default order so it wins ahead of the
 * metered gateway. Inert without a key. Serves ANY tier once reached (Flash/Pro by
 * tier). The `google/` telemetry prefix keeps cost attribution readable.
 */
function attemptGoogle(ctx: ProviderAttemptCtx): SmartModelResult | null {
  const key = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) return null
  const modelId = process.env.GOOGLE_MODEL || GOOGLE_TIER_MAP[ctx.tier]
  const provider = createOpenAICompatible({
    name: 'google',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKey: key,
  })
  console.log(`[AI Gateway] 🔵 Google ${modelId} (${attemptReason(ctx)})`)
  return { model: provider(modelId), providerOptions: {}, modelId: `google/${modelId}`, complexity: ctx.requested, effectiveComplexity: ctx.tier, providerKind: 'google' }
}

function attemptGateway(ctx: ProviderAttemptCtx): SmartModelResult | null {
  if (!ctx.gatewayKey) return null
  const config = TASK_MODEL_MAP[ctx.tier]
  const provider = createGateway({ apiKey: ctx.gatewayKey })
  const model = provider.languageModel(config.primary)
  const gatewayOpts: Record<string, unknown> = { models: config.fallbacks }
  if (ctx.tracking?.tenantId || ctx.tracking?.userId) {
    gatewayOpts.user = `t${ctx.tracking.tenantId || 0}-u${ctx.tracking.userId || 0}`
  }
  gatewayOpts.tags = [...(ctx.tracking?.tags || []), `tier-${ctx.tier}`]

  const providerOptions: Record<string, unknown> = { gateway: gatewayOpts }
  // Prompt caching on the Anthropic path: LEO's large static system prompt + ~10k
  // tokens of tool schemas are the same every turn, so caching them is ~10x cheaper
  // on hits — the biggest cost lever for a tool-heavy agent. Additive + provider-
  // scoped (the gateway forwards it to the Anthropic model); a no-op for non-Anthropic
  // primaries. ⚠️ Verify cache-hit rate with real traffic; if the gateway doesn't
  // auto-apply to system+tools, the follow-up is per-message cache breakpoints at the
  // streamText call site.
  if (config.primary.startsWith('anthropic/')) {
    providerOptions.anthropic = { cacheControl: { type: 'ephemeral' } }
  }
  return { model, providerOptions, modelId: config.primary, complexity: ctx.requested, effectiveComplexity: ctx.tier, providerKind: 'gateway' }
}

/**
 * Returns a model + providerOptions pre-configured for the given task complexity.
 * Includes gateway-native fallback chains, credit-aware downshifting, and
 * per-request tracking tags.
 *
 * Local-model integration (env-gated, all inert unless OLLAMA_BASE_URL is set):
 *   - Tiers listed in OLLAMA_PRIMARY_TIERS route to the local model directly.
 *   - When cloud credits are critically exhausted, falls back to local instead
 *     of erroring — LEO keeps answering (more simply) on a dead wallet.
 *   - When no AI_GATEWAY_API_KEY is configured at all, local becomes the only
 *     provider (self-hosted node with a GPU, no cloud gateway).
 *
 * Usage:
 *   const smart = await getSmartModel('medium', { tenantId: 5, userId: 12 })
 *   const result = await generateText({ model: smart.model, providerOptions: smart.providerOptions, ... })
 *
 * The gateway handles fallback internally — no need for manual try/catch.
 */
export async function getSmartModel(
  complexity: TaskComplexity = 'medium',
  tracking?: { tenantId?: number; userId?: number; tags?: string[]; intent?: ModelIntent },
): Promise<SmartModelResult | null> {
  const apiKey = resolveGatewayKey()

  // Psalm 119:105 — "Thy word is a lamp unto my feet, and a light unto my path."
  // Every intelligence call begins with the sacred lamp invocation.
  console.log(`[AI Gateway] 🕯️ ${GENESIS_BREATH.split('\n')[0]}`)

  const credits = apiKey ? await checkCredits() : null
  const effectiveComplexity = applyCreditPressure(complexity, credits)
  const creditsExhausted = !!credits && credits.balance < CREDIT_THRESHOLD_CRITICAL

  const ctx: ProviderAttemptCtx = {
    tier: effectiveComplexity,
    requested: complexity,
    gatewayKey: apiKey,
    creditsExhausted,
    tracking,
  }

  // Walk the intent's provider order; the first provider available for this tier
  // wins, failing to the next. `sensitive` excludes data-logging providers.
  for (const kind of resolveProviderOrder(tracking?.intent)) {
    // Skip a provider that was recently marked DOWN (429/quota/auth) so a retry
    // after a rate-limit advances to the NEXT provider instead of re-picking the
    // throttled one. The breaker self-heals on its TTL. `gateway` is exempt — it
    // has its own internal model fallbacks and is the metered safety net.
    if (kind !== 'gateway' && providerIsDown(kind)) {
      console.warn(`[AI Gateway] ⏭️ skipping ${kind} — circuit-broken (recent 429/quota)`)
      continue
    }
    const result =
      kind === 'ollama' ? await attemptOllama(ctx)
      : kind === 'google' ? attemptGoogle(ctx)
      : kind === 'groq' ? await attemptGroq(ctx)
      : kind === 'nvidia' ? attemptNvidia(ctx)
      : kind === 'openrouter' ? attemptOpenRouter(ctx)
      : attemptGateway(ctx)
    if (result) return result
  }

  console.warn('[AI Gateway] No provider available for this request (order exhausted)')
  return null
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
 *  - Full gateway ID: "anthropic/claude-sonnet-4-6"
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
  'gemini-flash-image': 'google/gemini-flash-lite-latest',
  'gemini-pro-image': 'google/gemini-3.1-pro',
  'gpt-image': 'openai/gpt-5-image',
  'gpt-image-mini': 'openai/gpt-5-image-mini',
} as const

export type ImageModelAlias = keyof typeof IMAGE_MODEL_CATALOG

/** Default image model */
export const DEFAULT_IMAGE_MODEL = 'google/gemini-flash-lite-latest'

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
// Per-Tenant BYOK Text Model (budget enforcement)
// ---------------------------------------------------------------------------

export interface ByokModelResult {
  model: LanguageModel
  /** Prefixed id (e.g. `openrouter/openai/gpt-4o-mini`) so telemetry attributes the provider. */
  modelId: string
  provider: 'openrouter' | 'openai' | 'nvidia'
}

/**
 * Build a text model from the tenant's OWN provider key (BYOK), for when a tenant
 * is over its platform AI budget — the cost then falls on the tenant, $0 to the
 * platform. Supports OpenAI-compatible providers (OpenRouter, OpenAI) since those
 * are the SDK adapters we ship; Anthropic-direct BYOK is deferred (no SDK adapter).
 * Model ids are env-overridable per provider. Returns null when no usable key.
 */
export async function buildByokModel(
  cfg?: Record<string, unknown> | null,
): Promise<ByokModelResult | null> {
  if (!cfg) return null
  const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible')

  // NVIDIA NIM first — it's the free option, so a tenant that configured it in
  // the AI settings tab (aiConfig.nvidiaApiKey) gets $0 intelligence before we
  // reach for their paid OpenRouter/OpenAI keys.
  const nvKey = typeof cfg.nvidiaApiKey === 'string' ? cfg.nvidiaApiKey.trim() : ''
  if (nvKey) {
    const modelId = (typeof cfg.nvidiaModel === 'string' && cfg.nvidiaModel.trim()) || process.env.NVIDIA_MODEL || NVIDIA_DEFAULT_MODEL
    const provider = createOpenAICompatible({ name: 'nvidia', baseURL: 'https://integrate.api.nvidia.com/v1', apiKey: nvKey })
    return { model: provider.languageModel(modelId), modelId: `nvidia/${modelId}`, provider: 'nvidia' }
  }

  const orKey = typeof cfg.openrouterApiKey === 'string' ? cfg.openrouterApiKey.trim() : ''
  if (orKey) {
    const modelId = process.env.BYOK_OPENROUTER_MODEL || 'openai/gpt-4o-mini'
    const provider = createOpenAICompatible({ name: 'openrouter', baseURL: 'https://openrouter.ai/api/v1', apiKey: orKey })
    return { model: provider.languageModel(modelId), modelId: `openrouter/${modelId}`, provider: 'openrouter' }
  }

  const oaKey = typeof cfg.openaiApiKey === 'string' ? cfg.openaiApiKey.trim() : ''
  if (oaKey) {
    const modelId = process.env.BYOK_OPENAI_MODEL || 'gpt-4o-mini'
    const provider = createOpenAICompatible({ name: 'openai', baseURL: 'https://api.openai.com/v1', apiKey: oaKey })
    return { model: provider.languageModel(modelId), modelId: `openai/${modelId}`, provider: 'openai' }
  }

  return null
}

// ---------------------------------------------------------------------------
// Per-Tenant Image Provider Resolution (Sprint 44)
// ---------------------------------------------------------------------------

/** Shape of aiConfig stored on Tenants collection */
export interface TenantAiConfig {
  anthropicApiKey?: string
  openrouterApiKey?: string
  openaiApiKey?: string
  googleAiApiKey?: string
  cloudflareAccountId?: string
  cloudflareAiToken?: string
  preferredImageProvider?: 'auto' | 'openai' | 'google' | 'openrouter' | 'cloudflare'
}

export type ImageProvider = 'gateway' | 'openai' | 'google' | 'openrouter' | 'cloudflare'

export interface ResolvedImageProvider {
  provider: ImageProvider
  apiKey: string
  /** Cloudflare-specific account ID */
  accountId?: string
}

/**
 * Resolves which image generation provider to use based on tenant config.
 *
 * Priority:
 *   1. Tenant's preferred provider (if they have a key for it)
 *   2. Auto: Gateway → OpenRouter (tenant key) → OpenAI → Google → Cloudflare → OpenRouter (platform)
 *   3. Falls back to null if nothing is available
 */
/** Check if a specific image provider has a valid key (env or tenant config). */
function tryImageProvider(
  p: ImageProvider,
  tenantConfig?: TenantAiConfig,
): ResolvedImageProvider | null {
  switch (p) {
    case 'gateway': {
      const key = resolveGatewayKey()
      return key ? { provider: 'gateway', apiKey: key } : null
    }
    case 'openai': {
      const key = tenantConfig?.openaiApiKey || process.env.OPENAI_API_KEY
      return key ? { provider: 'openai', apiKey: key } : null
    }
    case 'google': {
      const key = tenantConfig?.googleAiApiKey || process.env.GOOGLE_AI_API_KEY
      return key ? { provider: 'google', apiKey: key } : null
    }
    case 'openrouter': {
      const key = tenantConfig?.openrouterApiKey || process.env.OPENROUTER_API_KEY
      return key ? { provider: 'openrouter', apiKey: key } : null
    }
    case 'cloudflare': {
      const token = tenantConfig?.cloudflareAiToken || process.env.CLOUDFLARE_AI_TOKEN
      const accountId = tenantConfig?.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID
      return token && accountId ? { provider: 'cloudflare', apiKey: token, accountId } : null
    }
    default:
      return null
  }
}

/**
 * The full ordered chain of AVAILABLE image providers for fail-soft/fail-up
 * fallback — tenant preference first, then the node-level IMAGE_PROVIDER default,
 * then the auto priority order, de-duplicated, keeping only those with keys. The
 * caller walks this list skipping circuit-open providers (see providerCircuit) so
 * a rate-limited/outage provider is bypassed without extra health-check traffic.
 */
export function resolveImageProviderChain(
  tenantConfig?: TenantAiConfig,
): ResolvedImageProvider[] {
  const pref = tenantConfig?.preferredImageProvider ?? 'auto'
  const envPref = process.env.IMAGE_PROVIDER as ImageProvider | undefined
  const autoOrder: ImageProvider[] = ['gateway', 'openrouter', 'openai', 'google', 'cloudflare']

  const order: ImageProvider[] = [
    ...(pref !== 'auto' ? [pref] : []),
    ...(pref === 'auto' && envPref ? [envPref] : []),
    ...autoOrder,
  ]

  const seen = new Set<ImageProvider>()
  const chain: ResolvedImageProvider[] = []
  for (const p of order) {
    if (seen.has(p)) continue
    seen.add(p)
    const resolved = tryImageProvider(p, tenantConfig)
    if (resolved) chain.push(resolved)
  }
  return chain
}

/** The single best available image provider (first of the chain), or null. */
export function resolveImageProvider(
  tenantConfig?: TenantAiConfig,
): ResolvedImageProvider | null {
  return resolveImageProviderChain(tenantConfig)[0] ?? null
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
