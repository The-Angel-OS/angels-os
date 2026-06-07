import { cache } from 'react'
import { headers } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import type { Tenant, User } from '@/payload-types'
import type { Where } from 'payload'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { managerTenantIds } from '@/access/connectorAccess'
import {
  computePortalEntitlements,
  type PortalCapability,
  type PortalEntitlements,
} from '@/utilities/portalEntitlements'

/**
 * PortalContext — ONE resolved identity/tenant context per request.
 *
 * Modeled on Oqtane's SiteState (Alias → Site → User) with DNN's
 * PortalSettings/HostSettings as the fallback mental model. The framework
 * resolves "current portal + current user + entitlements" ONCE; every page reads
 * it instead of re-running payload.auth / resolveTenantFromHeaders / checkRole /
 * membership lookups with subtly different rules. That fragmentation is what
 * produced the cross-tenant + auth-runaround defects this consolidates.
 *
 * React.cache(): layout + page in one request share a single resolution, so
 * identity can never diverge between them.
 *
 *   const ctx = await resolvePortalContext()
 *   await requirePortalAccess(ctx, 'manageConnectors')
 *
 * See docs/architecture/AUTH_CONTEXT_REFACTOR.md.
 */
export type { PortalCapability, PortalEntitlements }

export interface PortalContext {
  host: { isFederationNode: boolean } // HostSettings analog
  portal: { tenant: Tenant | null; tenantId: number | undefined; tenantFilter: Where } // Site/PortalSettings
  user: User | null
  entitlements: PortalEntitlements
}

export const resolvePortalContext = cache(async (): Promise<PortalContext> => {
  const { tenant, tenantId, tenantFilter } = await resolveTenantFromHeaders()

  // Lazy-load Payload so importing this module (e.g. for the pure helpers) doesn't
  // boot the full config — matches logError/ensureSystemSpace.
  let user: User | null = null
  try {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    const result = await payload.auth({ headers: await headers() })
    user = (result.user as User) ?? null
  } catch {
    user = null // auth unavailable → anonymous (matches the dashboard layout policy)
  }

  // Membership roles only matter for non-admins; skip the query for admins/anon.
  let managedTenantIds: Array<number | string> = []
  if (user && !checkRole(ADMIN_ROLES, user as never)) {
    managedTenantIds = await managerTenantIds(user as { id?: number | string })
  }

  return {
    host: { isFederationNode: Boolean(process.env.GOTIFY_SERVER_URL || process.env.FEDERATION_NODE) },
    portal: { tenant, tenantId, tenantFilter },
    user,
    entitlements: computePortalEntitlements({ user, tenantId, managedTenantIds }),
  }
})

/**
 * Gate a server component on the resolved context (locale-aware redirects).
 * Our `[Authorize]`: no user → /login; lacks capability → /dashboard.
 */
export async function requirePortalAccess(
  ctx: PortalContext,
  capability?: PortalCapability,
): Promise<void> {
  const locale = await getLocale()
  const prefix = locale === 'en' ? '' : `/${locale}`
  if (!ctx.user) redirect(`${prefix}/login`)
  if (capability && !ctx.entitlements.can[capability]) redirect(`${prefix}/dashboard`)
}
