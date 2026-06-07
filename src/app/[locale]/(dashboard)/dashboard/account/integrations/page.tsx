import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ConnectorsAdmin } from './ConnectorsAdmin'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { managerTenantIds } from '@/access/connectorAccess'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

export const dynamic = 'force-dynamic'

export default async function DashboardConnectorsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`

  const payload = await getPayload({ config: configPromise })

  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect(`${prefix}/login`)

  // Resolve tenant (cached, React.cache deduped)
  const { tenant, tenantId, tenantFilter } = await resolveTenantFromHeaders()

  // Connectors hold integration secrets — guard so only someone entitled to THIS
  // tenant can view its tokens. The fetch below uses overrideAccess (bypassing
  // the collection's connectorScopedAccess + the multi-tenant plugin clamp), so
  // we must authorize the resolved tenant here: super_admin, a member of this
  // tenant, or a tenant_admin/manager of it. A non-customer role alone is NOT
  // enough — that would expose Tenant B's secrets to a Tenant A owner who loads
  // B's subdomain (cookies are shared across subdomains).
  // Platform admins (super_admin/admin/archangel) bypass — same definition the
  // dashboard layout uses for isAdmin, so admins are never bounced into a loop.
  const isPlatformAdmin = checkRole(ADMIN_ROLES, user)
  if (!isPlatformAdmin) {
    if (tenantId == null) redirect(`${prefix}/dashboard`)
    const userTenantIds = (Array.isArray((user as { tenants?: unknown[] }).tenants) ? (user as { tenants: unknown[] }).tenants : []).map((t) => {
      const tt = (t as { tenant?: unknown }).tenant
      return tt && typeof tt === 'object' ? (tt as { id: number | string }).id : (tt as number | string)
    })
    const managed = await managerTenantIds(user as { id?: number | string })
    const entitled =
      userTenantIds.some((id) => String(id) === String(tenantId)) ||
      managed.some((id) => String(id) === String(tenantId))
    if (!entitled) redirect(`${prefix}/dashboard`)
  }

  // Fetch all connectors for this tenant
  interface ConnectorItem {
    id: string
    name: string
    type: string
    enabled: boolean
    status: string
    lastActivity: string | null
    errorMessage: string | null
    priority: number
    config: Record<string, unknown>
  }

  let connectors: ConnectorItem[] = []
  try {
    const result = await payload.find({
      collection: 'connectors' as any,
      where: tenantFilter,
      limit: 100,
      sort: '-priority',
      depth: 0,
      overrideAccess: true,
    })
    connectors = (result.docs || []).map((doc: any) => ({
      id: String(doc.id),
      name: doc.name || '',
      type: doc.type || '',
      enabled: doc.enabled !== false,
      status: doc.status || 'active',
      lastActivity: doc.lastActivity || null,
      errorMessage: doc.errorMessage || null,
      priority: doc.priority || 0,
      config: (doc.config as Record<string, unknown>) || {},
    }))
  } catch {
    // Connectors collection may not exist yet
  }

  return (
    <ConnectorsAdmin
      connectors={connectors}
      tenantId={tenantId ? String(tenantId) : ''}
      tenantName={tenant?.name || 'Your Enterprise'}
    />
  )
}
