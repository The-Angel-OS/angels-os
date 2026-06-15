import type { ReactNode } from 'react'
import { requirePortalManager } from '@/utilities/requirePortalManager'

/**
 * Admin segment gate — closes the whole /dashboard/admin/* subtree to anyone who
 * doesn't manage the current portal (platform admin or tenant_admin/tenant_manager).
 *
 * Why this exists: the dashboard layout is auth-OPTIONAL by design, middleware does
 * NOT gate /dashboard, and these admin pages query with `overrideAccess: true` scoped
 * only by host-tenant — so without a gate an UNAUTHENTICATED visitor could reach
 * /dashboard/admin/payments, /payouts, /contacts, etc. by direct URL and read a
 * tenant's financials, orders, and PII. (Verified live before the fix.)
 *
 * ⚠️ `export const dynamic = 'force-dynamic'` is REQUIRED — without it the layout is
 * prerendered and the gate never runs per-request (the first attempt, via
 * requirePortalAccess without force-dynamic, rendered the pages anyway). requirePortal-
 * Manager uses the proven inline payload.auth + redirect pattern.
 *
 * @see src/utilities/requirePortalManager.ts  @see docs/architecture/AUTH_CONTEXT_REFACTOR.md
 */
export const dynamic = 'force-dynamic'

export default async function AdminSegmentLayout({ children }: { children: ReactNode }) {
  await requirePortalManager()
  return <>{children}</>
}
