import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { fetchUserSpaces, type SerializedSpace } from '@/utilities/fetchUserSpaces'
import { SpaceSettingsClient } from './SpaceSettingsClient'

/**
 * Space Settings — server component.
 *
 * Resolves tenant, user, and spaces server-side, then renders the client
 * settings UI. The active space is determined by DashboardContext on the client.
 */
export default async function SpaceSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  // Resolve tenant (cached, React.cache deduped)
  const { tenant, tenantId } = await resolveTenantFromHeaders()

  let userId: number | string | undefined
  let userRoles: string[] = []

  try {
    const payload = await getPayload({ config: configPromise })
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })
    userId = user?.id
    userRoles = ((user as any)?.roles as string[]) || []
  } catch {
    // Not authenticated
  }

  // Fetch spaces
  let spaces: SerializedSpace[] = []
  if (userId && tenantId) {
    spaces = await fetchUserSpaces(userId, tenantId)
  }

  const isAdmin = userRoles.includes('super_admin') || userRoles.includes('admin') || userRoles.includes('archangel')

  return (
    <SpaceSettingsClient
      spaces={spaces}
      tenantId={tenantId ? String(tenantId) : undefined}
      userId={userId ? String(userId) : undefined}
      isAdmin={isAdmin}
    />
  )
}
