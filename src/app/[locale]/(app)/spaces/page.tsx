import { headers } from 'next/headers'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { fetchDefaultSpaceId } from '@/utilities/fetchDefaultSpaceId'
import { SpacesPage } from './SpacesPage'

export const metadata = {
  title: 'Spaces',
  description: 'Join the conversation.',
}

export default async function SpacesRoute() {
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  const host = headersList.get('host') ?? ''
  const tenant =
    (tenantSlug ? await fetchTenantBySlug(tenantSlug) : null) ??
    (await fetchTenantByDomain(host))

  const tenantName = tenant?.name || 'Community'
  const defaultSpaceId = tenant?.id ? await fetchDefaultSpaceId(tenant.id) : undefined

  return (
    <div className="container py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tenantName} Spaces</h1>
          <p className="text-sm text-muted-foreground">Join the conversation</p>
        </div>
      </div>
      <div className="h-[calc(100vh-12rem)] overflow-hidden rounded-lg border border-border">
        <SpacesPage spaceId={defaultSpaceId} />
      </div>
    </div>
  )
}
