/**
 * One-off: invite Ron (billthecat1022@gmail.com) to four portals.
 * Uses the TENANT invite primitive (tenant-memberships + /tenant-invite/<token>),
 * the same path the Invitations admin "Quick Invite" uses. Idempotent — skips a
 * tenant that already has an active/pending invite for this email.
 * Run in container: node_modules/.bin/payload run src/scripts/_local/invite-ron.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'

const EMAIL = 'billthecat1022@gmail.com'
const INVITED_BY = 3 // Ken
const BASE = process.env.NEXT_PUBLIC_SERVER_URL || 'https://www.spacesangels.com'

// tenant slug → role. His own two get admin; the other two get member.
const TARGETS: Array<{ slug: string; role: string }> = [
  { slug: 'wheredideveryonego', role: 'tenant_admin' },
  { slug: 'harpazo', role: 'tenant_admin' },
  { slug: 'clearwater-cruisin', role: 'tenant_member' },
  { slug: 'platform', role: 'tenant_member' },
]

const payload = await getPayload({ config })

for (const t of TARGETS) {
  const tr = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: t.slug } },
    limit: 1, depth: 0, overrideAccess: true,
  })
  const tenant = tr.docs[0] as { id: number; name: string } | undefined
  if (!tenant) { console.log(`MISSING tenant ${t.slug}`); continue }

  const existing = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { tenant: { equals: tenant.id } },
        { 'invitationDetails.invitationEmail': { equals: EMAIL } },
        { status: { in: ['active', 'pending'] } },
      ],
    },
    limit: 1, depth: 0, overrideAccess: true,
  })
  if (existing.totalDocs > 0) {
    const d = existing.docs[0] as { status: string; invitationDetails?: { invitationToken?: string } }
    console.log(`EXISTS ${t.slug} (${d.status}) ${d.invitationDetails?.invitationToken ? `${BASE}/tenant-invite/${d.invitationDetails.invitationToken}` : ''}`)
    continue
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  await payload.create({
    collection: 'tenant-memberships',
    data: {
      tenant: tenant.id,
      role: t.role,
      status: 'pending',
      invitedBy: INVITED_BY,
      invitationDetails: {
        invitationName: 'Ron',
        invitationEmail: EMAIL,
        invitationToken: token,
        invitationExpiresAt: expiresAt.toISOString(),
        invitationMessage: 'Your access to the portal — Ken',
      },
    } as never,
    overrideAccess: true,
  })
  console.log(`CREATED ${t.slug} [${t.role}] ${BASE}/tenant-invite/${token}`)
}

process.exit(0)
