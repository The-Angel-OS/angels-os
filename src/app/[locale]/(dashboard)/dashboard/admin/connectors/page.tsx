import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ConnectorsAdmin } from './ConnectorsAdmin'

export default async function DashboardConnectorsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tenant: any = null

  if (tenantSlug) {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenant = tenants.docs?.[0]
  }
  if (!tenant) {
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenant = defaults.docs?.[0]
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
      where: tenant?.id ? { tenant: { equals: tenant.id } } : {},
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
      tenantId={tenant?.id ? String(tenant.id) : ''}
      tenantName={tenant?.name || 'Your Enterprise'}
    />
  )
}
