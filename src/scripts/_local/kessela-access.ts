/**
 * Finish provisioning Kessela and sort out who can get into it.
 *
 * Three gaps found by comparing against a properly-provisioned tenant:
 *   1. Kessela got only the AI Bus space. Clearwater and NeuroCare both have
 *      Community + AI Bus — my provision script called the pages/nav helpers but
 *      never createSpaceFromTemplate, so the portal had nowhere to talk.
 *   2. Ken was tenant_MEMBER on both Kessela and NeuroCare, not tenant_admin.
 *   3. David's NeuroCare invitations (davidc@ and davea@) are still PENDING from
 *      260720 — he has never accepted, so he has never actually seen the portal.
 *
 * Invitations rather than accounts: minting a login for someone who hasn't asked
 * for one is not ours to do. A pending invite is claimable by them, on their
 * terms, and is exactly what NeuroCare already uses.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-access.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { randomUUID } from 'crypto'

import { createSpaceFromTemplate } from '@/utilities/spaceProvisioning'

const payload = await getPayload({ config })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const create = payload.create.bind(payload) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const update = payload.update.bind(payload) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const req = { payload } as any

const OWNER_EMAIL = 'kenneth.courtney@gmail.com'
const INVITEES = ['davidc@neurocarepro.com', 'davea@neurocarepro.com']

async function tenantIdBySlug(slug: string): Promise<number | null> {
  const res = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs?.[0] as { id: number } | undefined)?.id ?? null
}

const kessela = await tenantIdBySlug('kessela')
const neurocare = await tenantIdBySlug('neurocarepro')
if (!kessela) {
  console.error('No kessela tenant.')
  process.exit(1)
}

// ── 1. The missing Community space ──────────────────────────────────────────
const spaces = await payload.find({
  collection: 'spaces',
  where: { and: [{ tenant: { equals: kessela } }, { name: { equals: 'Community' } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

if (spaces.docs?.[0]) {
  console.log('space: Community already present')
} else {
  const { spaceId, channelIds } = await createSpaceFromTemplate(
    payload,
    'retail-commerce',
    kessela,
    'Community',
    req,
  )
  console.log(`space: Community created id=${spaceId} with ${channelIds.length} channel(s)`)
}

// ── 2. Owner should be an admin of what he owns ─────────────────────────────
const owner = await payload.find({
  collection: 'users',
  where: { email: { equals: OWNER_EMAIL } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const ownerId = (owner.docs?.[0] as { id: number } | undefined)?.id

if (ownerId) {
  for (const [slug, tid] of [
    ['kessela', kessela],
    ['neurocarepro', neurocare],
  ] as Array<[string, number | null]>) {
    if (!tid) continue
    const existing = await payload.find({
      collection: 'tenant-memberships',
      where: { and: [{ user: { equals: ownerId } }, { tenant: { equals: tid } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const row = existing.docs?.[0] as { id: number; role?: string } | undefined
    if (row && row.role !== 'tenant_admin') {
      await update({
        collection: 'tenant-memberships',
        id: row.id,
        data: { role: 'tenant_admin', status: 'active' },
        overrideAccess: true,
        req,
      })
      console.log(`owner: ${slug} ${row.role} → tenant_admin`)
    } else if (!row) {
      await create({
        collection: 'tenant-memberships',
        data: {
          user: ownerId,
          tenant: tid,
          role: 'tenant_admin',
          status: 'active',
          joinedAt: new Date().toISOString(),
        },
        overrideAccess: true,
        req,
      })
      console.log(`owner: ${slug} membership created as tenant_admin`)
    } else {
      console.log(`owner: ${slug} already tenant_admin`)
    }
  }
}

// ── 3. Invite David + Dave A into Kessela, mirroring NeuroCare ──────────────
const expires = new Date(Date.now() + 30 * 24 * 3600_000).toISOString()

for (const email of INVITEES) {
  const existing = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { tenant: { equals: kessela } },
        { 'invitationDetails.invitationEmail': { equals: email } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs?.[0]) {
    const row = existing.docs[0] as { id: number; invitationDetails?: { invitationToken?: string } }
    console.log(`invite: ${email} already exists → /tenant-invite/${row.invitationDetails?.invitationToken}`)
    continue
  }

  const token = randomUUID()
  await create({
    collection: 'tenant-memberships',
    data: {
      tenant: kessela,
      role: 'tenant_admin',
      status: 'pending',
      invitedBy: ownerId,
      invitationDetails: {
        invitationToken: token,
        invitationEmail: email,
        invitationExpiresAt: expires,
        invitationMessage: "You've been invited as an administrator of Kessela on Angel OS.",
      },
    },
    overrideAccess: true,
    req,
  })
  console.log(`invite: ${email} → https://kessela.spacesangels.com/tenant-invite/${token}`)
}

// ── 4. Report the NeuroCare invites that were never accepted ────────────────
if (neurocare) {
  const pending = await payload.find({
    collection: 'tenant-memberships',
    where: { and: [{ tenant: { equals: neurocare } }, { status: { equals: 'pending' } }] },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  for (const row of pending.docs as Array<{
    invitationDetails?: { invitationEmail?: string; invitationToken?: string }
    createdAt?: string
  }>) {
    console.log(
      `neurocare STILL PENDING since ${row.createdAt?.slice(0, 10)}: ${row.invitationDetails?.invitationEmail} → https://neurocarepro.payloadnuke.com/tenant-invite/${row.invitationDetails?.invitationToken}`,
    )
  }
}

process.exit(0)
