// src/souls/subscriptions.ts
//
// Work → tenant scoping. Works (souls) are file-based and ship in code to EVERY
// node, so without this they appear on every tenant/endeavor. This registry is
// the explicit "which endeavors carry which Work" map — the source of truth for
// availability (and the canonical EDITABLE home, for the editor that comes next).
//
// Keyed by tenant SLUG. `home` = the canonical/editable endeavor; `subscribers`
// = additional endeavors that carry a (read-only) copy. A Work is available on a
// tenant iff that tenant's slug is its home or in its subscribers.
//
// Cross-node note: this list deploys to both nodes. A slug that doesn't exist on
// a given node (e.g. `kendev` on the platform node) is simply inert there — each
// node only ever resolves its own tenants. So one registry covers the whole
// federation.
//
// No DB, no schema change — deliberately. (See the schema-rollout footgun: a new
// column/collection without the prod migration FIRST is a site-wide outage.)
// When the editor lands, this seeds a DB/Settings-backed subscription table.

export interface WorkSubscription {
  /** Canonical, editable home endeavor (tenant slug). */
  home: string
  /** Additional endeavors that carry a copy (tenant slugs). */
  subscribers?: string[]
}

/** Default home for an unmapped Work — Angel OS platform, NOT "everywhere". */
export const DEFAULT_WORK_HOME = 'platform'

/**
 * Catch-all endeavors that display EVERY Work (current and future), regardless of
 * per-work subscription. Clearwater Cruisin is the library catch-all.
 */
export const CATCH_ALL_TENANTS = new Set<string>(['clearwater-cruisin'])

export const WORK_SUBSCRIPTIONS: Record<string, WorkSubscription> = {
  // WDEG — its own endeavor.
  wdeg: { home: 'wheredideveryonego' },
  // Answer 53 & The Rainmaker — Angel OS.
  answer53: { home: 'platform' },
  rainmaker: { home: 'platform' },
  // Ready Player Everyone — Angel OS + Clearwater Cruisin + the federation node.
  'ready-player-everyone': { home: 'platform', subscribers: ['clearwater-cruisin', 'kendev'] },
  // GPT Psychosis (The Poster Child) — Clearwater Cruisin + Angel OS.
  'gpt-psychosis': { home: 'clearwater-cruisin', subscribers: ['platform'] },
}

/** The endeavors (tenant slugs) a Work is available on. Unmapped ⇒ default home. */
export function tenantsForWork(workId: string): string[] {
  const sub = WORK_SUBSCRIPTIONS[workId]
  if (!sub) return [DEFAULT_WORK_HOME]
  return Array.from(new Set([sub.home, ...(sub.subscribers ?? [])]))
}

/** The canonical, editable home endeavor for a Work. */
export function homeForWork(workId: string): string {
  return WORK_SUBSCRIPTIONS[workId]?.home ?? DEFAULT_WORK_HOME
}

/**
 * Is a Work available on a given tenant? A null/empty slug means "unscoped
 * context" (super_admin / dev / no tenant resolved) → unrestricted, so the
 * Library still works where there's no tenant to filter by.
 */
export function isWorkAvailable(workId: string, tenantSlug?: string | null): boolean {
  if (!tenantSlug) return true
  if (CATCH_ALL_TENANTS.has(tenantSlug)) return true
  return tenantsForWork(workId).includes(tenantSlug)
}
