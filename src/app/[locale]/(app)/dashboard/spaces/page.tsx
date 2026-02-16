import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { fetchDefaultSpaceId } from '@/utilities/fetchDefaultSpaceId'
import { SpacesChat } from './SpacesChat'

export default async function SpacesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  // Resolve default space for current tenant
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  const host = headersList.get('host') ?? ''
  const tenant =
    (tenantSlug ? await fetchTenantBySlug(tenantSlug) : null) ??
    (await fetchTenantByDomain(host))

  const defaultSpaceId = tenant?.id ? await fetchDefaultSpaceId(tenant.id) : undefined

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Spaces</h1>
        <p className="text-sm text-muted-foreground">
          Channels, messages, and workspace apps. Discord-like collaboration.
        </p>
      </div>
      <div className="flex-1">
        <SpacesChat spaceId={defaultSpaceId} />
      </div>
    </div>
  )
}
