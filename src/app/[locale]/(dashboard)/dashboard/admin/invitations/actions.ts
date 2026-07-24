'use server'

/**
 * Invitations — Server Actions
 *
 * Quick Invite: create a TenantMembership with invitation details and send email.
 * Uses existing invitation infrastructure from invitationSystem.ts and sendTenantInvitationEmail.ts.
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { generateInvitationToken, calculateExpiration, isValidEmail } from '@/utilities/invitationSystem'
import { sendTenantInvitationEmail } from '@/utilities/sendTenantInvitationEmail'
import { getServerSideURL } from '@/utilities/getURL'

// ── Types ────────────────────────────────────────────────────────────────────

export interface QuickInviteResult {
  success: boolean
  inviteUrl?: string
  emailSent?: boolean
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthenticatedAdmin() {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    return { payload, user: null, tenantId: null, tenantName: '', error: 'Not authenticated' }
  }

  const isAdmin = checkRole(ADMIN_ROLES, user)

  if (!isAdmin) {
    return { payload, user, tenantId: null, tenantName: '', error: 'Insufficient permissions' }
  }

  // Shared tenant resolution (x-tenant-id → domain → DEFAULT_TENANT_SLUG) so the
  // apex/federation host resolves correctly. See AUTH_CONTEXT_REFACTOR.md.
  const { tenant, tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) {
    return { payload, user, tenantId: null, tenantName: '', error: 'Tenant not found' }
  }

  return { payload, user, tenantId, tenantName: tenant?.name || 'Enterprise', error: null }
}

// ── sendQuickInvite ──────────────────────────────────────────────────────────

export async function sendQuickInvite(input: {
  email?: string
  phone?: string
  role: string
  message?: string
  firstName?: string
  lastName?: string
}): Promise<QuickInviteResult> {
  const { payload, user, tenantId, tenantName, error } = await getAuthenticatedAdmin()
  if (error || !tenantId || !user) {
    return { success: false, error: error || 'Auth failed' }
  }

  const role = input.role || 'tenant_member'

  // ── Phone invite: no outbound SMS yet — create the pending membership keyed
  // to the E.164 number, hand back the link for the admin to text themselves.
  // The invitee signs in with a texted code; verifyOtpSms matches the approved
  // phone to this row, creates their account, and activates the membership.
  if (input.phone?.trim()) {
    const { normalizePhone } = await import('@/utilities/otpLogin')
    const phone = normalizePhone(input.phone)
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return { success: false, error: 'Please enter a valid mobile number' }
    }

    const existingPhone = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { 'invitationDetails.invitationPhone': { equals: phone } },
          { status: { in: ['active', 'pending'] } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existingPhone.totalDocs > 0) {
      return {
        success: false,
        error:
          (existingPhone.docs[0] as any).status === 'active'
            ? 'This person is already a member of your Enterprise'
            : 'An invitation is already pending for this number',
      }
    }

    const token = generateInvitationToken()
    const inviteUrl = `${getServerSideURL()}/tenant-invite/${token}`
    try {
      await payload.create({
        collection: 'tenant-memberships',
        data: {
          tenant: tenantId,
          role,
          status: 'pending',
          invitedBy: user.id,
          invitationDetails: {
            invitationName: [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(' ') || undefined,
            invitationPhone: phone,
            invitationToken: token,
            invitationExpiresAt: calculateExpiration(7).toISOString(),
            invitationMessage: input.message,
          },
        } as any,
        overrideAccess: true,
      })
    } catch (e) {
      payload.logger.error(
        `[sendQuickInvite] Failed to create phone invitation for ${phone}: ${e instanceof Error ? e.message : e}`,
      )
      return { success: false, error: 'Could not create the invitation. Please try again.' }
    }
    await upsertInvitedContact(payload, tenantId, {
      phone,
      name: [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(' ') || undefined,
    })
    return { success: true, inviteUrl, emailSent: false }
  }

  const email = input.email?.trim().toLowerCase()
  if (!email || !isValidEmail(email)) {
    return { success: false, error: 'Please enter a valid email address' }
  }

  // Check if an active or pending membership already exists for this email
  const existing = await payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { 'invitationDetails.invitationEmail': { equals: email } },
        { status: { in: ['active', 'pending'] } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.totalDocs > 0) {
    const existingStatus = (existing.docs[0] as any).status
    if (existingStatus === 'active') {
      return { success: false, error: 'This person is already a member of your Enterprise' }
    }
    return { success: false, error: 'An invitation is already pending for this email' }
  }

  // Generate invitation token and create membership
  const token = generateInvitationToken()
  const expiresAt = calculateExpiration(7)
  const baseUrl = getServerSideURL()
  const inviteUrl = `${baseUrl}/tenant-invite/${token}`

  // A pending email invitation intentionally has NO `user` (the invitee has no
  // account yet — it's linked on accept). Guarded so a create failure returns a
  // friendly message instead of a 500 from the server action.
  try {
    await payload.create({
      collection: 'tenant-memberships',
      data: {
        tenant: tenantId,
        role,
        status: 'pending',
        invitedBy: user.id,
        invitationDetails: {
          invitationEmail: email,
          invitationToken: token,
          invitationExpiresAt: expiresAt.toISOString(),
        },
      } as any,
      overrideAccess: true,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    payload.logger.error(`[sendQuickInvite] Failed to create invitation for ${email}: ${msg}`)
    return { success: false, error: 'Could not create the invitation. Please try again.' }
  }

  // Send invitation email
  const inviterName = (user as any).name || (user as any).email || 'An admin'
  const inviterEmail = (user as any).email as string | undefined
  const recipientName = [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(' ')
  let emailSent = false
  try {
    emailSent = await sendTenantInvitationEmail({
      payload,
      tenantId,
      recipientEmail: email,
      recipientName: recipientName || undefined,
      inviterName,
      enterpriseName: tenantName,
      inviteUrl,
      role,
      message: input.message,
      // CC the inviter so they can confirm the email path actually delivered.
      cc: inviterEmail && inviterEmail.toLowerCase() !== email ? inviterEmail : undefined,
    })
  } catch {
    // Email sending failed — invitation is still created
  }

  await upsertInvitedContact(payload, tenantId, {
    email,
    name: [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(' ') || undefined,
  })
  return { success: true, inviteUrl, emailSent }
}

/**
 * Gap B fix (260724): Quick Invite wrote a tenant-membership but never a Contact,
 * so the Invitations board and the Contacts board showed disjoint people. Every
 * invited person should exist as a Contact at `invited`. Dedupe by (tenant+email)
 * then (tenant+phone); fill blanks only. Fail-soft — never block the invite.
 */
