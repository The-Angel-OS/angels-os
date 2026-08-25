/**
 * Works availability — the pure rules, kept free of any Payload import so they
 * are unit-testable without booting the CMS. The DB read lives in ./registry.
 */

/** The Angel OS flagship — the universal Work index. */
export const PLATFORM_INDEX = 'platform'

/** Default owner for a Work with no owner set. */
export const DEFAULT_WORK_HOME = PLATFORM_INDEX

export interface WorkDoc {
  id: string
  filename?: string
  title: string
  date: string
  description: string
  badge?: string | null
  badgeColor?: string | null
  tier: string
  image?: string | null
}

/** A Work as the reader surfaces consume it (the old SoulManifest shape). */
export interface WorkRecord {
  id: string
  title: string
  subtitle: string
  description: string
  status: string
  statusColor: string
  tags: string[]
  defaultDoc: string
  docs: WorkDoc[]
  links: { label: string; url: string }[]
  canonical?: { origin?: string; endeavor?: string; creditedTo?: string; contributors?: string[] }
  owner: string
  subscribers: string[]
  availableGlobally: boolean
  /** Tenant slugs that switched this Work OFF for their portal. */
  optOuts: string[]
  published: boolean
  /** Storage-of-record pointer: { kind, space, channel, languages?, baseLanguage? }. */
  storageRef?: { kind?: string; space?: number; channel?: string; baseLanguage?: string; languages?: unknown }
  /** Set on paged books → the reader renders <BookReader>. Equals the slug. */
  bookSlug?: string
}

/**
 * Payload array fields arrive as `[{ tag: 'book' }]`; the reader contract has
 * always been `['book']`. These absorb the storage change so nothing downstream
 * of the registry had to learn about it. Tolerant of the old flat JSON shape too,
 * so a rolled-back deploy still reads its own data.
 */
export function tagList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => (typeof x === 'string' ? x : (x as { tag?: unknown })?.tag))
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
}

export function linkList(v: unknown): { label: string; url: string }[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => x as { label?: unknown; url?: unknown })
    .filter((x) => typeof x?.label === 'string' && typeof x?.url === 'string')
    .map((x) => ({ label: x.label as string, url: x.url as string }))
}

/** The write direction: `['book']` → `[{ tag: 'book' }]` for the array field. */
export function tagRows(v: unknown): { tag: string }[] {
  return tagList(v).map((tag) => ({ tag }))
}

/** The canonical, editable home/OWNER endeavor for a Work. */
export function homeForWork(work: WorkRecord | null): string {
  return work?.owner || DEFAULT_WORK_HOME
}

/** Every endeavor (tenant slug) a Work is available on — owner + subscribers. */
export function tenantsForWork(work: WorkRecord): string[] {
  return Array.from(new Set([homeForWork(work), ...work.subscribers]))
}

/**
 * Is a Work available on a given tenant?
 *   - null/empty slug (super_admin / dev / no tenant) ⇒ unrestricted.
 *   - the OWNER always carries its own Work.
 *   - an explicit opt-out wins over everything else — that is how a portal owner
 *     switches OFF a Work that is offered to every portal.
 *   - `availableGlobally` ⇒ offered everywhere (e.g. the Handbook).
 *   - the platform flagship indexes EVERY Work.
 *   - otherwise: an explicit subscriber.
 */
export function isWorkAvailable(work: WorkRecord | null, tenantSlug?: string | null): boolean {
  if (!work) return false
  if (!tenantSlug) return true
  if (tenantSlug === homeForWork(work)) return true
  if (work.optOuts.includes(tenantSlug)) return false
  if (work.availableGlobally) return true
  if (tenantSlug === PLATFORM_INDEX) return true
  return work.subscribers.includes(tenantSlug)
}

