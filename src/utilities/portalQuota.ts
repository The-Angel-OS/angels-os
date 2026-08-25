/**
 * portalQuota — how many portals one person may hold, enforced in ONE place:
 * provisionPortal, which clone_portal, demo-site, the LEO create-portal tool and
 * the claim flow all funnel through. Guarding there rather than at each call
 * site is the difference between a rule and three rules.
 *
 * super_admin bypasses — which is exactly why this needs a test rather than a
 * manual check: Ken will never see it fire.
 *
 * @see src/utilities/portalPlan.ts — PORTAL_QUOTA, the allowance per plan
 */
import type { Payload } from 'payload'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { planOf, portalQuotaFor, type PortalPlan } from '@/utilities/portalPlan'

export interface PortalQuotaState {
  used: number
  quota: number
  overQuota: boolean
  /** Best plan the person holds — what an upgrade would move up FROM. */
  plan: PortalPlan
}

/**
 * Portals this person OWNS (tenant_admin), and what their plans entitle them to.
 * Counting admin memberships rather than tenants means a portal someone merely
 * belongs to never eats their allowance.
 */
export async function getPortalQuota(
  payload: Payload,
  userId: number | string,
): Promise<PortalQuotaState> {
  const memberships = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { user: { equals: userId } },
        { role: { equals: 'tenant_admin' } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 0,
    pagination: false,
    depth: 1,
    overrideAccess: true,
  })

  const plans: PortalPlan[] = []
  for (const m of memberships.docs as Array<{ tenant?: unknown }>) {
    const t = m.tenant
    if (t && typeof t === 'object') plans.push(planOf(t as { portalPlan?: string | null }))
    else plans.push('free')
  }

  const used = memberships.docs.length
  const quota = portalQuotaFor(plans)
  return { used, quota, overQuota: used >= quota, plan: bestPlan(plans) }
}

function bestPlan(plans: PortalPlan[]): PortalPlan {
  const order: PortalPlan[] = ['free', 'site', 'business', 'demo']
  return plans.reduce((best, p) => (order.indexOf(p) > order.indexOf(best) ? p : best), 'free' as PortalPlan)
}

/**
 * Throws when the caller has no room for another portal. Provisioning catches
 * nothing — the throw IS the refusal, and the message is what the user reads.
 */
export async function assertPortalQuota(
  payload: Payload,
  user: { id: number | string; roles?: unknown } | null | undefined,
): Promise<void> {
  if (!user?.id) return // unattributed provisioning (seeds, scripts) is not a person
  if (checkRole(ADMIN_ROLES, user as never)) return

  const { used, quota } = await getPortalQuota(payload, user.id)
  if (used < quota) return

  throw new Error(
    `You already have ${used} of ${quota} ${quota === 1 ? 'portal' : 'portals'} on your plan. ` +
      `Upgrade at /dashboard/plan to add another.`,
  )
}