async function upsertInvitedContact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  tenantId: number | string,
  who: { email?: string; phone?: string; name?: string },
): Promise<void> {
  const email = who.email?.trim().toLowerCase()
  const phone = who.phone?.trim()
  if (!email && !phone) return
  try {
    const or: Record<string, unknown>[] = []
    if (email) or.push({ email: { equals: email } })
    if (phone) or.push({ phone: { equals: phone } })
    const existing = await payload.find({
      collection: 'contacts',
      where: { and: [{ tenant: { equals: tenantId } }, { or }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const now = new Date().toISOString()
    const row = existing.docs[0] as { id: number; name?: string; email?: string; phone?: string } | undefined
    if (row) {
      await payload.update({
        collection: 'contacts',
        id: row.id,
        data: {
          contactStatus: 'invited',
          inviteStatus: 'pending',
          lastInvitedAt: now,
          ...(row.name ? {} : who.name ? { name: who.name } : {}),
          ...(row.email ? {} : email ? { email } : {}),
          ...(row.phone ? {} : phone ? { phone } : {}),
        },
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'contacts',
        data: {
          tenant: tenantId,
          source: 'manual',
          contactStatus: 'invited',
          inviteStatus: 'pending',
          lastInvitedAt: now,
          ...(who.name ? { name: who.name } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
        },
        overrideAccess: true,
      })
    }
  } catch (err) {
    payload.logger?.warn?.(
      `[sendQuickInvite] contact upsert failed: ${err instanceof Error ? err.message : err}`,
    )
  }
}
