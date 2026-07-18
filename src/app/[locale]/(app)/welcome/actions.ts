'use server'

/**
 * Reception (/welcome) — server actions.
 *
 * The invite step mints the SAME canonical tenant-membership invites the team
 * "Quick Invite" button and provision-portal use (a pending tenant-membership
 * carrying invitationDetails, accepted at /tenant-invite/<token>), so invitees
 * show up on the team page and land inside the endeavor on accept.
 * @see src/endpoints/provision-portal.ts (the shape mirrored here)
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import {
  generateInvitationToken,
  calculateExpiration,
  isValidEmail,
} from '@/utilities/invitationSystem'
import { sendTenantInvitationEmail } from '@/utilities/sendTenantInvitationEmail'

export interface InviteResult {
  success: boolean
  invited: { email: string; emailSent: boolean; error?: string }[]
  error?: string
}

/**
 * Invite a batch of people into the current endeavor as members.
 * Skips blanks/dupes/invalid addresses; each valid address gets a pending
 * tenant-membership + an invitation email.
 */
export async function inviteToEndeavor(emailsRaw: string[]): Promise<InviteResult> {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) return { success: false, invited: [], error: 'Not authenticated' }
  if (!checkRole(ADMIN_ROLES, user)) {
    return { success: false, invited: [], error: 'Insufficient permissions' }
  }

  const { tenantId, tenant } = await resolveTenantFromHeaders()
  if (!tenantId) return { success: false, invited: [], error: 'Tenant not found' }

  // Normalize: trim, lowercase, de-dupe, keep only valid addresses.
  const emails = Array.from(
    new Set(
      emailsRaw
        .map((e) => (e || '').trim().toLowerCase())
        .filter((e) => e && isValidEmail(e)),
    ),
  )
  if (!emails.length) {
    return { success: false, invited: [], error: 'No valid email addresses' }
  }

  const enterpriseName =
    (tenant as { branding?: { siteName?: string }; name?: string })?.branding?.siteName ||
    (tenant as { name?: string })?.name ||
    'your endeavor'
  const inviterName =
    (user as { name?: string; email?: string }).name ||
    (user as { email?: string }).email ||
    'A friend'

  const invited: InviteResult['invited'] = []
  for (const email of emails) {
    try {
      const token = generateInvitationToken()
      const expiresAt = calculateExpiration(7)
      await payload.create({
        collection: 'tenant-memberships',
        data: {
          tenant: tenantId,
          role: 'member',
          status: 'pending',
          invitedBy: user.id,
          invitationDetails: {
            invitationEmail: email,
            invitationToken: token,
            invitationExpiresAt: expiresAt.toISOString(),
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        overrideAccess: true,
      })
      const emailSent = await sendTenantInvitationEmail({
        payload,
        tenantId,
        recipientEmail: email,
        inviterName,
        enterpriseName,
        inviteUrl: `/tenant-invite/${token}`,
        role: 'member',
      })
      invited.push({ email, emailSent })
    } catch (e) {
      invited.push({ email, emailSent: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return { success: true, invited }
}
