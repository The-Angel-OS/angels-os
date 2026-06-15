import { setRequestLocale } from 'next-intl/server'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { InvitationsAdmin } from './InvitationsAdmin'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

export default async function DashboardInvitationsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()

  // Fetch space memberships with pending status (invitations)
  const invitations = await payload.find({
    collection: 'space-memberships',
    where: {
      and: [
        tenantFilter,
        { status: { in: ['pending', 'active'] } },
        { 'invitationDetails.invitationToken': { exists: true } },
      ],
    },
    limit: 100,
    depth: 2,
    sort: '-createdAt',
    overrideAccess: true,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serialized = invitations.docs.map((doc: any) => ({
    id: doc.id,
    email: doc.invitationDetails?.invitationEmail || 'Unknown',
    status: doc.status,
    role: doc.role,
    spaceName: typeof doc.space === 'object' ? doc.space?.name || 'Unknown' : 'Unknown',
    inviterName:
      typeof doc.invitedBy === 'object'
        ? doc.invitedBy?.name || doc.invitedBy?.email || 'Unknown'
        : 'Unknown',
    expiresAt: doc.invitationDetails?.invitationExpiresAt || null,
    createdAt: doc.createdAt,
  }))

  return (
    <InvitationsAdmin invitations={serialized} totalInvitations={invitations.totalDocs} />
  )
}
