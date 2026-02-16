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
    <div className="-m-6 flex h-[calc(100vh-3.5rem)] flex-col">
      <SpacesChat spaceId={defaultSpaceId} />
    </div>
  )
}
