/**
 * Federation Client — Outbound HTTP for Cross-Enterprise Communication
 *
 * Every outbound request is signed with the Enterprise's Ed25519 private key.
 * Every inbound request is verified by the trust guard (Phase 6).
 *
 * Functions:
 *   - discoverEnterprise(domain) — fetch /.well-known/angel-os.json
 *   - sendHeartbeat(targetDomain) — signed POST to target's heartbeat endpoint
 *   - fetchCatalog(targetDomain, query) — browse another Enterprise's products
 *   - invokeSkill(targetDomain, skillName, params) — call a skill on another Enterprise
 *
 * All requests include:
 *   X-Federation-Id: this Enterprise's federation ID
 *   X-Federation-Signature: Ed25519 signature of the request body
 *   X-Federation-Key: this Enterprise's public key (so target can verify)
 *   X-Federation-Timestamp: ISO timestamp (for replay prevention)
 *
 * Constitutional Reference: Article VII — Federation protocol
 */

import { signData } from '@/federation/protocol'

// ── Types ──────────────────────────────────────────────────────────────────

export interface FederationIdentity {
  federationId: string
  publicKey: string
  privateKey: string // Never transmitted — used only for signing
  domain: string
  name: string
}

export interface DiscoveryResult {
  federation: {
    version: string
    protocol: string
    constitutionVersion: string
    constitutionChecksum: string
    federationId: string | null
    publicKey: string | null
    ministryStatus: string
    domain: string
    name: string
    holonTypes: string[]
    capabilities: string[]
    region: unknown
    catalogEndpoint: string
    skillsEndpoint: string
    heartbeatEndpoint: string
    vouchEndpoint: string
    pingEndpoint: string
    mcpEndpoint: string
  }
}

export interface HeartbeatPayload {
  federationId: string
  domain: string
  name: string
  timestamp: string
  constitutionVersion: string
  status: 'healthy' | 'degraded'
  capabilities: string[]
  catalogEntryCount: number
}

export interface HeartbeatResponse {
  acknowledged: boolean
  theirStatus: string
  theirFederationId: string
  message: string
}

export interface CatalogQuery {
  capability?: string
  region?: string
  q?: string
  limit?: number
  minRating?: number
  maxPrice?: number
}

export interface FederationRequestOptions {
  timeout?: number
  retries?: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 10_000 // 10 seconds
// Retry transient failures so a single network blip never skips a heartbeat —
// which is what kept the mesh going cold (peers marked stale after one miss).
const DEFAULT_RETRIES = 2

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * fetch with timeout + exponential-backoff retry (with jitter) on transient
 * failures — network errors, timeouts, 5xx, and 429. Returns the Response (incl.
 * non-retryable 4xx, for the caller to handle) or null if every attempt failed.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { timeout: number; retries: number },
): Promise<Response | null> {
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(200 * 2 ** (attempt - 1), 2000)
      await sleep(backoff + Math.floor(Math.random() * 100)) // jitter avoids thundering herd
    }
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(opts.timeout) })
      // Retry only transient server-side failures; hand 2xx/4xx straight back.
      if (res.ok || (res.status < 500 && res.status !== 429)) return res
    } catch {
      // network error / timeout — fall through to retry
    }
  }
  return null
}

// ── Signing ────────────────────────────────────────────────────────────────

/**
 * Sign a request body and return headers for federation auth.
 */
function createSignedHeaders(
  body: string,
  identity: FederationIdentity,
): Record<string, string> {
  const timestamp = new Date().toISOString()
  // Sign: timestamp + body (prevents replay attacks — trust guard checks timestamp freshness)
  const signable = `${timestamp}\n${body}`
  const signature = signData(signable, identity.privateKey)

  return {
    'Content-Type': 'application/json',
    'X-Federation-Id': identity.federationId,
    'X-Federation-Signature': signature,
    'X-Federation-Key': identity.publicKey,
    'X-Federation-Timestamp': timestamp,
    'X-Federation-Protocol': 'angel-os/1.0',
  }
}

// ── Discovery ──────────────────────────────────────────────────────────────

/**
 * Discover another Enterprise by fetching its /.well-known/angel-os.json
 * No signing needed — this is a public endpoint.
 */
export async function discoverEnterprise(
  domain: string,
  options: FederationRequestOptions = {},
): Promise<DiscoveryResult | null> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT
  const retries = options.retries ?? DEFAULT_RETRIES
  // Normalize domain — add https:// if needed
  const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`
  const url = `${baseUrl}/.well-known/angel-os.json`

  try {
    const response = await fetchWithRetry(
      url,
      { method: 'GET', headers: { Accept: 'application/json', 'X-Federation-Protocol': 'angel-os/1.0' } },
      { timeout, retries },
    )

    if (!response || !response.ok) {
      console.warn(`[FederationClient] Discovery failed for ${domain}: ${response?.status ?? 'no response'}`)
      return null
    }

    const data = (await response.json()) as DiscoveryResult
    if (!data?.federation?.protocol || data.federation.protocol !== 'angel-os-federation') {
      console.warn(`[FederationClient] ${domain} is not an Angel OS instance`)
      return null
    }

    return data
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[FederationClient] Discovery error for ${domain}: ${message}`)
    return null
  }
}

