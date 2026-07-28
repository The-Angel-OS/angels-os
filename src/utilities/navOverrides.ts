/**
 * Nav overrides — the small editable layer on top of a fully DERIVED menu.
 *
 * The menu configures itself from what the endeavor actually has: Shop appears
 * when there are published products, Posts when there are posts, Book when a
 * service is enabled, Join when a membership plan exists, Discovery from the
 * Endeavor's network-visible flag. Adding a product IS the toggle. A settings
 * screen mirroring those signals would be a second source of truth for the same
 * fact, and the menu would then be wrong in two places instead of one.
 *
 * So this holds only what derivation genuinely cannot know — an owner's
 * intent:
 *   • hidden  — "I have this, but don't advertise it"
 *   • pinned  — "keep this up front regardless of the inline cap"
 *   • maxInline — how many items ride the top bar before the rest collapse
 *
 * Stored in the schema-free `settings` bag (same mechanism as membership plans),
 * so there is no migration and LEO can edit it with the tools it already has.
 */
import type { Payload } from 'payload'
import { getJsonSetting, setJsonSetting } from '@/services/SettingService'

export interface NavOverrides {
  /** URLs never shown, e.g. ['/shop'] on a portal that sells but doesn't advertise it. */
  hidden: string[]
  /** URLs kept in the primary bar regardless of the inline cap. */
  pinned: string[]
  /** Items inline before the rest collapse into "More". */
  maxInline?: number
  /** Drop the "More" overflow entirely — a single-product storefront has no
   *  Events to advertise, Book is empty, and Dashboard already lives in the
   *  user menu, so "More" opens onto things the visitor doesn't need. Desktop
   *  only: the mobile drawer still lists everything. */
  hideMore?: boolean
}

const ENTITY = 'nav-overrides'
const ENTITY_ID = 'nav'
const SETTING = 'overrides'

export const EMPTY_NAV_OVERRIDES: NavOverrides = { hidden: [], pinned: [] }

/** Normalize whatever is in the bag — hand-edited settings shouldn't crash a nav. */
export function normalizeNavOverrides(raw: unknown): NavOverrides {
  const o = (raw ?? {}) as Partial<NavOverrides>
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.length > 0) : []
  const max = Number(o.maxInline)
  return {
    hidden: list(o.hidden),
    pinned: list(o.pinned),
    ...(Number.isFinite(max) && max > 0 ? { maxInline: Math.floor(max) } : {}),
    ...(o.hideMore ? { hideMore: true } : {}),
  }
}

export async function getNavOverrides(
  payload: Payload,
  tenantId: number | string,
): Promise<NavOverrides> {
  const raw = await getJsonSetting<NavOverrides>(
    payload,
    { entityName: ENTITY, entityId: ENTITY_ID, tenantId },
    SETTING,
  )
  return normalizeNavOverrides(raw)
}

export async function setNavOverrides(
  payload: Payload,
  tenantId: number | string,
  next: Partial<NavOverrides>,
): Promise<NavOverrides> {
  const merged = normalizeNavOverrides({ ...(await getNavOverrides(payload, tenantId)), ...next })
  await setJsonSetting(payload, { entityName: ENTITY, entityId: ENTITY_ID, tenantId }, SETTING, merged)
  return merged
}

/**
 * Apply overrides to a derived nav. Hidden wins over pinned — an owner who says
 * "don't show this" means it, even if it was pinned earlier and forgotten.
 */
export function applyNavOverrides<T extends { link?: { url?: string | null } | null }>(
  items: T[],
  overrides: NavOverrides,
): { items: T[]; pinned: string[]; maxInline?: number; hideMore?: boolean } {
  const hidden = new Set(overrides.hidden)
  const kept = items.filter((i) => !hidden.has(i?.link?.url ?? ''))
  return {
    items: kept,
    pinned: overrides.pinned.filter((u) => !hidden.has(u)),
    ...(overrides.maxInline ? { maxInline: overrides.maxInline } : {}),
    ...(overrides.hideMore ? { hideMore: true } : {}),
  }
}
