/**
 * workAttribution — who a Work belongs to, and where it lives.
 *
 * A Work (soul) declares its canonical endeavor + author in its manifest
 * (version-controlled default). This resolver lets an admin OVERRIDE that at
 * runtime via the generic Setting bag — so the Works control panel can reassign
 * attribution (e.g. credit a co-author, move a Work to a different endeavor)
 * without a code deploy. Override wins per-field; unset fields fall back to the
 * manifest. Dogfoods SettingService (the bag) keyed by the `work` entity.
 *
 * @see src/souls/index.ts (manifests)  @see src/services/SettingService.ts
 */
import type { Payload } from 'payload'
import { getSettings, setSetting } from '@/services/SettingService'
import { getSoul } from '@/souls'

/** Setting-bag entity name under which per-Work attribution overrides live. */
export const WORK_ENTITY = 'work'

export interface WorkAttribution {
  workId: string
  /** Publishing endeavor slug (the Work's canonical home / scope). */
  endeavor?: string
  /** Author of record — user email credited for the Work. */
  creditedTo?: string
  /** Whether the resolved value came from the manifest default or a runtime override. */
  source: 'manifest' | 'override'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPayload = Payload | any

/**
 * Resolve a Work's attribution: manifest default with any Setting-bag override
 * merged on top (per field). Returns null if the work id is unknown.
 */
export async function resolveWorkAttribution(
  payload: AnyPayload,
  workId: string,
  opts: { tenantId?: string | number } = {},
): Promise<WorkAttribution | null> {
  const soul = getSoul(workId)
  if (!soul) return null

  const manifest: { endeavor?: string; creditedTo?: string } = soul.canonical || {}
  let override: Record<string, string> = {}
  if (opts.tenantId != null) {
    try {
      override = await getSettings(payload, { entityName: WORK_ENTITY, entityId: workId, tenantId: opts.tenantId })
    } catch {
      override = {} // bag unavailable → manifest default
    }
  }

  const hasOverride = Boolean(override.endeavor || override.creditedTo)
  return {
    workId,
    endeavor: override.endeavor || manifest.endeavor,
    creditedTo: override.creditedTo || manifest.creditedTo,
    source: hasOverride ? 'override' : 'manifest',
  }
}

/** Write a runtime attribution override for a Work (admin-gated by the bag's access). */
export async function setWorkAttribution(
  payload: AnyPayload,
  workId: string,
  fields: { endeavor?: string; creditedTo?: string },
  opts: { tenantId: string | number },
): Promise<void> {
  const scope = { entityName: WORK_ENTITY, entityId: workId, tenantId: opts.tenantId }
  if (fields.endeavor != null) await setSetting(payload, scope, 'endeavor', fields.endeavor)
  if (fields.creditedTo != null) await setSetting(payload, scope, 'creditedTo', fields.creditedTo)
}
