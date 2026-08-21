/**
 * inviteOwner — mint the portal owner's tenant_admin invite.
 *
 * The factory primitive behind "provision a portal FOR someone": a pending
 * tenant-membership carrying invitationDetails, accepted at /tenant-invite/
 * <token>. Same record the team-admin "Quick Invite" button writes, so the
 * invite shows up on the portal's /dashboard/admin/team page.
 *
 * Lifted out of provision-portal.ts (260820) because the demo-site funnel
 * created a portal and stored the owner's email but never gave that owner a way
 * IN — the whole point of the funnel. Both callers now share this.
 *
 * Email OR phone — at least one, and pass BOTH when you have them or the
 * invitee ends up with twin accounts. A phone-only invite mints the same
 * record and returns the URL for the inviter to text; the invitee signs in with
 * an OTP code and the account is created on first sign-in. `tenant-invite-accept`
 * binds the membership to whoever is logged in, so it never has to match the
 * address the invite was addressed to.
 *
 * Idempotent: an existing active/pending membership for that email or phone
 * returns that one instead of minting a duplicate. Never throws — provisioning a
 * portal that works beats a 500 over an unsent email.
 */
import type { Payload, PayloadRequest } from 'payload'
import { generateInvitationToken, calculateExpiration } from '@/utilities/invitationSystem'
import { sendTenantInvitationEmail } from '@/utilities/sendTenantInvitationEmail'

export type OwnerInvite = {
  email?: string
  phone?: string
  emailSent: boolean
  inviteUrl?: string
  expiresAt?: string
  alreadyInvited?: boolean
  status?: string
  error?: string
}

/**
 * The one place an accept URL is built. Seven call sites string-concatenated
 * `/tenant-invite/${token}` by hand and disagreed about whether to qualify it.
 */
export function inviteUrlFor(token: string, tenantDomain?: string): string {
  const path = `/tenant-invite/${token}`
  return tenantDomain ? `https://${tenantDomain}${path}` : path
}

export interface PendingInvite {
  membershipId: number | string
  role?: string
  status?: string
  email?: string
  phone?: string
  invitedByName?: string
  inviteUrl: string
  expiresAt?: string
  expired: boolean
}

/**
 * Retrieve the accept links that already exist for a portal — the answer to
 * "what link do I text them?" after the fact. Minting an invite returns its URL
 * once; this is how you get it back without minting a duplicate.
 */
export async function listPortalInvites(
  payload: Payload,
  opts: { slug?: string; tenantId?: number | string; includeAccepted?: boolean },
): Promise<{ found: boolean; tenant?: { id: number | string; slug?: string; domain?: string }; invites: PendingInvite[] }> {
  let tenantId = opts.tenantId
  let tenant: { id: number | string; slug?: string; domain?: string } | undefined

  if (opts.slug) {
    const t = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: opts.slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = t.docs?.[0] as { id: number; slug?: string; domain?: string } | undefined
    if (!doc) return { found: false, invites: [] }
    tenantId = doc.id
    tenant = { id: doc.id, slug: doc.slug, domain: doc.domain }
  } else if (tenantId != null) {
    const doc = (await payload.findByID({ collection: 'tenants', id: tenantId as number, depth: 0, overrideAccess: true })) as
      | { id: number; slug?: string; domain?: string }
      | undefined
    if (!doc) return { found: false, invites: [] }
    tenant = { id: doc.id, slug: doc.slug, domain: doc.domain }
  } else {
    return { found: false, invites: [] }
  }

  const res = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { status: { in: opts.includeAccepted ? ['pending', 'active'] : ['pending'] } },
        { 'invitationDetails.invitationToken': { exists: true } },
      ],
    },
    limit: 100,
    depth: 1,
    overrideAccess: true,
  })

  const now = Date.now()
  const invites = (res.docs as unknown as Record<string, unknown>[])
    .map((d) => {
      const det = (d.invitationDetails || {}) as Record<string, string | undefined>
      if (!det.invitationToken) return null
      const by = d.invitedBy as { name?: string; email?: string } | number | undefined
      return {
        membershipId: d.id as number,
        role: d.role as string | undefined,
        status: d.status as string | undefined,
        email: det.invitationEmail,
        phone: det.invitationPhone,
        invitedByName: typeof by === 'object' ? by?.name || by?.email : undefined,
        inviteUrl: inviteUrlFor(det.invitationToken, tenant?.domain),
        expiresAt: det.invitationExpiresAt,
        expired: Boolean(det.invitationExpiresAt && new Date(det.invitationExpiresAt).getTime() < now),
      }
    })
    .filter(Boolean) as PendingInvite[]

  return { found: true, tenant, invites }
}

