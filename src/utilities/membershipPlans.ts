/**
 * membershipPlans — recurring plan definitions, in the schema-drift-proof settings
 * bag (no new column/table). A tenant's plans are a JSON array under entity
 * 'membership-plans'. The Memberships collection records actual subscriptions; this
 * is just the menu of what you can subscribe TO.
 *
 * @see src/collections/Memberships  @see src/services/SettingService
 */
import type { Payload } from 'payload'
import { getJsonSetting, setJsonSetting } from '@/services/SettingService'

export interface MembershipPlan {
  /** Stable id (slug-ish), referenced by Memberships.planId. */
  id: string
  name: string
  amountCents: number
  interval: 'month' | 'year'
  description?: string
  /** Hidden plans aren't offered on the public join surface but still bill. */
  active?: boolean
  /**
   * Plan kind. 'dues' (default) = memberships/subscriptions (card). 'rent' = a
   * lease: prefers the ACH rail and is surfaced as a lease in the renter portal.
   * @see docs/strategy/BOOKABLE_INVENTORY_PLAN.md
   */
  kind?: 'dues' | 'rent'
  /**
   * Platform application-fee % override for THIS plan (0 = fee-free). Admin-set
   * (plans are trusted, not renter-controlled). Falls back to
   * MEMBERSHIP_PLATFORM_FEE_PERCENT when undefined — e.g. the landlady's rent is
   * fee-free (0), gym dues use the default.
   */
  feePercent?: number
}

const ENTITY = 'membership-plans'
const ENTITY_ID = 'plans'
const SETTING = 'plans'

export async function getMembershipPlans(
  payload: Payload,
  tenantId: number | string,
): Promise<MembershipPlan[]> {
  const arr = await getJsonSetting<MembershipPlan[]>(
    payload,
    { entityName: ENTITY, entityId: ENTITY_ID, tenantId },
    SETTING,
  )
  return Array.isArray(arr) ? arr : []
}

export async function getMembershipPlan(
  payload: Payload,
  tenantId: number | string,
  planId: string,
): Promise<MembershipPlan | undefined> {
  const plans = await getMembershipPlans(payload, tenantId)
  return plans.find((p) => p.id === planId)
}

/** Upsert a single plan (by id). Returns the full list after the change. */
export async function upsertMembershipPlan(
  payload: Payload,
  tenantId: number | string,
  plan: MembershipPlan,
): Promise<MembershipPlan[]> {
  const plans = await getMembershipPlans(payload, tenantId)
  const idx = plans.findIndex((p) => p.id === plan.id)
  if (idx >= 0) plans[idx] = { ...plans[idx], ...plan }
  else plans.push({ active: true, ...plan })
  await setJsonSetting(payload, { entityName: ENTITY, entityId: ENTITY_ID, tenantId }, SETTING, plans)
  return plans
}

export async function removeMembershipPlan(
  payload: Payload,
  tenantId: number | string,
  planId: string,
): Promise<MembershipPlan[]> {
  const plans = (await getMembershipPlans(payload, tenantId)).filter((p) => p.id !== planId)
  await setJsonSetting(payload, { entityName: ENTITY, entityId: ENTITY_ID, tenantId }, SETTING, plans)
  return plans
}
