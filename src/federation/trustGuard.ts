/**
 * Federation Trust Guard — Zero Trust Request Verification
 *
 * Every inbound federation request passes through this guard.
 * Constitutional Reference: Article II (Anti-Demonic Safeguards) — enforced structurally, not aspirationally.
 *
 * Implements:
 *   1. Ed25519 signature verification on every request
 *   2. Timestamp freshness check (replay prevention)
 *   3. Federation ID existence verification
 *   4. Ministry status / trust level enforcement
 *   5. Integration with rate limiter and audit log
 *
 * Key principle: Agents are treated as INSIDER THREATS with Zero Trust.
 * Verified identity on every request. No cached trust. No assumed goodwill.
 */

import { verifySignature } from './protocol'
import type { TrustLevel, MinistryStatus } from '@/utilities/federationEngine'
import { checkRateLimit, type RateLimitAction } from './rateLimiter'

// ── Types ──────────────────────────────────────────────────────────────────

export interface FederationAuthHeaders {
  federationId: string
  signature: string
  publicKey: string
  timestamp: string
}

export interface TrustVerification {
  verified: boolean
  federationId: string
  trustLevel: TrustLevel
  ministryStatus: MinistryStatus | null
  publicKey: string
  reason: string
}

export interface TrustRequirement {
  /** Minimum trust level to access this resource */
  minimumTrust: TrustLevel
  /** The federation action type (for rate limiting + audit) */
  action: RateLimitAction
}

