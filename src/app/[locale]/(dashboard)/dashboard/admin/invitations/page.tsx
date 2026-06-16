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

  // Fetch tenant memberships that are invitations (Quick Invite writes these).
  // NOTE: must match the collection sendQuickInvite() creates into — previously
  // this read 'space-memberships' while invites are created as 'tenant-memberships',
  // so the list was always empty even though invites existed.
  const invitations = await payload.find({
    collection: 'tenant-memberships',
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
    spaceName: typeof doc.tenant === 'object' ? doc.tenant?.name || 'Enterprise' : 'Enterprise',
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