export async function inviteOwner(
  payload: Payload,
  opts: {
    email?: string
    phone?: string
    tenantId: number | string
    tenantDomain?: string
    tenantName?: string
    invitedBy?: number | string
    inviterName?: string
    message?: string
    req?: PayloadRequest
  },
): Promise<OwnerInvite> {
  const email = opts.email?.trim().toLowerCase() || undefined
  const phone = opts.phone?.trim() || undefined
  const who = { email, phone }
  const urlFor = (token: string) => inviteUrlFor(token, opts.tenantDomain)

  try {
    if (!email && !phone) throw new Error('an owner invite needs an email or a phone')

    // invitedBy is a real FK, and the invite page renders that user's NAME to the
    // prospect: "<name> invited you to join <portal>". The funnel runs with no
    // session, and taking "the first user on the node" put a random member's name
    // in front of a stranger we were pitching (caught on BRE Solutions, 260820).
    // Prefer a super_admin; only fall back to any user to satisfy the FK.
    let inviterId = opts.invitedBy
    if (inviterId == null) {
      const admin = await payload.find({
        collection: 'users',
        where: { roles: { contains: 'super_admin' } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      inviterId = admin.docs?.[0]?.id
    }
    if (inviterId == null) {
      const anyUser = await payload.find({ collection: 'users', limit: 1, depth: 0, overrideAccess: true })
      inviterId = anyUser.docs?.[0]?.id
    }
    if (inviterId == null) throw new Error('no user available to attribute the invite')

    const existing = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { tenant: { equals: opts.tenantId } },
          {
            or: [
              ...(email ? [{ 'invitationDetails.invitationEmail': { equals: email } }] : []),
              ...(phone ? [{ 'invitationDetails.invitationPhone': { equals: phone } }] : []),
            ],
          },
          { status: { in: ['active', 'pending'] } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.totalDocs > 0) {
      const doc = existing.docs[0] as {
        status?: string
        invitationDetails?: { invitationToken?: string; invitationExpiresAt?: string }
      }
      const token = doc.invitationDetails?.invitationToken
      return {
        ...who,
        emailSent: false,
        alreadyInvited: true,
        status: doc.status,
        inviteUrl: token ? urlFor(token) : undefined,
        expiresAt: doc.invitationDetails?.invitationExpiresAt,
      }
    }

    const token = generateInvitationToken()
    const expiresAt = calculateExpiration(7)

    // Portal owner → tenant_admin (they run their own portal). A pending email
    // invite intentionally has NO `user` — it's linked on accept.
    await payload.create({
      collection: 'tenant-memberships',
      data: {
        tenant: opts.tenantId,
        role: 'tenant_admin',
        status: 'pending',
        invitedBy: inviterId,
        invitationDetails: {
          ...(email ? { invitationEmail: email } : {}),
          ...(phone ? { invitationPhone: phone } : {}),
          invitationToken: token,
          invitationExpiresAt: expiresAt.toISOString(),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
    })

    // Phone-only invites are delivered by the inviter, by text — there is no
    // address to mail. The returned URL is the whole deliverable.
    const emailSent = !email
      ? false
      : await sendTenantInvitationEmail({
      payload,
      tenantId: opts.tenantId,
          recipientEmail: email,
          inviterName: opts.inviterName || 'Kenneth Courtney',
          enterpriseName: opts.tenantName || 'your portal',
          inviteUrl: `/tenant-invite/${token}`,
          role: 'tenant_admin',
          message: opts.message,
        })

    return { ...who, emailSent, inviteUrl: urlFor(token), expiresAt: expiresAt.toISOString() }
  } catch (e) {
    return { ...who, emailSent: false, error: e instanceof Error ? e.message : String(e) }
  }
}
