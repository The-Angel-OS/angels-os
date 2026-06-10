/**
 * Federated Identity — a stable, GLOBAL identifier for a person across every
 * Angel OS node, without any central authority or schema change.
 *
 * The problem: kendev and spacesangels are separate databases. The same person
 * (kenneth.courtney@gmail.com) exists as a different user row on each, reconciled
 * only by email. Once portals replicate and share fulfillment economics, "who did
 * what / who gets paid" must resolve to the SAME identity on every node.
 *
 * The solution: derive the identity DETERMINISTICALLY from the normalized email.
 * Every node computes the identical id independently — no coordination, no token
 * exchange, no stored column to drift. It is a pure function of email, so it's
 * exposed as a VIRTUAL field on Users (computed on read, never persisted).
 *
 * This is the lightweight "global identity claim" — NOT cross-server SSO (sessions
 * still live per node). It makes the mesh coherent about identity; SSO is roadmap.
 */
import crypto from 'crypto'

/** Versioned namespace — bump only if the derivation scheme must change. */
const NAMESPACE = 'angel-os:federated-identity:v1'

/** Normalize an email for stable hashing: trimmed + lowercased. */
export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase()
}

/**
 * Compute the deterministic global identity id for an email.
 * Formatted as a UUID-shaped string (8-4-4-4-12) derived from SHA-256, so it
 * reads like a stable global id. Same email → same id on every node, forever.
 * Returns '' for an empty/invalid email (no identity to derive).
 */
export function computeFederatedIdentityId(email: string): string {
  const norm = normalizeEmail(email)
  if (!norm || !norm.includes('@')) return ''
  const h = crypto.createHash('sha256').update(`${NAMESPACE}:${norm}`).digest('hex')
  // UUID-shaped (version nibble pinned to 5 = name-based, variant to 8) for readability.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}
