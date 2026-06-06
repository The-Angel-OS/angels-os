/**
 * ensureTenantDefaults — the single call that guarantees every tenant
 * has its full baseline space set. Idempotent; safe to call repeatedly.
 *
 * Every tenant needs three system spaces:
 *   1. AI Bus   (slug: ai-bus)       — LEO + errors + system-log + comms channels
 *   2. Main     (isMain: true)       — general + announcements + support
 *   3. DMs      (slug: direct-messages) — created on demand; ensured here
 *
 * This was the gap: provision-portal, provision-wdeg-portal, and the
 * ensure-spaces cron all created tenants/endeavors but only called
 * ensureTenantSpaces (a template Community space). ensureSystemSpace —
 * the function that creates the *actual* AI Bus with its channels — was
 * never called from the provisioning path, only lazily from inbound
 * webhook handlers. So WDEG and any other provisioned-before-this-fix
 * tenant had no AI Bus and no LEO channel.
 */
import { ensureSystemSpace, ensureDMSpace } from './ensureSystemSpace'
import { ensureMainSpace } from './ensureMainSpace'
import type { Payload } from 'payload'

export interface TenantDefaultsResult {
  aiBusSpaceId: string | undefined
  mainSpaceId: string | undefined
  dmSpaceId: string | undefined
  errors: string[]
}

export async function ensureTenantDefaults(
  payload: Payload,
  tenantId: number | string,
): Promise<TenantDefaultsResult> {
  const errors: string[] = []

  // 1. AI Bus — the operational heartbeat of the tenant. Must exist for
  //    LEO, error logging, system-log, and inbound comms to have a home.
  let aiBusSpaceId: string | undefined
  try {
    aiBusSpaceId = await ensureSystemSpace(tenantId)
  } catch (e) {
    errors.push(`AI Bus: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 2. Main community space — where members land, auto-joined on onboarding.
  let mainSpaceId: string | undefined
  try {
    const r = await ensureMainSpace(payload, tenantId)
    mainSpaceId = r?.spaceId
  } catch (e) {
    errors.push(`Main space: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 3. DM space — created on demand, but ensure it exists so the DM flow
  //    is ready without a lazy-create race on first message.
  let dmSpaceId: string | undefined
  try {
    dmSpaceId = await ensureDMSpace(tenantId)
  } catch (e) {
    errors.push(`DM space: ${e instanceof Error ? e.message : String(e)}`)
  }

  return { aiBusSpaceId, mainSpaceId, dmSpaceId, errors }
}
