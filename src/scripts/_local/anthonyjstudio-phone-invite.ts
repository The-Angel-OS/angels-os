/**
 * Give Anthony phone sign-in to his own portal — WITHOUT sending him anything.
 *
 * verifyOtpSms only creates an account for an unknown number when a PENDING
 * tenant-membership carries that number in `invitationDetails.invitationPhone`;
 * every other unknown phone gets the generic failure. So "log in with your cell"
 * is only true once this row exists.
 *
 * Deliberately not the provision endpoint's `ownerEmail` path: that one emails
 * the invitation, and Ken is sending the link himself by text.
 *
 * Run: pnpm payload run src/scripts/_local/anthonyjstudio-phone-invite.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { generateInvitationToken, calculateExpiration } from '@/utilities/invitationSystem'

const PHONE = '+18152360613'
const TENANT_SLUG = 'anthonyjstudio'

const payload = await getPayload({ config })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const create = payload.create.bind(payload) as any

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: TENANT_SLUG } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) {
  console.error(`No ${TENANT_SLUG} tenant.`)
  process.exit(1)
}

// Already has an account on this number? Then he can already sign in and this
// row would just be noise.
const existingUser = await payload.find({
  collection: 'users',
  where: { phone: { equals: PHONE } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
if (existingUser.docs.length > 0) {
  console.log(`user already exists for ${PHONE} (#${existingUser.docs[0]!.id}) — nothing to do`)
  process.exit(0)
}

const existingInvite = await payload.find({
  collection: 'tenant-memberships',
  where: {
    and: [
      { tenant: { equals: tenantId } },
      { 'invitationDetails.invitationPhone': { equals: PHONE } },
      { status: { in: ['active', 'pending'] } },
    ],
  },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
if (existingInvite.docs.length > 0) {
  console.log(`invite already pending (#${existingInvite.docs[0]!.id}) — nothing to do`)
  process.exit(0)
}

const inviter = await payload.find({
  collection: 'users',
  where: { roles: { contains: 'super_admin' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const inviterId = (inviter.docs?.[0] as { id: number } | undefined)?.id
  ?? (await payload.find({ collection: 'users', limit: 1, depth: 0, overrideAccess: true })).docs?.[0]?.id
if (inviterId == null) {
  console.error('No user available to attribute the invite to.')
  process.exit(1)
}

// 90 days: he is being texted a link with no deadline attached, and an invite
// that quietly expires turns into "the login is broken" three weeks from now.
const membership = await create({
  collection: 'tenant-memberships',
  data: {
    tenant: tenantId,
    role: 'tenant_admin',
    status: 'pending',
    invitedBy: inviterId,
    invitationDetails: {
      invitationPhone: PHONE,
      invitationToken: generateInvitationToken(),
      invitationExpiresAt: calculateExpiration(90).toISOString(),
    },
  },
  overrideAccess: true,
})

console.log(`pending tenant_admin invite #${membership.id} for ${PHONE} on tenant ${tenantId}`)
console.log('He can now sign in at /login with his mobile number — no email sent.')
process.exit(0)
