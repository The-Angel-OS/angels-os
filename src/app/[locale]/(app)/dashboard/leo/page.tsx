import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { fetchDefaultSpaceId } from '@/utilities/fetchDefaultSpaceId'
import { LEOChat } from './LEOChat'

/**
 * LEO Full-Page Chat — fills the entire main area.
 * Uses negative margin to cancel the dashboard layout padding for true full-bleed.
 */
export default async function LEOPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  // Resolve tenant + default space
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  const host = headersList.get('host') ?? ''
  const tenant =
    (tenantSlug ? await fetchTenantBySlug(tenantSlug) : null) ??
    (await fetchTenantByDomain(host))

  const defaultSpaceId = tenant?.id ? await fetchDefaultSpaceId(tenant.id) : undefined

  // Resolve current user name for identity bar
  let userName: string | undefined
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: headersList })
    if (user) {
      userName =
        (user as unknown as Record<string, unknown>).name as string | undefined ||
        (user as unknown as Record<string, unknown>).email as string | undefined
    }
  } catch {
    // Not authenticated — userName stays undefined
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-0px)] flex-col">
      <LEOChat spaceId={defaultSpaceId} userName={userName} />
    </div>
  )
}
