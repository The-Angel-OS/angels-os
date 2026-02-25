/**
 * Angel OS Federation Protocol
 *
 * Handles cryptographic constitution signing and federation registry pings.
 * Pure utility — zero Payload imports. Edge-safe for use in server actions.
 *
 * Uses Node.js built-in `crypto` (Ed25519) — no additional dependencies.
 *
 * Constitutional Reference: Article VII — "Constitution accepted → node is immediately live."
 */

import crypto from 'crypto'
import { getConstitutionText, getActiveConstitution } from './constitution'

// ── Types ──────────────────────────────────────────────────────────────────

export interface FederationKeyPair {
  publicKey: string  // hex-encoded SPKI DER (Ed25519 public key)
  privateKey: string // hex-encoded PKCS8 DER (Ed25519 private key — store encrypted!)
}

export interface ConstitutionSigningEvent {
  enterpriseName: string
  operatorName: string
  domain: string
  constitutionVersion: string
  constitutionChecksum: string // SHA-256 of canonical constitution text
  signedAt: string             // ISO 8601
  federationId: string         // UUID generated at signing time — immutable Enterprise identity
}

export interface ConstitutionSignature {
  event: ConstitutionSigningEvent
  signature: string  // hex-encoded Ed25519 signature over JSON.stringify(event)
  publicKey: string  // hex-encoded public key (so registry can verify)
}

export interface FederationRegistryPing {
  federationId: string
  enterpriseName: string
  domain: string
  endeavorType: string
  constitutionVersion: string
  constitutionSignature: string // hex-encoded signature from signing event
  publicKey: string
  pingAt: string
  capabilities: string[]
}

export interface FederationPingResult {
  success: boolean
  federationId?: string
  registryId?: string
  message: string
  ministryStatus?: 'applicant' | 'probation' | 'active'
}

// ── Key Generation ─────────────────────────────────────────────────────────

/**
 * Generate a new Ed25519 key pair for federation signing.
 * The private key MUST be stored encrypted via encryption.ts.
 */
export function generateFederationKeyPair(): FederationKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  })

  return {
    publicKey: (publicKey as unknown as Buffer).toString('hex'),
    privateKey: (privateKey as unknown as Buffer).toString('hex'),
  }
}

// ── Signing Primitives ─────────────────────────────────────────────────────

/**
 * Sign arbitrary data with an Ed25519 private key.
 * @param data - UTF-8 string to sign
 * @param privateKeyHex - hex-encoded PKCS8 DER private key
 * @returns hex-encoded Ed25519 signature
 */
export function signData(data: string, privateKeyHex: string): string {
  const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex')
  const keyObject = crypto.createPrivateKey({
    key: privateKeyBuffer,
    format: 'der',
    type: 'pkcs8',
  })
  const signature = crypto.sign(null, new Uint8Array(Buffer.from(data, 'utf8')), keyObject)
  return signature.toString('hex')
}

/**
 * Verify an Ed25519 signature.
 * @param data - UTF-8 string that was signed
 * @param signatureHex - hex-encoded signature
 * @param publicKeyHex - hex-encoded SPKI DER public key
 * @returns true if valid
 */
export function verifySignature(data: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex')
    const keyObject = crypto.createPublicKey({
      key: publicKeyBuffer,
      format: 'der',
      type: 'spki',
    })
    return crypto.verify(
      null,
      new Uint8Array(Buffer.from(data, 'utf8')),
      keyObject,
      new Uint8Array(Buffer.from(signatureHex, 'hex')),
    )
  } catch {
    return false
  }
}

// ── Constitution Signing ───────────────────────────────────────────────────

/**
 * Create the signing event payload.
 * Generates the federationId (immutable Enterprise identity in the network).
 */
export function createSigningPayload(
  opts: Omit<ConstitutionSigningEvent, 'federationId' | 'constitutionChecksum' | 'signedAt'>,
): ConstitutionSigningEvent {
  const constitution = getActiveConstitution()
  return {
    ...opts,
    constitutionChecksum: constitution.checksum,
    signedAt: new Date().toISOString(),
    federationId: crypto.randomUUID(),
  }
}

/**
 * Sign the Angel OS Constitution for an Enterprise.
 * @param event - signing event payload (from createSigningPayload)
 * @param privateKeyHex - hex-encoded PKCS8 DER private key
 * @returns ConstitutionSignature with event + signature + publicKey
 */
