/**
 * Account classification — pure logic behind the read-only account-audit and the
 * guarded cleanup. Buckets every user so we can SEE what the account pool is
 * before touching anything, and so cleanup can ONLY ever target the safe bucket.
 *
 * Test accounts are identified by an EMAIL CONVENTION (no schema column → no
 * migration/drift): anything `@test.angel-os.local`, or a `+test`/`+e2e` plus-tag.
 * Automated tests create accounts with these so they're isolated, recognizable,
 * and resettable without ever touching real users.
 */

export type AccountBucket = 'system' | 'founder' | 'test' | 'member' | 'orphan'

/** True when the email follows the reserved test-account convention. */
export function isTestEmail(email: string | null | undefined): boolean {
  const e = (email || '').trim().toLowerCase()
  if (!e) return false
  if (e.endsWith('@test.angel-os.local')) return true
  // plus-tag convention: foo+test@…, foo+e2e@…
  return /\+(?:test|e2e)[^@]*@/.test(e)
}

export interface AuditUser {
  id: number | string
  email?: string | null
  isSystemUser?: boolean | null
  roles?: string[] | null
}

/**
 * Classify one user. Precedence matters: system + founder are protected and win
 * first; then test; then membership (real member); else orphan (cleanup candidate).
 * `founderEmails` and `userIdsWithMembership` are precomputed by the caller so
 * this stays a pure, allocation-free decision.
 */
export function classifyAccount(
  user: AuditUser,
  founderEmails: Set<string>,
  userIdsWithMembership: Set<string>,
): AccountBucket {
  if (user.isSystemUser) return 'system'
  const email = (user.email || '').trim().toLowerCase()
  if (email && founderEmails.has(email)) return 'founder'
  // super_admin is always protected even if not in the static founder list.
  if (Array.isArray(user.roles) && user.roles.includes('super_admin')) return 'founder'
  if (isTestEmail(email)) return 'test'
  if (userIdsWithMembership.has(String(user.id))) return 'member'
  return 'orphan'
}

/** Buckets that must NEVER be auto-deleted. */
export const PROTECTED_BUCKETS: ReadonlySet<AccountBucket> = new Set<AccountBucket>(['system', 'founder', 'member'])

/** Only these buckets are eligible for cleanup. */
export function isCleanupEligible(bucket: AccountBucket): boolean {
  return bucket === 'orphan' || bucket === 'test'
}
