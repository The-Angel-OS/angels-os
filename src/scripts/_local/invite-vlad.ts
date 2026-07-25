/** One-off: create the pending phone invite for Vlad (727-339-9328) on start-s (tenant 24) as tenant_admin. Idempotent. */
import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'

const TENANT = 24
const PHONE = '+17273399328'

const payload = await getPayload({ config })
const existing = await payload.find({
  collection: 'tenant-memberships',
  where: { and: [{ tenant: { equals: TENANT } }, { 'invitationDetails.invitationPhone': { equals: PHONE } }, { status: { in: ['active', 'pending'] } }] },
  limit: 1, depth: 0, overrideAccess: true,
})
if (existing.docs[0]) {
  const d = existing.docs[0] as any
  console.log('EXISTS', d.status, 'https://start-s.payloadnuke.com/tenant-invite/' + d.invitationDetails?.invitationToken)
  process.exit(0)
}
const token = crypto.randomBytes(24).toString('hex')
await payload.create({
  collection: 'tenant-memberships',
  data: {
    tenant: TENANT,
    role: 'tenant_admin',
    status: 'pending',
    invitedBy: 3,
    invitationDetails: {
      invitationPhone: PHONE,
      invitationToken: token,
      invitationExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      invitationMessage: 'Your shop portal is ready — services, prices, and a write-up of the van are on it.',
    },
  } as any,
  overrideAccess: true,
})
console.log('INVITE_URL https://start-s.payloadnuke.com/tenant-invite/' + token)
process.exit(0)
