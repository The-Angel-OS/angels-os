import { headers } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

/**
 * requirePortalManager — server gate for dashboard surfaces that expose a portal's
 * financials / orders / PII. Redirects to /dashboard unless the caller is a platform
 * admin OR a tenant_admin / tenant_manager of the CURRENT portal.
 *
 * Uses the PROVEN inline pattern (payload.auth + redirect) that admin/team already
 * relies on — NOT requirePortalAccess/PortalContext, whose redirect did not fire from
 * a segment layout under Next 16 (the page rendered anyway, exposing data). The caller
 * MUST be dynamic — pair this with `export const dynamic = 'force-dynamic'`, which is
 * what makes the gate run per-request (a statically-prerendered layout skips it).
 *
 * Redirects to /dashboard (loop-proof — never /login from a deep page); /dashboard is
 * public and renders for anyone.
 */
export async function requirePortalManager(): Promise<void> {
  const locale = await getLocale()
  const prefix = locale === 'en' ? '' : `/${locale}`

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect(`${prefix}/dashboard`)

  // Platform admin (super_admin / admin / archangel) → full access, no membership query.
  if (checkRole(ADMIN_ROLES, user)) return

  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) redirect(`${prefix}/dashboard`)

  const m = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { user: { equals: (user as { id: number | string }).id } },
        { tenant: { equals: tenantId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const role = (m.docs?.[0] as { role?: string } | undefined)?.role
  if (role !== 'tenant_admin' && role !== 'tenant_manager') redirect(`${prefix}/dashboard`)
}
