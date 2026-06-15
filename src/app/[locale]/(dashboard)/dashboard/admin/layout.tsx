import type { ReactNode } from 'react'
import { resolvePortalContext, requirePortalAccess } from '@/utilities/portalContext'

/**
 * Admin segment gate — closes the whole /dashboard/admin/* subtree to anyone who
 * doesn't manage the current portal.
 *
 * Why this exists: the dashboard layout is auth-OPTIONAL by design (anonymous users
 * may view public dashboard pages), middleware does NOT gate /dashboard, and these
 * admin pages query with `overrideAccess: true` scoped only by host-tenant. Without a
 * gate, a customer — or an anonymous visitor — could reach /dashboard/admin/payments,
 * /payouts, /contacts, etc. by direct URL and see that tenant's financials, orders,
 * and PII. The nav merely hides the links (cosmetic). This is the canonical fix from
 * AUTH_CONTEXT_REFACTOR: one tested guard, wired at the segment boundary.
 *
 * `manageConnectors` is the LOWEST admin bar — entitled to the current portal AND
 * (owner/staff OR manager). It blocks customers (isBusinessOwner=false, managesCurrent
 * =false → false) and anonymous (no user → /login), while admitting owners, managers,
 * and platform admins. Platform-only pages (provision/tenants/federation) may add a
 * stricter `adminPortal` check on top; financial pages a `manageSpaces` check.
 *
 * @see src/utilities/portalEntitlements.ts  @see docs/architecture/AUTH_CONTEXT_REFACTOR.md
 */
export default async function AdminSegmentLayout({ children }: { children: ReactNode }) {
  const ctx = await resolvePortalContext()
  await requirePortalAccess(ctx, 'manageConnectors')
  return <>{children}</>
}
