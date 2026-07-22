import { setRequestLocale } from 'next-intl/server'
import type { Where } from 'payload'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { InvitationsAdmin } from './InvitationsAdmin'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import { resolvePageSize } from '@/utilities/pageSize'

export const dynamic = 'force-dynamic'

export default async function DashboardInvitationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; status?: string; page?: string; limit?: string }>
}) {
  const { locale } = await params
  const { q = '', status = 'all', page: pageParam, limit: limitParam } = await searchParams
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()
  const pageSize = resolvePageSize(limitParam)
  const page = Math.max(1, Number(pageParam) || 1)

  // Base: tenant-memberships that are invitations (Quick Invite writes these).
  // NOTE: must match the collection sendQuickInvite() creates into (tenant-memberships).
  const baseAnd: Where[] = [
    tenantFilter as Where,
    { 'invitationDetails.invitationToken': { exists: true } },
  ]

  // URL-as-state filters (ListControls): status tab + search by invited email.
  const and: Where[] = [...baseAnd]
  if (status === 'pending' || status === 'active') and.push({ status: { equals: status } })
  else and.push({ status: { in: ['pending', 'active'] } })
  if (q.trim()) and.push({ 'invitationDetails.invitationEmail': { like: q.trim() } })

  // Stat counts are independent of the active filter (whole invitation set).
  const [pendingCount, acceptedCount] = await Promise.all([
    payload.count({ collection: 'tenant-memberships', where: { and: [...baseAnd, { status: { equals: 'pending' } }] }, overrideAccess: true }),
    payload.count({ collection: 'tenant-memberships', where: { and: [...baseAnd, { status: { equals: 'active' } }] }, overrideAccess: true }),
  ])

  const invitations = await payload.find({
    collection: 'tenant-memberships',
    where: { and },
    limit: pageSize,
    page,
    depth: 2,
    sort: '-createdAt',
    overrideAccess: true,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serialized = invitations.docs.map((doc: any) => ({
    id: doc.id,
    email: [doc.invitationDetails?.invitationName, doc.invitationDetails?.invitationEmail || doc.invitationDetails?.invitationPhone]
      .filter(Boolean)
      .join(' · ') || 'Unknown',
    inviteUrl: doc.invitationDetails?.invitationToken
      ? `/tenant-invite/${doc.invitationDetails.invitationToken}`
      : null,
    status: doc.status,
    role: doc.role,
    spaceName: typeof doc.tenant === 'object' ? doc.tenant?.name || 'Enterprise' : 'Enterprise',
    inviterName:
      typeof doc.invitedBy === 'object'
        ? doc.invitedBy?.name || doc.invitedBy?.email || 'Unknown'
        : 'Unknown',
    expiresAt: doc.invitationDetails?.invitationExpiresAt || null,
    createdAt: doc.createdAt,
  }))

  return (
    <InvitationsAdmin
      invitations={serialized}
      totalInvitations={invitations.totalDocs}
      pendingCount={pendingCount.totalDocs}
      acceptedCount={acceptedCount.totalDocs}
      page={invitations.page || 1}
      totalPages={invitations.totalPages}
    />
  )
}