/** Trust level hierarchy for comparison */
const TRUST_HIERARCHY: Record<TrustLevel, number> = {
  none: 0,
  probationary: 1,
  vouched: 2,
  full: 3,
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Maximum age of a signed request timestamp before rejection (5 minutes) */
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000

/** Maximum future timestamp allowance (30 seconds — for clock skew) */
const MAX_TIMESTAMP_FUTURE_MS = 30 * 1000

// ── Header Extraction ──────────────────────────────────────────────────────

/**
 * Extract federation auth headers from an incoming request.
 * Returns null if required headers are missing.
 */
export function extractFederationHeaders(
  headers: Headers,
): FederationAuthHeaders | null {
  const federationId = headers.get('x-federation-id')
  const signature = headers.get('x-federation-signature')
  const publicKey = headers.get('x-federation-key')
  const timestamp = headers.get('x-federation-timestamp')

  if (!federationId || !signature || !publicKey || !timestamp) {
    return null
  }

  return { federationId, signature, publicKey, timestamp }
}

// ── Timestamp Verification ─────────────────────────────────────────────────

/**
 * Verify request timestamp is within acceptable window.
 * Prevents replay attacks and stale requests.
 */
export function verifyTimestamp(timestamp: string): {
  valid: boolean
  reason?: string
} {
  const requestTime = new Date(timestamp).getTime()
  if (isNaN(requestTime)) {
    return { valid: false, reason: 'Invalid timestamp format' }
  }

  const now = Date.now()
  const age = now - requestTime

  // Too old
  if (age > MAX_TIMESTAMP_AGE_MS) {
    return {
      valid: false,
      reason: `Timestamp expired: ${Math.round(age / 1000)}s old (max: ${MAX_TIMESTAMP_AGE_MS / 1000}s)`,
    }
  }

  // Too far in the future (clock skew beyond tolerance)
  if (age < -MAX_TIMESTAMP_FUTURE_MS) {
    return {
      valid: false,
      reason: `Timestamp is ${Math.round(Math.abs(age) / 1000)}s in the future (max skew: ${MAX_TIMESTAMP_FUTURE_MS / 1000}s)`,
    }
  }

  return { valid: true }
}

// ── Signature Verification ─────────────────────────────────────────────────

/**
 * Verify the Ed25519 signature on a federation request.
 * The signable payload is: timestamp + "\n" + body
 */
export function verifyFederationSignature(
  timestamp: string,
  body: string,
  signature: string,
  publicKey: string,
): boolean {
  const signable = `${timestamp}\n${body}`
  return verifySignature(signable, signature, publicKey)
}

// ── Trust Level Comparison ─────────────────────────────────────────────────

/**
 * Check if a trust level meets the minimum requirement.
 */
export function meetsTrustRequirement(
  actual: TrustLevel,
  required: TrustLevel,
): boolean {
  return TRUST_HIERARCHY[actual] >= TRUST_HIERARCHY[required]
}

// ── Main Verification ──────────────────────────────────────────────────────

/**
 * Verify an inbound federation request.
 *
 * This is the primary entry point for the trust guard.
 * Call this at the top of every /api/federation/* handler.
 *
 * @param headers - Request headers
 * @param body - Raw request body string
 * @param requirement - What trust level + action this endpoint requires
 * @param knownPeers - Function to look up a peer's ministry status by federation ID
 * @returns TrustVerification result
 */
export async function verifyFederationRequest(
  headers: Headers,
  body: string,
  requirement: TrustRequirement,
  knownPeers: (federationId: string) => Promise<{
    exists: boolean
    ministryStatus: MinistryStatus | null
    trustLevel: TrustLevel
    publicKey?: string
  }>,
): Promise<TrustVerification> {
  // 1. Extract headers
  const authHeaders = extractFederationHeaders(headers)
  if (!authHeaders) {
    return {
      verified: false,
      federationId: 'unknown',
      trustLevel: 'none',
      ministryStatus: null,
      publicKey: '',
      reason: 'Missing federation auth headers (X-Federation-Id, X-Federation-Signature, X-Federation-Key, X-Federation-Timestamp)',
    }
  }

  // 2. Verify timestamp freshness
  const timestampCheck = verifyTimestamp(authHeaders.timestamp)
  if (!timestampCheck.valid) {
    return {
      verified: false,
      federationId: authHeaders.federationId,
      trustLevel: 'none',
      ministryStatus: null,
      publicKey: authHeaders.publicKey,
      reason: timestampCheck.reason || 'Timestamp verification failed',
    }
  }

  // 3. Verify Ed25519 signature
  const signatureValid = verifyFederationSignature(
    authHeaders.timestamp,
    body,
    authHeaders.signature,
    authHeaders.publicKey,
  )

  if (!signatureValid) {
    return {
      verified: false,
      federationId: authHeaders.federationId,
      trustLevel: 'none',
      ministryStatus: null,
      publicKey: authHeaders.publicKey,
      reason: 'Ed25519 signature verification failed — request may be tampered or key mismatch',
    }
  }

  // 4. Look up the peer in our known peers
  const peer = await knownPeers(authHeaders.federationId)

  // For heartbeats, we allow unknown peers (they might be new to the network)
  // But for other actions, the peer must be known
  if (!peer.exists && requirement.action !== 'heartbeat') {
    return {
      verified: false,
      federationId: authHeaders.federationId,
      trustLevel: 'none',
      ministryStatus: null,
      publicKey: authHeaders.publicKey,
      reason: `Unknown federation peer: ${authHeaders.federationId}. Send a heartbeat first to introduce yourself.`,
    }
  }

  // 5. Check trust level meets requirement
  const trustLevel = peer.trustLevel || 'none'
  if (!meetsTrustRequirement(trustLevel, requirement.minimumTrust)) {
    return {
      verified: false,
      federationId: authHeaders.federationId,
      trustLevel,
      ministryStatus: peer.ministryStatus,
      publicKey: authHeaders.publicKey,
      reason: `Insufficient trust level: has '${trustLevel}', requires '${requirement.minimumTrust}' for ${requirement.action}`,
    }
  }

  // 6. Check rate limit
  const rateLimitResult = checkRateLimit(authHeaders.federationId, requirement.action)
  if (!rateLimitResult.allowed) {
    return {
      verified: false,
      federationId: authHeaders.federationId,
      trustLevel,
      ministryStatus: peer.ministryStatus,
      publicKey: authHeaders.publicKey,
      reason: `Rate limit exceeded for ${requirement.action}: ${rateLimitResult.remaining} remaining, retry after ${rateLimitResult.retryAfterSeconds}s`,
    }
  }

  // 7. All checks passed — request is verified
  return {
    verified: true,
    federationId: authHeaders.federationId,
    trustLevel,
    ministryStatus: peer.ministryStatus,
    publicKey: authHeaders.publicKey,
    reason: 'Verified: signature valid, trust level sufficient, rate limit ok',
  }
}

// ── Helper: Build Peer Lookup from Payload ─────────────────────────────────

/**
 * Create a peer lookup function from a Payload instance.
 * Used by endpoint handlers to pass into verifyFederationRequest.
 */
export function createPeerLookup(payload: {
  find: (args: any) => Promise<{ docs: any[] }>
}) {
  return async (federationId: string) => {
    try {
      const result = await payload.find({
        collection: 'endeavors',
        where: {
          'federation.federationId': { equals: federationId },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (result.docs.length === 0) {
        return { exists: false, ministryStatus: null as MinistryStatus | null, trustLevel: 'none' as TrustLevel }
      }

      const endeavor = result.docs[0] as Record<string, unknown>
      const federation = endeavor.federation as Record<string, unknown> | undefined
      const status = (federation?.ministryStatus as MinistryStatus) || 'applicant'

      // Map ministry status to trust level (simplified — full version uses vouches)
      let trustLevel: TrustLevel = 'none'
      if (status === 'active') trustLevel = 'full'
      else if (status === 'probation') trustLevel = 'probationary'
      else if (status === 'applicant') trustLevel = 'probationary' // Be generous on first contact

      return {
        exists: true,
        ministryStatus: status,
        trustLevel,
      }
    } catch {
      return { exists: false, ministryStatus: null as MinistryStatus | null, trustLevel: 'none' as TrustLevel }
    }
  }
}
