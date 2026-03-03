/**
 * Federated AI Bus — Cross-Tenant Messaging over HTTPS with JWT-Signed Payloads
 *
 * The federation's nervous system. LEO can talk to LEO across enterprise
 * boundaries using Ed25519-signed JWTs with 5-minute TTL.
 *
 * JWT Claims:
 *   iss  — sender federation ID
 *   aud  — receiver domain
 *   sub  — conversation ID (or 'direct')
 *   iat  — issued at
 *   exp  — 5 min TTL
 *   jti  — unique message ID (for dedup)
 *   msg  — message text
 *
 * Uses existing federation key pairs from keyStore.ts (Ed25519, PKCS8/SPKI DER hex).
 *
 * @see src/federation/keyStore.ts — Key management
 * @see src/federation/protocol.ts — Signing primitives
 * @see src/endpoints/federation-message.ts — Receiver endpoint
 */

import { SignJWT, jwtVerify, type JWTPayload, type KeyObject } from 'jose'
import crypto from 'crypto'
import { getOrCreateFederationKeyPair } from '@/federation/keyStore'
import { withRetry, isRetryableStatus } from '@/utilities/outboundRetry'
import type { Payload } from 'payload'

// ── Key Conversion (hex-encoded DER ↔ Node.js KeyObject) ────────────────────
//
// jose v6 accepts Node.js KeyObject directly for EdDSA signing/verification.
// We convert hex-encoded DER (from keyStore.ts) to KeyObject via crypto module.

/** Convert hex-encoded PKCS8 DER private key to KeyObject for signing */
export function importPrivateKey(hexDer: string): KeyObject {
  return crypto.createPrivateKey({
    key: Buffer.from(hexDer, 'hex'),
    format: 'der',
    type: 'pkcs8',
  })
}

/** Convert hex-encoded SPKI DER public key to KeyObject for verification */
export function importPublicKey(hexDer: string): KeyObject {
  return crypto.createPublicKey({
    key: Buffer.from(hexDer, 'hex'),
    format: 'der',
    type: 'spki',
  })
}

// ── JWT Types ────────────────────────────────────────────────────────────────

export interface FederatedMessageClaims extends JWTPayload {
  msg: string
  conversationId?: string
  senderName?: string
  senderDomain?: string
}

export interface VerifiedFederatedMessage {
  /** Sender's federation ID (from JWT `iss`) */
  federationId: string
  /** Receiver domain (from JWT `aud`) */
  audience: string
  /** Message text */
  message: string
  /** Conversation thread ID */
  conversationId?: string
  /** Sender's display name */
  senderName?: string
  /** Sender's domain */
  senderDomain?: string
  /** Unique message ID for dedup (from JWT `jti`) */
  jti: string
  /** When the message was issued (epoch seconds) */
  issuedAt: number
}

// ── JWT Creation ─────────────────────────────────────────────────────────────

export interface CreateJWTOptions {
  message: string
  conversationId?: string
  senderFederationId: string
  senderName?: string
  senderDomain?: string
  receiverDomain: string
  privateKey: KeyObject
}

/**
 * Create a signed JWT for cross-tenant messaging.
 * TTL: 5 minutes. Algorithm: EdDSA (Ed25519).
 */
export async function createFederatedMessageJWT(opts: CreateJWTOptions): Promise<string> {
  const {
    message,
    conversationId,
    senderFederationId,
    senderName,
    senderDomain,
    receiverDomain,
    privateKey,
  } = opts

  return new SignJWT({
    msg: message,
    ...(conversationId && { conversationId }),
    ...(senderName && { senderName }),
    ...(senderDomain && { senderDomain }),
  } satisfies Partial<FederatedMessageClaims>)
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuer(senderFederationId)
    .setAudience(receiverDomain)
    .setSubject(conversationId || 'direct')
    .setIssuedAt()
    .setExpirationTime('5m')
    .setJti(crypto.randomUUID())
    .sign(privateKey)
}

// ── JWT Verification ─────────────────────────────────────────────────────────

/**
 * Verify a federation message JWT against a known public key.
 * Checks: signature, expiry, audience, required claims (iss, jti, msg).
 */
