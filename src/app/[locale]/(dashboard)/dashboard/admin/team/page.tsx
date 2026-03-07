import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { getUserTenantMembership } from '@/access/getUserTenantRoles'
import { TeamManager } from './TeamManager'

export const dynamic = 'force-dynamic'

/**
 * Team Management Page — Server Component
 *
 * Fetches all tenant memberships for the current tenant and passes
 * serialized data to the TeamManager client component.
 *
 * Access: requires manage_users permission or platform admin.
 */
export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`

  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect(`${prefix}/login`)

  const { tenant, tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) redirect(`${prefix}/dashboard`)

  // Check access: platform admin OR manage_users permission
  const roles = (user as any).roles as string[] | undefined
  const isPlatformAdmin = Boolean(
    roles?.includes('super_admin') || roles?.includes('admin') || roles?.includes('archangel'),
  )

  if (!isPlatformAdmin) {
    const membership = await getUserTenantMembership(user.id, tenantId)
    const isTA = membership?.role === 'tenant_admin'
    const hasPermission =
      Array.isArray(membership?.permissions) && membership.permissions.includes('manage_users')
    if (!isTA && !hasPermission) {
      redirect(`${prefix}/dashboard`)
    }
  }

  // Fetch all tenant memberships, depth=1 to hydrate user
  const memberships = await payload.find({
    collection: 'tenant-memberships',
    where: { tenant: { equals: tenantId } },
    limit: 200,
    depth: 1,
    sort: '-createdAt',
    overrideAccess: true,
  })

  // Serialize for client component
  const members = (memberships.docs || []).map((doc: any) => ({
    id: String(doc.id),
    userId: typeof doc.user === 'object' ? String(doc.user?.id || '') : String(doc.user || ''),
    userName:
      typeof doc.user === 'object' ? doc.user?.name || doc.user?.email || 'Unknown' : 'Unknown',
    userEmail: typeof doc.user === 'object' ? doc.user?.email || '' : '',
    role: doc.role || 'tenant_member',
    permissions: doc.permissions || [],
    status: doc.status || 'active',
    joinedAt: doc.joinedAt || doc.createdAt || null,
    invitationEmail: doc.invitationDetails?.invitationEmail || null,
    createdAt: doc.createdAt || null,
  }))

  return (
    <div className="mx-auto max-w-5xl">
      <TeamManager
        members={members}
        totalMembers={memberships.totalDocs}
        tenantName={(tenant as any)?.name || 'Enterprise'}
      />
    </div>
  )
}
