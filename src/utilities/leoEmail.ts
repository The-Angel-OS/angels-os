/**
 * LEO system user email utilities.
 *
 * Extracted from seed-helpers so runtime endpoints (leo-chat, leo-stream,
 * suitcase-apply) can import without pulling in the entire seed module
 * — which Next.js Turbopack can't resolve via dynamic `import('./seed/…')`.
 */

const SYSTEM_EMAIL_DOMAIN = 'system.spacesangels.com'

/**
 * Canonical email address for a tenant's LEO agent.
 */
export function leoSystemUserEmail(tenantSlug: string): string {
  return `leo-${tenantSlug}@${SYSTEM_EMAIL_DOMAIN}`
}

/**
 * Legacy email pattern (pre-migration). Used as fallback when looking up
 * LEO agents that haven't been migrated yet.
 */
export function leoLegacyEmail(tenantSlug: string): string {
  return `leo-${tenantSlug}@system.angelos.local`
}
