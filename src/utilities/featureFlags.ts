/**
 * featureFlags — typed feature flags over the generic Setting bag.
 *
 * The first real consumer of SettingService (Oqtane Spine 3). Flags are
 * TENANT-SCOPED key/value entries in the `settings` collection under the
 * `feature-flags` entity; an unset flag falls back to the caller's code default.
 * This is the schema-drift-proof home for runtime config that should NOT each
 * become its own column (payment mode, rollout ramps, kill-switches, …).
 *
 * Setting a flag requires admin write access to the bag, so the WRITE itself is
 * the gate — no separate env opt-in needed. Reads are cheap and default-safe.
 *
 * @see src/services/SettingService.ts  @see docs/architecture/OQTANE_SPINE.md
 */
import type { Payload } from 'payload'
import { getSetting, setSetting, type SettingScope } from '@/services/SettingService'

/** Entity name under which all feature flags live in the Setting bag. */
export const FLAG_ENTITY = 'feature-flags'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPayload = Payload | any

function scope(tenantId: string | number): SettingScope {
  // One bag row-set per tenant; entityId is fixed since the tenant IS the scope.
  return { entityName: FLAG_ENTITY, entityId: 'flags', tenantId }
}

/** A flag's string value, or the code default. Global (no tenantId) → default. */
export async function getFlag(
  payload: AnyPayload,
  name: string,
  opts: { tenantId?: string | number; defaultValue?: string } = {},
): Promise<string | undefined> {
  if (opts.tenantId == null) return opts.defaultValue
  const v = await getSetting(payload, scope(opts.tenantId), name)
  return v ?? opts.defaultValue
}

export async function getBoolFlag(
  payload: AnyPayload,
  name: string,
  opts: { tenantId?: string | number; defaultValue?: boolean } = {},
): Promise<boolean> {
  const v = await getFlag(payload, name, { tenantId: opts.tenantId })
  if (v == null || v === '') return opts.defaultValue ?? false
  return v === 'true' || v === '1'
}

export async function getJsonFlag<T = unknown>(
  payload: AnyPayload,
  name: string,
  opts: { tenantId?: string | number; defaultValue?: T } = {},
): Promise<T | undefined> {
  const v = await getFlag(payload, name, { tenantId: opts.tenantId })
  if (v == null) return opts.defaultValue
  try {
    return JSON.parse(v) as T
  } catch {
    return opts.defaultValue
  }
}

/** Upsert a flag for a tenant. Caller must be admin (enforced by the bag's access). */
export async function setFlag(
  payload: AnyPayload,
  name: string,
  value: string,
  opts: { tenantId: string | number; isPrivate?: boolean },
): Promise<void> {
  await setSetting(payload, scope(opts.tenantId), name, value, { isPrivate: opts.isPrivate })
}
