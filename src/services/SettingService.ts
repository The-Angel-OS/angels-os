/**
 * SettingService — the one way to read/write per-entity settings.
 *
 * Mirrors Oqtane's `ISettingService`: get the bag for an entity, get/set a single
 * setting, delete one. Values are stored as text (Oqtane convention); non-string
 * values are JSON-encoded transparently via the typed helpers.
 *
 * Always go through this service — it owns uniqueness (upsert by
 * tenant+entityName+entityId+settingName), the isPrivate read-gate, and coercion.
 * No collection-of-the-week reaches into `settings` directly.
 *
 * @see docs/architecture/OQTANE_SPINE.md  (Spine 3 — Settings)
 */
import type { Payload } from 'payload'

export interface SettingScope {
  entityName: string
  entityId: string | number
  /** Tenant scope. Required for writes; reads without it are not tenant-filtered. */
  tenantId?: string | number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPayload = Pick<Payload, 'find' | 'create' | 'update' | 'delete'> | any

interface SettingDoc {
  id: string | number
  settingName: string
  settingValue?: string | null
  isPrivate?: boolean | null
}

function buildWhere(scope: SettingScope, settingName?: string) {
  const and: Array<Record<string, unknown>> = [
    { entityName: { equals: scope.entityName } },
    { entityId: { equals: String(scope.entityId) } },
  ]
  if (scope.tenantId != null) and.push({ tenant: { equals: scope.tenantId } })
  if (settingName) and.push({ settingName: { equals: settingName } })
  return { and }
}

/**
 * All settings for an entity as a flat { name: value } map.
 * Private settings are withheld unless `includePrivate` is set (admin contexts).
 */
export async function getSettings(
  payload: AnyPayload,
  scope: SettingScope,
  opts: { includePrivate?: boolean } = {},
): Promise<Record<string, string>> {
  const res = await payload.find({
    collection: 'settings',
    where: buildWhere(scope),
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const out: Record<string, string> = {}
  for (const d of res.docs as SettingDoc[]) {
    if (d.isPrivate && !opts.includePrivate) continue
    out[d.settingName] = d.settingValue ?? ''
  }
  return out
}

/** A single setting's raw string value, or `defaultValue` (undefined) if absent. */
export async function getSetting(
  payload: AnyPayload,
  scope: SettingScope,
  settingName: string,
  defaultValue?: string,
): Promise<string | undefined> {
  const res = await payload.find({
    collection: 'settings',
    where: buildWhere(scope, settingName),
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = res.docs[0] as SettingDoc | undefined
  return doc?.settingValue ?? defaultValue
}

/** Upsert a single setting (unique by tenant+entityName+entityId+settingName). */
export async function setSetting(
  payload: AnyPayload,
  scope: SettingScope,
  settingName: string,
  settingValue: string,
  opts: { isPrivate?: boolean } = {},
): Promise<void> {
  if (scope.tenantId == null) {
    throw new Error('SettingService.setSetting requires a tenantId')
  }
  const existing = await payload.find({
    collection: 'settings',
    where: buildWhere(scope, settingName),
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = existing.docs[0] as SettingDoc | undefined
  const data = {
    entityName: scope.entityName,
    entityId: String(scope.entityId),
    settingName,
    settingValue,
    isPrivate: Boolean(opts.isPrivate),
    tenant: scope.tenantId,
  }
  if (doc) {
    await payload.update({
      collection: 'settings',
      id: doc.id,
      data,
      overrideAccess: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      overrideLock: true as any, // settings are high-write; never block on doc-locking
    })
  } else {
    await payload.create({ collection: 'settings', data, overrideAccess: true })
  }
}

/** Delete a single setting. No-op if absent. */
export async function deleteSetting(
  payload: AnyPayload,
  scope: SettingScope,
  settingName: string,
): Promise<void> {
  const existing = await payload.find({
    collection: 'settings',
    where: buildWhere(scope, settingName),
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = existing.docs[0] as SettingDoc | undefined
  if (doc) await payload.delete({ collection: 'settings', id: doc.id, overrideAccess: true })
}

// ── Typed convenience (values are stored as text) ──────────────────────────

export async function getBoolSetting(
  payload: AnyPayload,
  scope: SettingScope,
  settingName: string,
  defaultValue = false,
): Promise<boolean> {
  const v = await getSetting(payload, scope, settingName)
  if (v == null) return defaultValue
  return v === 'true' || v === '1'
}

export async function getNumberSetting(
  payload: AnyPayload,
  scope: SettingScope,
  settingName: string,
  defaultValue?: number,
): Promise<number | undefined> {
  const v = await getSetting(payload, scope, settingName)
  if (v == null || v === '') return defaultValue
  const n = Number(v)
  return Number.isNaN(n) ? defaultValue : n
}

/** Get a JSON-encoded setting, parsed. Returns `defaultValue` on absence/parse error. */
export async function getJsonSetting<T = unknown>(
  payload: AnyPayload,
  scope: SettingScope,
  settingName: string,
  defaultValue?: T,
): Promise<T | undefined> {
  const v = await getSetting(payload, scope, settingName)
  if (v == null) return defaultValue
  try {
    return JSON.parse(v) as T
  } catch {
    return defaultValue
  }
}

/** Set a JSON value (stringified). Pairs with getJsonSetting. */
export async function setJsonSetting(
  payload: AnyPayload,
  scope: SettingScope,
  settingName: string,
  value: unknown,
  opts: { isPrivate?: boolean } = {},
): Promise<void> {
  await setSetting(payload, scope, settingName, JSON.stringify(value), opts)
}
