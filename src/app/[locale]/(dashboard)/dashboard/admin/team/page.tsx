import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { TeamManager } from './TeamManager'

export const dynamic = 'force-dynamic'

/**
 * Team Management Page — Server Component
 *
 * Fetches all tenant memberships for the current tenant and checks
 * the caller's permission from the same result set (no extra query).
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
  if (!user) redirect(`${prefix}/dashboard`) // loop-proof: never /login from a deep page

  const { tenant, tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) redirect(`${prefix}/dashboard`)

  // Check platform admin first (avoids querying memberships for access check)
  const isPlatformAdmin = checkRole(ADMIN_ROLES, user)

  // Fetch all tenant memberships (depth=1 to hydrate user) — single query for both
  // the member list AND the caller's own permission check
  const memberships = await payload.find({
    collection: 'tenant-memberships',
    where: { tenant: { equals: tenantId } },
    limit: 200,
    depth: 1,
    sort: '-createdAt',
    overrideAccess: true,
  })

  // For non-admins: check permission from the already-fetched membership list
  if (!isPlatformAdmin) {
    const myMembership = (memberships.docs || []).find((doc: any) => {
      const docUserId = typeof doc.user === 'object' ? doc.user?.id : doc.user
      return String(docUserId) === String(user.id)
    }) as any
    const isTA = myMembership?.role === 'tenant_admin'
    const hasPermission =
      Array.isArray(myMembership?.permissions) &&
      myMembership.permissions.includes('manage_users')
    if (!isTA && !hasPermission) {
      redirect(`${prefix}/dashboard`)
    }
  }

  // Friendly fallback name for a PENDING invite (no user account yet): derive
  // a readable label from the email local-part so the table never shows "Unknown".
  const nameFromEmail = (email?: string | null): string => {
    if (!email) return 'Invited'
    const local = email.split('@')[0] || ''
    const words = local.replace(/[._-]+/g, ' ').trim()
    return words ? words.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Invited'
  }

  // Serialize for client component
  const members = (memberships.docs || []).map((doc: any) => ({
    id: String(doc.id),
    userId: typeof doc.user === 'object' ? String(doc.user?.id || '') : String(doc.user || ''),
    userName:
      typeof doc.user === 'object'
        ? doc.user?.name || doc.user?.email || doc.invitationDetails?.invitationName || nameFromEmail(doc.invitationDetails?.invitationEmail)
        : doc.invitationDetails?.invitationName || nameFromEmail(doc.invitationDetails?.invitationEmail),
    userEmail: typeof doc.user === 'object' ? doc.user?.email || '' : '',
    role: doc.role || 'tenant_member',
    permissions: doc.permissions || [],
    status: doc.status || 'active',
    joinedAt: doc.joinedAt || doc.createdAt || null,
    invitationEmail: doc.invitationDetails?.invitationEmail || null,
    invitationPhone: doc.invitationDetails?.invitationPhone || null,
    userPhone: typeof doc.user === 'object' ? doc.user?.phone || null : null,
    inviteUrl: doc.invitationDetails?.invitationToken ? `/tenant-invite/${doc.invitationDetails.invitationToken}` : null,
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
