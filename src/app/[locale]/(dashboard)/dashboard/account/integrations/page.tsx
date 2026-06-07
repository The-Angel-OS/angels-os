import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ConnectorsAdmin } from './ConnectorsAdmin'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { managerTenantIds } from '@/access/connectorAccess'

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

  // Connectors hold integration secrets — server-side guard so a non-owner can't
  // view tokens by hitting the URL directly (the overrideAccess fetch below would
  // otherwise expose them). Mirrors the nav's owner-or-staff visibility.
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect(`${prefix}/login`)
  const roles = Array.isArray((user as { roles?: unknown }).roles) ? ((user as { roles: unknown[] }).roles) : []
  const isOwnerOrStaff = roles.some((r) => r !== 'customer')
  if (!isOwnerOrStaff) {
    const managed = await managerTenantIds(user as { id?: number | string })
    if (managed.length === 0) redirect(`${prefix}/dashboard/account`)
  }

  // Resolve tenant (cached, React.cache deduped)
  const { tenant, tenantId, tenantFilter } = await resolveTenantFromHeaders()

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
