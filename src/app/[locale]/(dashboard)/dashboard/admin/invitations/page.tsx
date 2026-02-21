import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { InvitationsAdmin } from './InvitationsAdmin'

export default async function DashboardInvitationsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  let tenantId: number | undefined

  if (tenantSlug) {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = tenants.docs?.[0]?.id
  }
  if (!tenantId) {
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = defaults.docs?.[0]?.id
  }

  // Fetch space memberships with pending status (invitations)
  const invitations = await payload.find({
    collection: 'space-memberships',
    where: {
      ...(tenantId != null ? { tenant: { equals: tenantId } } : {}),
      status: { in: ['pending', 'active'] },
      'invitationDetails.invitationToken': { exists: true },
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
