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
 * Idempotent: an existing active/pending membership for the email returns that
 * one instead of minting a duplicate. Never throws — provisioning a portal that
 * works beats a 500 over an unsent email.
 */
import type { Payload, PayloadRequest } from 'payload'
import { generateInvitationToken, calculateExpiration } from '@/utilities/invitationSystem'
import { sendTenantInvitationEmail } from '@/utilities/sendTenantInvitationEmail'

export type OwnerInvite = {
  email: string
  emailSent: boolean
  inviteUrl?: string
  expiresAt?: string
  alreadyInvited?: boolean
  status?: string
  error?: string
}

export async function inviteOwner(
  payload: Payload,
  opts: {
    email: string
    tenantId: number | string
    tenantDomain?: string
    tenantName?: string
    invitedBy?: number | string
    inviterName?: string
    message?: string
    req?: PayloadRequest
  },
): Promise<OwnerInvite> {
  const email = opts.email.trim().toLowerCase()
  const absolute = (path: string) => (opts.tenantDomain ? `https://${opts.tenantDomain}${path}` : path)

  try {
    // invitedBy is a real FK. Fall back to any user on the node when a scripted
    // path (cron/funnel, no session) couldn't resolve a super_admin.
    let inviterId = opts.invitedBy
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
          { 'invitationDetails.invitationEmail': { equals: email } },
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
        email,
        emailSent: false,
        alreadyInvited: true,
        status: doc.status,
        inviteUrl: token ? absolute(`/tenant-invite/${token}`) : undefined,
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
          invitationEmail: email,
          invitationToken: token,
          invitationExpiresAt: expiresAt.toISOString(),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
    })

    // sendTenantInvitationEmail rewrites the accept link to the tenant's own
    // subdomain; the returned URL is fully-qualified for copy-paste.
    const emailSent = await sendTenantInvitationEmail({
      payload,
      tenantId: opts.tenantId,
      recipientEmail: email,
      inviterName: opts.inviterName || 'Kenneth Courtney',
      enterpriseName: opts.tenantName || 'your portal',
      inviteUrl: `/tenant-invite/${token}`,
      role: 'tenant_admin',
      message: opts.message,
    })

    return { email, emailSent, inviteUrl: absolute(`/tenant-invite/${token}`), expiresAt: expiresAt.toISOString() }
  } catch (e) {
    return { email, emailSent: false, error: e instanceof Error ? e.message : String(e) }
  }
}