export function signConstitution(
  event: ConstitutionSigningEvent,
  privateKeyHex: string,
): ConstitutionSignature {
  // Sign the canonical JSON of the event (sorted keys for determinism)
  const payload = JSON.stringify(event, Object.keys(event).sort())
  const signature = signData(payload, privateKeyHex)

  // Derive public key from private key for convenience
  const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex')
  const privateKeyObj = crypto.createPrivateKey({
    key: privateKeyBuffer,
    format: 'der',
    type: 'pkcs8',
  })
  const publicKeyObj = crypto.createPublicKey(privateKeyObj)
  const publicKeyHex = publicKeyObj
    .export({ type: 'spki', format: 'der' })
    .toString('hex')

  return { event, signature, publicKey: publicKeyHex }
}

/**
 * Verify a ConstitutionSignature.
 * Used by the Flagship registry to validate incoming Enterprise pings.
 */
export function verifyConstitutionSignature(sig: ConstitutionSignature): boolean {
  const payload = JSON.stringify(sig.event, Object.keys(sig.event).sort())
  return verifySignature(payload, sig.signature, sig.publicKey)
}

// ── Federation Registry Ping ───────────────────────────────────────────────

/**
 * Send a federation registration ping to announce an Enterprise to the Angel OS network.
 * The ping payload is signed with the Enterprise's private key.
 *
 * Graceful degradation: if FEDERATION_REGISTRY_URL is not set, returns a stub
 * "registered locally" response. The wizard completes regardless.
 *
 * This function NEVER throws. All errors are caught and returned as failure results.
 */
export async function pingFederationRegistry(
  ping: FederationRegistryPing,
  privateKeyHex: string,
  registryUrl?: string,
): Promise<FederationPingResult> {
  const url = registryUrl ?? process.env.FEDERATION_REGISTRY_URL

  // No registry configured — stub response for local/self-hosted instances
  if (!url) {
    return stubRegistryResponse(ping.federationId, ping.enterpriseName)
  }

  try {
    // Sign the ping payload
    const pingPayload = JSON.stringify(ping, Object.keys(ping).sort())
    const pingSignature = signData(pingPayload, privateKeyHex)

    const body = JSON.stringify({
      ping,
      signature: pingSignature,
    })

    const response = await fetch(`${url}/api/federation/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Angel-OS-Version': '1.1',
      },
      body,
      // 10-second timeout — wizard should not hang on a slow registry
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return {
        success: false,
        federationId: ping.federationId,
        message: `Registry returned ${response.status}: ${text.slice(0, 120)}`,
        ministryStatus: 'applicant',
      }
    }

    const data = (await response.json()) as {
      registryId?: string
      ministryStatus?: 'applicant' | 'probation' | 'active'
      message?: string
    }

    return {
      success: true,
      federationId: ping.federationId,
      registryId: data.registryId,
      message: data.message ?? 'Enterprise registered. Welcome to the network.',
      ministryStatus: data.ministryStatus ?? 'applicant',
    }
  } catch (err) {
    // Network error, timeout, etc. — Enterprise is still "locally registered"
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      success: false,
      federationId: ping.federationId,
      message: `Registry unreachable — Enterprise registered locally. (${message})`,
      ministryStatus: 'applicant',
    }
  }
}

/**
 * Stub registry response for self-hosted instances without a central registry URL.
 * Used when FEDERATION_REGISTRY_URL is not set.
 */
export function stubRegistryResponse(
  federationId: string,
  enterpriseName: string,
): FederationPingResult {
  return {
    success: true,
    federationId,
    registryId: `local-${federationId.slice(0, 8)}`,
    message: `${enterpriseName} is live as a sovereign Enterprise. The registry will sync when the central node is reachable.`,
    ministryStatus: 'applicant',
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────

/**
 * Build the constitution signing introduction text shown to the operator before signing.
 * This is what Leo reads aloud (or displays) during wizard step 7.
 */
export function getConstitutionSigningIntroduction(enterpriseName: string): string {
  const constitution = getActiveConstitution()
  const text = getConstitutionText(constitution)

  return `
## The Angel OS Constitution — v${constitution.version}

${enterpriseName} is about to become a sovereign node in the Angel OS federation.

Before the Enterprise goes live, the operator must accept the Constitution.
This is not a terms-of-service checkbox. It is a covenant.

The Constitution commits this Enterprise to:
- Human dignity in every interaction
- No dark patterns, no surveillance capitalism, no algorithmic scoring of people
- The Toward-53 Principle: Endeavor owners always keep more over time
- The Suitcase Principle: data portability as a constitutional right
- Automatic federation: the Constitution is the gate, not a committee

The full text:

${text}

Constitution checksum: ${constitution.checksum.slice(0, 16)}...

If you accept, say "I accept the Angel OS Constitution on behalf of ${enterpriseName}."
  `.trim()
}
