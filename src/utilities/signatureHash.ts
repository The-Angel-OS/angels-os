/**
 * signatureHash — tamper-evidence for human e-signatures.
 *
 * Unlike the token ledger (a hash-LINKED chain), each signature is independently
 * tamper-evident: the stored hash binds the signer identity, the EXACT document
 * content (via its checksum), the moment of signing, and the signature payload
 * into one SHA-256. Re-hashing a stored signature and comparing reveals any later
 * edit to the signer, the document it covers, or the captured mark.
 *
 * The same canonical-field-order, numerics-coerced discipline as
 * src/utilities/tokenLedger.ts (hashes recomputed from a DB read must match the
 * one written at sign time).
 *
 * @see src/utilities/tokenLedger.ts
 */
import { createHash } from 'crypto'

export type SignatureType = 'typed' | 'drawn'

/** The fields that make a signature meaningful and that the hash must bind. */
export interface SignatureContent {
  /** Typed legal name OR the name accompanying a drawn mark. */
  signerName: string
  /** Payload user id of the signer, when authenticated. null for anonymous. */
  signerUserId?: string | number | null
  /** Stable reference to the signed thing, e.g. 'booking:42', 'agreement:tos-v3'. */
  documentRef: string
  /**
   * SHA-256 (or any stable digest) of the EXACT document text/terms the signer
   * agreed to. This is what makes the signature cover specific content — change
   * the terms after signing and the recomputed hash no longer matches.
   */
  documentChecksum: string
  /** 'typed' | 'drawn'. */
  signatureType: SignatureType
  /**
   * The captured mark: the typed string for 'typed', or the data-URL / stroke
   * payload for 'drawn'. Included so the hash also pins the visual signature.
   */
  signatureData: string
  /** ISO 8601 — injected (never Date.now here) so the hash is deterministic. */
  signedAt: string
}

/**
 * Canonical SHA-256 over a signature's content. Stable field order; values are
 * coerced to string so a DB-read row hashes identically to the freshly-built one.
 */
export function hashSignature(c: SignatureContent): string {
  const canonical = JSON.stringify([
    String(c.signerName),
    c.signerUserId == null ? null : String(c.signerUserId),
    String(c.documentRef),
    String(c.documentChecksum),
    String(c.signatureType),
    String(c.signatureData),
    String(c.signedAt),
  ])
  return createHash('sha256').update(canonical).digest('hex')
}

/** Convenience: checksum of an arbitrary document body (the terms being signed). */
export function checksumDocument(body: string): string {
  return createHash('sha256').update(String(body)).digest('hex')
}

/**
 * Re-derive the hash from a stored signature and compare. Returns true when the
 * signature is intact (signer, document, mark, and timestamp all unmodified).
 */
export function verifySignature(c: SignatureContent, storedHash: string): boolean {
  return hashSignature(c) === storedHash
}
