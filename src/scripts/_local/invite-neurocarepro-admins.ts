/**
 * One-off: create tenant-admin invites for David + Dave on the NeuroCare Pro
 * tenant (22), and print the invite links to text/send. Idempotent-ish: reuses an
 * existing pending invite's token if one already exists for the email.
 *
 * Run: node_modules/.bin/payload run src/scripts/_local/invite-neurocarepro-admins.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'

const TENANT = 22
const INVITED_BY = 3 // Ken
const BASE = 'https://neurocarepro.payloadnuke.com'
const EXPIRY_DAYS = 30

const people = [
  { email: 'davidc@neurocarepro.com', name: 'David Christenson', title: 'CTO & Founder' },
  { email: 'davea@neurocarepro.com', name: 'Dave', title: 'Assistant' },
]

const payload = await getPayload({ config })

for (const p of people) {
  const email = p.email.trim().toLowerCase()

  // Reuse an existing pending tenant-admin invite if present
  const existing = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { tenant: { equals: TENANT } },
        { 'invitationDetails.invitationEmail': { equals: email } },
        { status: { equals: 'pending' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  let token: string
  if (existing.docs[0]) {
    token = (existing.docs[0] as any).invitationDetails?.invitationToken
    // refresh expiry
    await payload.update({
      collection: 'tenant-memberships',
      id: existing.docs[0].id,
      data: {
        invitationDetails: {
          ...(existing.docs[0] as any).invitationDetails,
          invitationExpiresAt: new Date(Date.now() + EXPIRY_DAYS * 864e5).toISOString(),
        },
      } as any,
      overrideAccess: true,
    })
    console.log(`REUSED ${p.name} <${email}> role=tenant_admin`)
  } else {
    token = crypto.randomUUID()
    await (payload.create as any)({
      collection: 'tenant-memberships',
      data: {
        tenant: TENANT,
        role: 'tenant_admin',
        status: 'pending',
        invitedBy: INVITED_BY,
        invitationDetails: {
          invitationToken: token,
          invitationExpiresAt: new Date(Date.now() + EXPIRY_DAYS * 864e5).toISOString(),
          invitationEmail: email,
          invitationMessage: `You've been invited as an administrator of ${'NeuroCare Pro'} on Angel OS.`,
        },
      },
      overrideAccess: true,
    })
    console.log(`CREATED ${p.name} <${email}> role=tenant_admin`)
  }

  console.log(`LINK ${p.name}: ${BASE}/tenant-invite/${token}`)
}

process.exit(0)
