/**
 * AI response telemetry — what we capture with every model response.
 *
 * Provider-agnostic: works for the cloud gateway (google/anthropic), Groq, and
 * local Ollama alike. Whatever served the turn, we record tokens, the model +
 * provider that ACTUALLY answered (not just the one we picked), tier, latency,
 * finish reason, tool calls, failover, and an estimated cost.
 *
 * Today this rides in Messages.metadata (free-form json — zero schema risk). A
 * dedicated ai-usage collection for aggregation is the deliberate next step.
 */

/** Approximate list pricing, USD per 1M tokens. Best-effort for cost telemetry. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4-6': { input: 3, output: 15 },
  'anthropic/claude-opus-4-6': { input: 15, output: 75 },
  'google/gemini-2.5-flash': { input: 0.075, output: 0.3 },
  'google/gemini-3.1-pro': { input: 1.25, output: 10 },
  // The models that ACTUALLY serve LEO were all missing here, so every Google
  // turn recorded `costCents: undefined` — 30 days of Gemini traffic priced at
  // nothing, which reads on a dashboard as "AI costs us nothing" rather than
  // "AI cost is unmeasured". Found 260801 while checking exactly that claim.
  //
  // These are list-price ESTIMATES, and the `-latest` aliases move under us when
  // Google promotes a generation — treat them as order-of-magnitude, which is
  // what `costEstimated` already says they are.
  'google/gemini-2.5-pro': { input: 1.25, output: 10 },
  'google/gemini-pro-latest': { input: 1.25, output: 10 },
  'google/gemini-flash-latest': { input: 0.3, output: 2.5 },
  'google/gemini-flash-lite-latest': { input: 0.1, output: 0.4 },
  'groq/openai/gpt-oss-20b': { input: 0.075, output: 0.3 },
  'groq/openai/gpt-oss-120b': { input: 0.15, output: 0.6 },
}

/** The provider that served, derived from the model id (ollama/groq/<gateway provider>). */
export function providerFromModelId(modelId: string): string {
  if (modelId.startsWith('ollama/')) return 'ollama'
  if (modelId.startsWith('groq/')) return 'groq'
  const slash = modelId.indexOf('/')
  return slash > 0 ? modelId.slice(0, slash) : 'gateway' // google / anthropic / openai / ...
}

/**
 * Estimated cost in cents (3-decimal precision). Local models are free ($0).
 * Returns undefined when the model isn't priced or tokens are unknown.
 */
export function computeCostCents(
  modelId: string,
  inputTokens?: number,
  outputTokens?: number,
): number | undefined {
  if (modelId.startsWith('ollama/')) return 0 // local inference — free
  const price = MODEL_PRICING[modelId]
  if (!price || inputTokens == null || outputTokens == null) return undefined
  const dollars = (inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output
  return Math.round(dollars * 100 * 1000) / 1000
}

export interface AiResponseTelemetry {
  /** The model that ACTUALLY produced the response (correct even after failover). */
  model: string
  provider: string
  tier?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  /** Estimated cost in cents; 0 for local; undefined if unpriced/unknown. */
  costCents?: number
  /** True when costCents is a list-price estimate (not an authoritative bill). */
  costEstimated?: boolean
  /** Total stream wall-time. */
  latencyMs?: number
  /** Time to first token. */
  ttftMs?: number
  finishReason?: string
  /** Names of tools called this turn (across all rounds). */
  toolCalls?: string[]
  toolCallCount?: number
  /** True when the primary provider failed and a fallback served the turn. */
  failedOver?: boolean
}

export function buildResponseTelemetry(input: {
  model: string
  tier?: string
  inputTokens?: number
  outputTokens?: number
  finishReason?: string
  toolNames?: string[]
  latencyMs?: number
  ttftMs?: number
  failedOver?: boolean
}): AiResponseTelemetry {
  const { model, inputTokens, outputTokens } = input
  const totalTokens =
    inputTokens != null && outputTokens != null ? inputTokens + outputTokens : undefined
  const costCents = computeCostCents(model, inputTokens, outputTokens)
  const tools = input.toolNames?.length ? input.toolNames : undefined
  return {
    model,
    provider: providerFromModelId(model),
    tier: input.tier,
    inputTokens,
    outputTokens,
    totalTokens,
    costCents,
    costEstimated: costCents != null && costCents > 0 ? true : undefined,
    latencyMs: input.latencyMs,
    ttftMs: input.ttftMs,
    finishReason: input.finishReason,
    toolCalls: tools,
    toolCallCount: tools?.length,
    failedOver: input.failedOver || undefined,
  }
}
