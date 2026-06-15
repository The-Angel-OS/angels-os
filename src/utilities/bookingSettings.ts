/**
 * bookingSettings — per-tenant booking config in the schema-drift-proof settings bag
 * (no new column/table). Currently holds the payment mode: how a booking is settled.
 *
 *   - 'deposit' : charge a deposit online up front (requires Stripe Connect)
 *   - 'cod'     : take the booking as a REQUEST; the owner collects on completion
 *                 (cash on delivery, check, Zelle — for trades like an electrician)
 *
 * Default when unset is computed at the call site: deposit when Connect is enabled,
 * otherwise cod — so a portal with no payments configured still takes bookings.
 *
 * @see src/services/SettingService  @see src/endpoints/booking-checkout.ts
 */
import type { Payload } from 'payload'
import { getJsonSetting, setJsonSetting } from '@/services/SettingService'

export type BookingPaymentMode = 'deposit' | 'cod'

const ENTITY = 'booking-settings'
const ENTITY_ID = 'settings'
const SETTING = 'paymentMode'

export async function getBookingPaymentMode(
  payload: Payload,
  tenantId: number | string,
): Promise<BookingPaymentMode | null> {
  const v = await getJsonSetting<BookingPaymentMode>(
    payload,
    { entityName: ENTITY, entityId: ENTITY_ID, tenantId },
    SETTING,
  )
  return v === 'deposit' || v === 'cod' ? v : null
}

export async function setBookingPaymentMode(
  payload: Payload,
  tenantId: number | string,
  mode: BookingPaymentMode,
): Promise<void> {
  await setJsonSetting(payload, { entityName: ENTITY, entityId: ENTITY_ID, tenantId }, SETTING, mode)
}
