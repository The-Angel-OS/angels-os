import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { CrewManager } from './CrewManager'

export const dynamic = 'force-dynamic'

/**
 * Crew Relations Page — Server Component
 *
 * The "muster roll" for a tenant's Endeavor: every member's department,
 * station, rank, watch and duty status. Fetches the tenant's crew-assignments
 * + memberships (assignable crew) in parallel, gated to manage_users / admin.
 */
export default async function CrewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`

  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect(`${prefix}/dashboard`) // loop-proof: never /login from a deep page

  const { tenant, tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) redirect(`${prefix}/dashboard`)

  const isPlatformAdmin = checkRole(ADMIN_ROLES, user)

  // Memberships (assignable crew + caller permission check, single query)
  const memberships = await payload.find({
    collection: 'tenant-memberships',
    where: { tenant: { equals: tenantId } },
    limit: 200,
    depth: 1,
    sort: '-createdAt',
    overrideAccess: true,
  })

  if (!isPlatformAdmin) {
    const mine = (memberships.docs || []).find((d: any) => {
      const uid = typeof d.user === 'object' ? d.user?.id : d.user
      return String(uid) === String(user.id)
    }) as any
    const isTA = mine?.role === 'tenant_admin'
    const canManage = Array.isArray(mine?.permissions) && mine.permissions.includes('manage_users')
    if (!isTA && !canManage) redirect(`${prefix}/dashboard`)
  }

  // Resolve the tenant's Endeavor (the ship) and its current crew
  const endeavors = await payload.find({
    collection: 'endeavors',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const endeavor = endeavors.docs?.[0] as any
  const endeavorName = endeavor?.name || (tenant as any)?.name || 'Endeavor'

  let crew: any[] = []
  if (endeavor?.id) {
    const assignments = await payload.find({
      collection: 'crew-assignments',
      where: { endeavor: { equals: endeavor.id } },
      limit: 300,
      depth: 2, // hydrate membership → user
      overrideAccess: true,
    })
    crew = assignments.docs || []
  }

  // Map membership id → display name (for crew rows + assign dropdown)
  const memberName = (m: any): string =>
    typeof m?.user === 'object' ? m.user?.name || m.user?.email || 'Unknown' : 'Unknown'

  const members = (memberships.docs || []).map((m: any) => ({
    membershipId: String(m.id),
    name: memberName(m),
    role: m.role || 'tenant_member',
  }))

  const crewRows = crew.map((c: any) => {
    const m = c.membership
    const name =
      typeof m === 'object' && m
        ? typeof m.user === 'object'
          ? m.user?.name || m.user?.email || 'Unknown'
          : 'Unknown'
        : 'Unknown'
    return {
      id: String(c.id),
      membershipId: typeof m === 'object' && m ? String(m.id) : String(m || ''),
      name,
      department: c.department || 'operations',
      rank: c.rank || 'specialist',
      station: c.station || '',
      dutyStatus: c.dutyStatus || 'active_duty',
      watchSection: c.watchSection || '',
    }
  })

  // Members not yet assigned to crew (candidates for the assign form)
  const assignedMembershipIds = new Set(crewRows.map((c) => c.membershipId))
  const assignable = members.filter((m) => !assignedMembershipIds.has(m.membershipId))

  return (
    <div className="mx-auto max-w-5xl">
      <CrewManager
        crew={crewRows}
        assignable={assignable}
        endeavorName={endeavorName}
        hasEndeavor={Boolean(endeavor?.id)}
      />
    </div>
  )
}
