import type { Payload } from 'payload'
import { getJsonSetting, setJsonSetting } from '@/services/SettingService'

/**
 * Market membership — group merchant Endeavors under a PARENT "market" endeavor
 * (e.g. a farmers market) so the market has a front door and its merchants interlink
 * on Discovery (`/federation/discover?market=<parentSlug>`).
 *
 * Stored in the schema-drift-proof `settings` bag (NOT a new column on Endeavors) —
 * same pattern as federation-elections (#131). A new relationship field would risk a
 * prod schema rollout; the bag ships instantly with zero migration. See the Oqtane
 * Setting-spine direction + the schema-field-deploy footgun.
 *
 * Shape: per-parent `children` = string[] of child endeavor slugs; reverse `parent`
 * per-child for "which market am I in". Keyed by tenant SLUG (federation-stable).
 */

const ENTITY = 'market-membership'
const CHILDREN = 'children'
const PARENT = 'parent'

async function platformTenantId(payload: Payload): Promise<number | string> {
  try {
    const res = await payload.find({ collection: 'tenants', where: { type: { equals: 'platform' } }, limit: 1, depth: 0, overrideAccess: true })
    const id = (res.docs?.[0] as { id?: number | string } | undefined)?.id
    if (id != null) return id
  } catch { /* fall through */ }
  return 1 // platform tenant is the id-1 singleton
}

/** The merchant endeavor slugs linked under a market parent. */
export async function getMarketChildren(payload: Payload, parentSlug: string): Promise<string[]> {
  const tenantId = await platformTenantId(payload)
  const children = await getJsonSetting<string[]>(payload, { entityName: ENTITY, entityId: parentSlug, tenantId }, CHILDREN)
  return Array.isArray(children) ? children : []
}

/** The market parent slug a merchant is linked to, or null. */
export async function getEndeavorMarket(payload: Payload, childSlug: string): Promise<string | null> {
  const tenantId = await platformTenantId(payload)
  const parent = await getJsonSetting<string>(payload, { entityName: ENTITY, entityId: childSlug, tenantId }, PARENT)
  return typeof parent === 'string' && parent ? parent : null
}

/** Link a merchant endeavor under a market parent (idempotent, bi-directional). */
export async function linkEndeavorToMarket(payload: Payload, childSlug: string, parentSlug: string): Promise<{ children: string[] }> {
  const tenantId = await platformTenantId(payload)
  const current = await getMarketChildren(payload, parentSlug)
  const children = current.includes(childSlug) ? current : [...current, childSlug]
  await setJsonSetting(payload, { entityName: ENTITY, entityId: parentSlug, tenantId }, CHILDREN, children)
  await setJsonSetting(payload, { entityName: ENTITY, entityId: childSlug, tenantId }, PARENT, parentSlug)
  return { children }
}

/** Remove a merchant from a market parent (idempotent). */
export async function unlinkEndeavorFromMarket(payload: Payload, childSlug: string, parentSlug: string): Promise<{ children: string[] }> {
  const tenantId = await platformTenantId(payload)
  const children = (await getMarketChildren(payload, parentSlug)).filter((s) => s !== childSlug)
  await setJsonSetting(payload, { entityName: ENTITY, entityId: parentSlug, tenantId }, CHILDREN, children)
  if ((await getEndeavorMarket(payload, childSlug)) === parentSlug) {
    await setJsonSetting(payload, { entityName: ENTITY, entityId: childSlug, tenantId }, PARENT, '')
  }
  return { children }
}
