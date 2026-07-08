/**
 * billingMode — how an endeavor collects membership/subscription money.
 *
 *   'platform-direct' (DEFAULT) — the endeavor is FIRST-PARTY (yours): the charge
 *      runs on the PLATFORM Stripe, the money is the platform's, no Connect, no
 *      transfer, nothing to settle. Same path the Guardian Angel sub uses.
 *   'connect' — the endeavor is THIRD-PARTY (an outside church/gym with its own
 *      bank): a destination charge transfers their share to their connected
 *      account and the platform keeps an application fee. Stripe settles them.
 *
 * Default is platform-direct so YOUR portals (Clearwater, KenDev, ministries) bill
 * up to the Angel OS root with ZERO config — config-free for the 99%. Connect is
 * opt-in, only when a genuine outside party onboards their own payouts.
 *
 * Stored in the schema-drift-proof settings bag (no new column). See [[billing]].
 * @see src/endpoints/membership-checkout.ts  @see src/services/SettingService
 */
import type { Payload } from 'payload'
import { getJsonSetting, setJsonSetting } from '@/services/SettingService'

export type BillingMode = 'platform-direct' | 'connect'

const ENTITY = 'billing'
const ENTITY_ID = 'config'
const SETTING = 'mode'

export async function getBillingMode(
  payload: Payload,
  tenantId: number | string,
): Promise<BillingMode> {
  const v = await getJsonSetting<BillingMode>(
    payload,
    { entityName: ENTITY, entityId: ENTITY_ID, tenantId },
    SETTING,
  )
  // Anything not explicitly 'connect' → platform-direct (the safe first-party default).
  return v === 'connect' ? 'connect' : 'platform-direct'
}

export async function setBillingMode(
  payload: Payload,
  tenantId: number | string,
  mode: BillingMode,
): Promise<BillingMode> {
  await setJsonSetting(payload, { entityName: ENTITY, entityId: ENTITY_ID, tenantId }, SETTING, mode)
  return mode
}
