/**
 * Page access gating — does a user may VIEW a page given its `access` level?
 *
 * Pure core (`isPageViewable`) so the nav builder can filter many pages against a
 * single resolved standing, and an async wrapper (`canViewPage`) for the render path
 * that resolves standing for one page. Admins always pass. Deny-by-default.
 *
 * @see src/utilities/memberStanding.ts  @see docs/planning/MEMBERSHIP_GATING.md
 */
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { getMemberStanding } from './memberStanding'

export type PageAccessLevel = 'public' | 'authenticated' | 'members' | 'good_standing'

export const PAGE_ACCESS_OPTIONS: { label: string; value: PageAccessLevel }[] = [
  { label: 'Public — anyone', value: 'public' },
  { label: 'Authenticated — any signed-in user', value: 'authenticated' },
  { label: 'Members — current or lapsing member', value: 'members' },
  { label: 'Members in good standing', value: 'good_standing' },
]

export interface ViewerStanding {
  isAdmin: boolean
  isAuthenticated: boolean
  isMember: boolean
  inGoodStanding: boolean
}

/** Pure gate: given an access level and a resolved viewer standing, may they view? */
export function isPageViewable(access: string | null | undefined, v: ViewerStanding): boolean {
  const a = (access || 'public') as PageAccessLevel
  if (a === 'public') return true
  if (v.isAdmin) return true
  if (!v.isAuthenticated) return false
  if (a === 'authenticated') return true
  if (a === 'members') return v.isMember
  if (a === 'good_standing') return v.inGoodStanding
  return false
}

/** Resolve a viewer's standing once (for filtering many pages in the nav). */
export async function resolveViewerStanding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any,
  tenantId: string | number | null | undefined,
): Promise<ViewerStanding> {
  const isAuthenticated = Boolean(user)
  const isAdmin = Boolean(user && checkRole(ADMIN_ROLES, user))
  if (!isAuthenticated || isAdmin) {
    return { isAdmin, isAuthenticated, isMember: false, inGoodStanding: false }
  }
  const st = await getMemberStanding(payload, user.id, tenantId)
  return { isAdmin, isAuthenticated, isMember: st.isMember, inGoodStanding: st.inGoodStanding }
}

/** Async gate for the render path: resolve standing for one page + decide. */
export async function canViewPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  access: string | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any,
  tenantId: string | number | null | undefined,
): Promise<boolean> {
  if (!access || access === 'public') return true
  const v = await resolveViewerStanding(payload, user, tenantId)
  return isPageViewable(access, v)
}