export async function verifyFederatedMessageJWT(
  jwt: string,
  publicKey: KeyObject,
  expectedAudience: string,
): Promise<VerifiedFederatedMessage> {
  const { payload } = await jwtVerify(jwt, publicKey, {
    audience: expectedAudience,
    algorithms: ['EdDSA'],
  })

  const claims = payload as FederatedMessageClaims

  if (!payload.iss) throw new Error('Missing iss (federation ID)')
  if (!payload.jti) throw new Error('Missing jti (message ID)')
  if (!claims.msg) throw new Error('Missing msg (message text)')

  return {
    federationId: payload.iss,
    audience:
      typeof payload.aud === 'string' ? payload.aud : Array.isArray(payload.aud) ? payload.aud[0] : '',
    message: claims.msg,
    conversationId: claims.conversationId,
    senderName: claims.senderName,
    senderDomain: claims.senderDomain,
    jti: payload.jti,
    issuedAt: payload.iat || 0,
  }
}

// ── Trust Levels (mirrored from federationEngine for pure-function use) ──────

export const TRUST_LEVELS = ['none', 'probationary', 'vouched', 'full'] as const
export type TrustLevel = (typeof TRUST_LEVELS)[number]

/** Minimum trust level required for cross-tenant messaging */
export const MINIMUM_MESSAGE_TRUST: TrustLevel = 'vouched'

/** Check if a trust level meets the minimum threshold */
export function meetsMinimumTrust(level: TrustLevel, minimum: TrustLevel = MINIMUM_MESSAGE_TRUST): boolean {
  return TRUST_LEVELS.indexOf(level) >= TRUST_LEVELS.indexOf(minimum)
}

/** Map ministry status to trust level */
export function statusToTrustLevel(status: string | undefined | null): TrustLevel {
  switch (status) {
    case 'active':
      return 'full'
    case 'probation':
      return 'vouched'
    case 'applicant':
      return 'probationary'
    default:
      return 'none'
  }
}

// ── Send Message ─────────────────────────────────────────────────────────────

export interface SendFederatedMessageResult {
  success: boolean
  response?: string
  responseJwt?: string
  error?: string
  peerDomain: string
}

/**
 * Send a signed federation message to a peer domain.
 *
 * Flow:
 * 1. Get our Ed25519 key pair
 * 2. Get our federation identity (from endeavor)
 * 3. Create signed JWT with 5-minute TTL
 * 4. POST to peer's /api/federation/message with retry
 */
export async function sendFederatedMessage(
  payloadCms: Payload,
  fromTenantId: number | string,
  peerDomain: string,
  message: string,
  conversationId?: string,
): Promise<SendFederatedMessageResult> {
  try {
    // 1. Get our key pair
    const keyPair = await getOrCreateFederationKeyPair(payloadCms, Number(fromTenantId))

    // 2. Get our federation identity
    const endeavors = await payloadCms.find({
      collection: 'endeavors',
      where: { tenant: { equals: fromTenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const endeavor = endeavors.docs?.[0] as any
    const federationId = endeavor?.federation?.federationId
    const senderName = endeavor?.name || 'Unknown'
    const senderDomain = endeavor?.federation?.domain || ''

    if (!federationId) {
      return { success: false, error: 'No federation identity configured', peerDomain }
    }

    // 3. Create signed JWT
    const privateKey = importPrivateKey(keyPair.privateKey)
    const jwt = await createFederatedMessageJWT({
      message,
      conversationId,
      senderFederationId: federationId,
      senderName,
      senderDomain,
      receiverDomain: peerDomain,
      privateKey,
    })

    // 4. Send to peer with retry and timeout protection
    const FEDERATION_SEND_TIMEOUT_MS = 15_000 // 15 second timeout per attempt
    const url = `https://${peerDomain}/api/federation/message`
    const response = await withRetry(
      async () => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), FEDERATION_SEND_TIMEOUT_MS)
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jwt, publicKey: keyPair.publicKey }),
            signal: controller.signal,
          })
          if (!res.ok) {
            const errorBody = await res.text().catch(() => '')
            const err = new Error(`HTTP ${res.status}: ${errorBody}`) as any
            err.status = res.status
            throw err
          }
          return res
        } finally {
          clearTimeout(timeout)
        }
      },
      {
        maxAttempts: 3,
        isRetryable: (err: unknown) => {
          if (err instanceof TypeError) return true // network error
          if (err instanceof DOMException && err.name === 'AbortError') return true // timeout
          const status = (err as any)?.status
          if (typeof status === 'number') return isRetryableStatus(status)
          return false
        },
      },
    )

    const responseBody = await response.json().catch(() => ({}))

    return {
      success: true,
      response: responseBody.response || responseBody.message,
      responseJwt: responseBody.jwt,
      peerDomain,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      peerDomain,
    }
  }
}
