/**
 * Fold Bill's four pending invitations into ONE person with both anchors set,
 * so email OTP and text OTP both land on the same account.
 *
 * He existed only as 4 pending tenant-membership invites (wdeg, clearwater,
 * harpazo, platform) and no user. Letting him sign in by TEXT first would have
 * minted a `<digits>@phone.invalid` placeholder and activated only phone-matched
 * invites — two of which were expired anyway. So: create the user with the real
 * email AND the phone, then activate all four against it. Idempotent.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'
import { autoActivatePendingMembership } from '@/utilities/autoActivatePendingMembership'

const EMAIL = 'billthecat1022@gmail.com'
const PHONE = '+13042831259'
const NAME = 'Bill Courtney'

const payload = await getPayload({ config })

const found = await payload.find({
  collection: 'users',
  where: { or: [{ email: { equals: EMAIL } }, { phone: { equals: PHONE } }] },
  limit: 2,
  depth: 0,
  overrideAccess: true,
})

let user = found.docs[0] as { id: number; email: string; phone?: string } | undefined

if (!user) {
  user = (await payload.create({
    collection: 'users',
    data: {
      email: EMAIL,
      // Passwordless by design — he signs in with a code, never this string.
      password: crypto.randomUUID() + crypto.randomUUID(),
      phone: PHONE,
      name: NAME,
      _verified: true,
    } as never,
    overrideAccess: true,
  })) as { id: number; email: string; phone?: string }
  console.log(`created user ${user.id} ${user.email} ${PHONE}`)
} else {
  if (user.phone !== PHONE) {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { phone: PHONE } as never,
      overrideAccess: true,
    })
    console.log(`user ${user.id}: phone anchor set`)
  }
  console.log(`user ${user.id} ${user.email} already existed`)
}

// Every pending invite on this email, expired or not — refresh the stale ones so
// the whole set activates in one pass.
const invites = await payload.find({
  collection: 'tenant-memberships',
  where: {
    and: [
      { 'invitationDetails.invitationEmail': { equals: EMAIL } },
      { status: { equals: 'pending' } },
    ],
  },
  limit: 50,
  depth: 0,
  overrideAccess: true,
})

const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

for (const m of invites.docs as Array<{ id: number; tenant: number | { id: number } }>) {
  const tenantId = typeof m.tenant === 'object' ? m.tenant.id : m.tenant
  await payload.update({
    collection: 'tenant-memberships',
    id: m.id,
    data: {
      invitationDetails: { invitationPhone: PHONE, invitationExpiresAt: future },
    } as never,
    overrideAccess: true,
  })
  try {
    await autoActivatePendingMembership(m.id, user.id, tenantId)
    console.log(`activated membership ${m.id} -> tenant ${tenantId}`)
  } catch (e) {
    console.log(`membership ${m.id} tenant ${tenantId} FAILED: ${(e as Error).message}`)
  }
}

const after = await payload.find({
  collection: 'tenant-memberships',
  where: { user: { equals: user.id } },
  limit: 50,
  depth: 0,
  overrideAccess: true,
})
console.log(
  'final:',
  (after.docs as Array<{ tenant: number; role: string; status: string }>)
    .map((m) => `t${m.tenant}:${m.role}:${m.status}`)
    .join(' '),
)
