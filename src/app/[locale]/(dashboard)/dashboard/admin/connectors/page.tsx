import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ConnectorsAdmin } from './ConnectorsAdmin'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'

export default async function DashboardConnectorsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant (cached)
  const { tenantId, tenantFilter } = await resolveTenantFromHeaders()
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant: any = tenantSlug ? await fetchTenantBySlug(tenantSlug) : null

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
