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

/** A portal as the owner's own surfaces need it — enough to name it and link to it. */
export interface OwnedPortal {
  id: number | string
  slug: string
  name: string
  domain?: string | null
  plan: PortalPlan
  isGuardianAngel: boolean
}

/**
 * Every portal this person OWNS — `tenant_admin`, active, no cap.
 *
 * THE definition of "your portals", and the reason this is a function rather
 * than a query repeated per surface. The apex home card used to ask a different
 * question from the quota printed beside it — active membership in ANY role,
 * capped at 20 — so it rendered twenty buttons above the words "16 of 100" and
 * silently hid every portal past the twentieth. Two answers to one question is
 * how that happens; there is now one.
 *
 * Ownership, not membership, is the right question for every one of these
 * surfaces: a community you joined is not a site you run, and it is not
 * something a plan could ever be charged for.
 *
 * ponytail: no cap. Someone with a thousand portals would want paging, and
 * nobody has forty — a cap that silently lies is worse than a list that is
 * briefly long.
 */
export async function getOwnedPortals(
  payload: Payload,
  userId: number | string,
): Promise<OwnedPortal[]> {
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

  const portals: OwnedPortal[] = []
  for (const m of memberships.docs as Array<{ tenant?: unknown }>) {
    const t = m.tenant
    // An unhydrated relation is still a portal they own — it counts toward the
    // quota (as free, the safe reading) even though it cannot be linked to.
    if (!t || typeof t !== 'object') {
      portals.push({ id: 0, slug: '', name: '', plan: 'free', isGuardianAngel: false })
      continue
    }
    const tenant = t as {
      id?: number | string
      slug?: string
      name?: string
      domain?: string
      portalPlan?: string | null
      isGuardianAngel?: boolean
      branding?: { siteName?: string }
    }
    portals.push({
      id: tenant.id ?? 0,
      slug: tenant.slug || '',
      name: tenant.branding?.siteName || tenant.name || tenant.slug || '',
      domain: tenant.domain,
      plan: planOf(tenant),
      isGuardianAngel: tenant.isGuardianAngel === true,
    })
  }
  return portals
}

/**
 * What this person's plans entitle them to, and how much of it is spent.
 *
 * A guardian angel does NOT count against the allowance. It is auto-provisioned,
 * it is the person rather than a site they run, and counting it meant a free
 * user's personal portal consumed their entire allowance of one — so the next
 * portal they made, the actual business, was refused. That closed the free tier
 * at exactly the step it exists to open. Excluding it also settles a second
 * disagreement: GUARDIAN_ANGEL_MAX_PER_USER (3) is now reachable instead of
 * being overruled by a quota of 1 that fired first.
 */
export function quotaFromOwned(owned: OwnedPortal[]): PortalQuotaState {
  const plans = owned.map((p) => p.plan)
  // The ALLOWANCE still reads every plan, guardian angels included — a paid
  // personal angel is a plan they hold, and it would be mean to ignore it.
  const quota = portalQuotaFor(plans)
  const used = owned.filter((p) => !p.isGuardianAngel).length
  return { used, quota, overQuota: used >= quota, plan: bestPlan(plans) }
}

export async function getPortalQuota(
  payload: Payload,
  userId: number | string,
): Promise<PortalQuotaState> {
  return quotaFromOwned(await getOwnedPortals(payload, userId))
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
