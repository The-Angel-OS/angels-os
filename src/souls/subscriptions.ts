// src/souls/subscriptions.ts
//
// Work → endeavor availability. CONVERGED: the SINGLE source of truth is each
// soul's manifest — `canonical.endeavor` is the owner, `manifest.subscribers[]`
// are the additional carrying endeavors, `availableGlobally` = everywhere. There
// is no separate subscriptions map anymore (it was a third place that diverged
// from the manifests — e.g. rainmaker/answer53 owner disagreed).
//
// THE PLATFORM RULE: the Angel OS flagship (`platform`) is the universal INDEX —
// it carries EVERY Work ("echo up to the index"). So `platform` is an implicit
// subscriber to all; never list it in a manifest's `subscribers`.
//
// Keyed by tenant SLUG. Deploys to every node; a slug that doesn't exist on a
// given node is simply inert there. No DB, no schema change — by design.

import { getSoul } from './index'

/** The Angel OS flagship — the universal Work index. */
export const PLATFORM_INDEX = 'platform'

/** Default owner for a Work with no `canonical.endeavor`. */
export const DEFAULT_WORK_HOME = PLATFORM_INDEX

/** The canonical, editable home/OWNER endeavor for a Work (manifest-derived). */
export function homeForWork(workId: string): string {
  return getSoul(workId)?.canonical?.endeavor || DEFAULT_WORK_HOME
}

/** Additional carrying endeavors (manifest-derived). Platform is implicit, never listed. */
export function subscribersForWork(workId: string): string[] {
  return getSoul(workId)?.subscribers ?? []
}

/** Every endeavor (tenant slug) a Work is available on — owner + subscribers. */
export function tenantsForWork(workId: string): string[] {
  return Array.from(new Set([homeForWork(workId), ...subscribersForWork(workId)]))
}

/**
 * Is a Work available on a given tenant?
 *   - null/empty slug (super_admin / dev / no tenant) ⇒ unrestricted.
 *   - `availableGlobally` ⇒ everywhere (e.g. the Handbook).
 *   - the platform flagship indexes EVERY Work.
 *   - otherwise: owner or an explicit subscriber.
 */
export function isWorkAvailable(workId: string, tenantSlug?: string | null): boolean {
  if (!tenantSlug) return true
  if (getSoul(workId)?.availableGlobally) return true
  if (tenantSlug === PLATFORM_INDEX) return true // the flagship carries everything
  return tenantsForWork(workId).includes(tenantSlug)
}
