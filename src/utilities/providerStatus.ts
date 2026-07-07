/**
 * providerStatus — the AI switchboard probe.
 *
 * "Is each provider UP, even if it isn't the one we're using right now?" The cost
 * telemetry answers "what did we USE"; this answers "what's AVAILABLE". For every
 * provider in the registry it reports: configured (key present), reachable (a live,
 * cheap models-list ping), latency, and whether it's the one a default call would
 * SELECT right now (first-configured in the binding order). Plus Vercel Blob storage
 * — the other always-on dependency — so the whole thing is one operations heartbeat
 * LEO can fold into its evaluation loop.
 *
 * All probes are parallel, short-timeout, and fail-soft: a down provider reports
 * reachable:false with a note, never throws. Read-only; no secrets in the output.
 */
import { resolveProviderOrder } from './ai-gateway'

export type ProbeKind = 'ollama' | 'google' | 'groq' | 'nvidia' | 'gateway' | 'openrouter'

export interface ProviderProbe {
  kind: ProbeKind
  label: string
  configured: boolean
  reachable: boolean | null // null = not probed (not configured, or unprobeable)
  latencyMs: number | null
  /** True for the provider a default-intent call would pick first right now. */
  selected: boolean
  note?: string
}

export interface BlobProbe {
  configured: boolean
  reachable: boolean | null
  latencyMs: number | null
  note?: string
}

export interface OpsStatus {
  probedAt: string
  order: ProbeKind[]
  providers: ProviderProbe[]
  blob: BlobProbe
}

const LABELS: Record<ProbeKind, string> = {
  ollama: 'Ollama (local)',
  google: 'Google Gemini',
  groq: 'Groq',
  nvidia: 'NVIDIA NIM',
  gateway: 'Vercel Gateway',
  openrouter: 'OpenRouter',
}

/** Fetch with a hard timeout; returns {ok, ms} and never throws. */
async function timedFetch(url: string, init: RequestInit, timeoutMs = 3000): Promise<{ ok: boolean; status: number; ms: number; error?: string }> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  const started = performance.now()
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
    return { ok: res.ok, status: res.status, ms: Math.round(performance.now() - started) }
  } catch (e) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - started), error: e instanceof Error ? e.message : String(e) }
  } finally {
    clearTimeout(t)
  }
}

function bearer(key: string): RequestInit {
  return { method: 'GET', headers: { Authorization: `Bearer ${key}` } }
}

/** Per-provider reachability. Each returns {reachable, latencyMs, note}. */
async function probeOne(kind: ProbeKind): Promise<{ configured: boolean; reachable: boolean | null; latencyMs: number | null; note?: string }> {
  switch (kind) {
    case 'ollama': {
      const base = process.env.OLLAMA_BASE_URL
      if (!base) return { configured: false, reachable: null, latencyMs: null }
      const r = await timedFetch(`${base.replace(/\/$/, '')}/api/tags`, { method: 'GET' })
      return { configured: true, reachable: r.ok, latencyMs: r.ms, note: r.ok ? undefined : r.error || `HTTP ${r.status}` }
    }
    case 'google': {
      const key = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
      if (!key) return { configured: false, reachable: null, latencyMs: null }
      const r = await timedFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, { method: 'GET' })
      return { configured: true, reachable: r.ok, latencyMs: r.ms, note: r.ok ? undefined : r.error || `HTTP ${r.status}` }
    }
    case 'groq': {
      const key = process.env.GROQ_API_KEY
      if (!key) return { configured: false, reachable: null, latencyMs: null }
      const r = await timedFetch('https://api.groq.com/openai/v1/models', bearer(key))
      return { configured: true, reachable: r.ok, latencyMs: r.ms, note: r.ok ? undefined : r.error || `HTTP ${r.status}` }
    }
    case 'nvidia': {
      const key = process.env.NVIDIA_API_KEY
      if (!key) return { configured: false, reachable: null, latencyMs: null }
      const r = await timedFetch('https://integrate.api.nvidia.com/v1/models', bearer(key))
      return { configured: true, reachable: r.ok, latencyMs: r.ms, note: r.ok ? undefined : r.error || `HTTP ${r.status}` }
    }
    case 'openrouter': {
      const key = process.env.OPENROUTER_API_KEY
      if (!key) return { configured: false, reachable: null, latencyMs: null }
      const r = await timedFetch('https://openrouter.ai/api/v1/models', bearer(key))
      return { configured: true, reachable: r.ok, latencyMs: r.ms, note: r.ok ? undefined : r.error || `HTTP ${r.status}` }
    }
    case 'gateway': {
      // The AI Gateway has no cheap public models-list ping; treat a present key as
      // configured and report reachable:null (unprobed) rather than guess.
      const key = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
      if (!key) return { configured: false, reachable: null, latencyMs: null }
      return { configured: true, reachable: null, latencyMs: null, note: 'configured (no cheap liveness ping)' }
    }
  }
}

async function probeBlob(): Promise<BlobProbe> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return { configured: false, reachable: null, latencyMs: null }
  const started = performance.now()
  try {
    const { list } = await import('@vercel/blob')
    await list({ limit: 1, token })
    return { configured: true, reachable: true, latencyMs: Math.round(performance.now() - started) }
  } catch (e) {
    return { configured: true, reachable: false, latencyMs: Math.round(performance.now() - started), note: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Probe the whole AI switchboard + blob storage in parallel. `selected` marks the
 * provider a default call would pick first (first configured in the binding order).
 */
export async function getProviderStatus(): Promise<OpsStatus> {
  const order = resolveProviderOrder('default') as ProbeKind[]
  const kinds: ProbeKind[] = ['ollama', 'google', 'groq', 'nvidia', 'gateway', 'openrouter']

  const [probeResults, blob] = await Promise.all([
    Promise.all(kinds.map(async (kind) => ({ kind, ...(await probeOne(kind)) }))),
    probeBlob(),
  ])

  const byKind = new Map(probeResults.map((p) => [p.kind, p]))
  // The selected provider = first in the binding order that is configured.
  const selectedKind = order.find((k) => byKind.get(k)?.configured) || null

  const providers: ProviderProbe[] = kinds.map((kind) => {
    const p = byKind.get(kind)!
    return {
      kind,
      label: LABELS[kind],
      configured: p.configured,
      reachable: p.reachable,
      latencyMs: p.latencyMs,
      selected: kind === selectedKind,
      note: p.note,
    }
  })

  return {
    probedAt: new Date().toISOString(),
    order,
    providers,
    blob,
  }
}