// ── Heartbeat ──────────────────────────────────────────────────────────────

/**
 * Send a signed heartbeat to another Enterprise.
 */
export async function sendHeartbeat(
  targetDomain: string,
  heartbeat: HeartbeatPayload,
  identity: FederationIdentity,
  options: FederationRequestOptions = {},
): Promise<HeartbeatResponse | null> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT
  const retries = options.retries ?? DEFAULT_RETRIES

  // Discover target to get heartbeat endpoint (retries internally too)
  const discovery = await discoverEnterprise(targetDomain, { timeout, retries })
  if (!discovery) return null

  const body = JSON.stringify(heartbeat)
  const headers = createSignedHeaders(body, identity)

  const response = await fetchWithRetry(
    discovery.federation.heartbeatEndpoint,
    { method: 'POST', headers, body },
    { timeout, retries },
  )

  if (!response || !response.ok) {
    console.warn(`[FederationClient] Heartbeat to ${targetDomain} failed: ${response?.status ?? 'no response'}`)
    return null
  }

  return (await response.json()) as HeartbeatResponse
}

// ── Catalog ────────────────────────────────────────────────────────────────

/**
 * Fetch products/services from another Enterprise's federation catalog.
 */
export async function fetchCatalog(
  targetDomain: string,
  query: CatalogQuery,
  identity: FederationIdentity,
  options: FederationRequestOptions = {},
): Promise<{ entries: unknown[]; total: number } | null> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT

  const discovery = await discoverEnterprise(targetDomain, { timeout })
  if (!discovery) return null

  // Build query string
  const params = new URLSearchParams()
  if (query.capability) params.set('capability', query.capability)
  if (query.region) params.set('region', query.region)
  if (query.q) params.set('q', query.q)
  if (query.limit) params.set('limit', String(query.limit))
  if (query.minRating) params.set('minRating', String(query.minRating))
  if (query.maxPrice) params.set('maxPrice', String(query.maxPrice))

  const url = `${discovery.federation.catalogEndpoint}?${params.toString()}`

  // Even GET requests get signed for trust verification
  const signable = `GET\n${url}`
  const body = JSON.stringify({ method: 'GET', url })
  const headers = createSignedHeaders(body, identity)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Content-Type': undefined as unknown as string, // Remove for GET
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) {
      console.warn(`[FederationClient] Catalog fetch from ${targetDomain} failed: ${response.status}`)
      return null
    }

    return (await response.json()) as { entries: unknown[]; total: number }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[FederationClient] Catalog error for ${targetDomain}: ${message}`)
    return null
  }
}

// ── Skills ─────────────────────────────────────────────────────────────────

/**
 * List available skills on another Enterprise.
 */
export async function listSkills(
  targetDomain: string,
  options: FederationRequestOptions = {},
): Promise<unknown[] | null> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT

  const discovery = await discoverEnterprise(targetDomain, { timeout })
  if (!discovery) return null

  try {
    const response = await fetch(discovery.federation.skillsEndpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Federation-Protocol': 'angel-os/1.0',
      },
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) return null
    const data = (await response.json()) as { skills: unknown[] }
    return data.skills ?? []
  } catch {
    return null
  }
}

/**
 * Invoke a skill on another Enterprise. Requires signing + budget check on caller side.
 */
export async function invokeSkill(
  targetDomain: string,
  skillName: string,
  params: Record<string, unknown>,
  identity: FederationIdentity,
  options: FederationRequestOptions = {},
): Promise<{ result: unknown; costCents: number } | null> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT

  const discovery = await discoverEnterprise(targetDomain, { timeout })
  if (!discovery) return null

  const payload = {
    skill: skillName,
    params,
    callerFederationId: identity.federationId,
    callerDomain: identity.domain,
  }

  const body = JSON.stringify(payload)
  const headers = createSignedHeaders(body, identity)

  try {
    const response = await fetch(`${discovery.federation.skillsEndpoint}/invoke`, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.warn(
        `[FederationClient] Skill invoke on ${targetDomain} failed: ${response.status} ${text.slice(0, 200)}`,
      )
      return null
    }

    return (await response.json()) as { result: unknown; costCents: number }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[FederationClient] Skill invoke error for ${targetDomain}: ${message}`)
    return null
  }
}

// ── Vouch ──────────────────────────────────────────────────────────────────

/**
 * Send a vouch for another Enterprise.
 */
export async function sendVouch(
  targetDomain: string,
  reason: string,
  identity: FederationIdentity,
  options: FederationRequestOptions = {},
): Promise<{ accepted: boolean; message: string } | null> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT

  const discovery = await discoverEnterprise(targetDomain, { timeout })
  if (!discovery) return null

  const payload = {
    voucherFederationId: identity.federationId,
    voucherDomain: identity.domain,
    voucherName: identity.name,
    targetFederationId: discovery.federation.federationId,
    reason,
    vouchedAt: new Date().toISOString(),
  }

  const body = JSON.stringify(payload)
  const headers = createSignedHeaders(body, identity)

  try {
    const response = await fetch(discovery.federation.vouchEndpoint, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) return null
    return (await response.json()) as { accepted: boolean; message: string }
  } catch {
    return null
  }
}
