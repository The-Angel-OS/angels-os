/**
 * Tenant Invitation Email Sender
 *
 * Sends tenant-level (Enterprise) invitation emails.
 * Variant of sendInvitationEmail.ts for tenant-level invites.
 *
 * @see src/utilities/sendInvitationEmail.ts — space-level equivalent
 */
import type { Payload } from 'payload'
import { getServerSideURL } from '@/utilities/getURL'
import { resolveEmailSender } from '@/utilities/resolveEmailSender'

export interface SendTenantInvitationEmailOptions {
  payload: Payload
  /** Tenant ID — used to resolve per-tenant email outbound connector */
  tenantId?: number | string | null
  recipientEmail: string
  /** Invitee's name (for a personal greeting). Optional. */
  recipientName?: string
  inviterName: string
  enterpriseName: string
  inviteUrl: string
  role: string
  message?: string
  /** Carbon-copy recipient(s) — e.g. the inviter, to verify delivery. */
  cc?: string | string[]
}

/** Escape user-supplied values for safe HTML interpolation */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendTenantInvitationEmail(
  opts: SendTenantInvitationEmailOptions,
): Promise<boolean> {
  const {
    payload,
    tenantId,
    recipientEmail,
    recipientName,
    inviterName,
    enterpriseName,
    inviteUrl,
    role,
    message,
    cc,
  } = opts

  const baseUrl = getServerSideURL()
  const fullInviteUrl = inviteUrl.startsWith('http') ? inviteUrl : `${baseUrl}${inviteUrl}`

  const roleLabel = role.replace('tenant_', '').replace('_', ' ')
  const subject = `${inviterName} invited you to join ${enterpriseName}`

  // Escape all user-supplied values before HTML interpolation
  const safeInviterName = esc(inviterName)
  const safeEnterpriseName = esc(enterpriseName)
  const safeRoleLabel = esc(roleLabel)
  const safeMessage = message ? esc(message) : ''
  const safeInviteUrl = esc(fullInviteUrl)
  const greetingName = recipientName?.trim() ? esc(recipientName.trim()) : ''

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #10B981; color: white; width: 48px; height: 48px; border-radius: 12px; line-height: 48px; font-size: 20px; font-weight: bold;">A</div>
          <p style="margin: 8px 0 0; font-size: 14px; color: #666;">${safeEnterpriseName}</p>
        </div>

        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">${greetingName ? `Hi ${greetingName} — you're invited!` : `You're invited!`}</h1>

        <p style="font-size: 16px; line-height: 1.5; color: #333;">
          <strong>${safeInviterName}</strong> has invited you to join
          <strong>${safeEnterpriseName}</strong> as a <strong>${safeRoleLabel}</strong>.
        </p>

        ${
          safeMessage
            ? `
          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="font-size: 14px; color: #666; margin: 0 0 4px;">Personal message:</p>
            <p style="font-size: 15px; color: #333; margin: 0; font-style: italic;">"${safeMessage}"</p>
          </div>
        `
            : ''
        }

        <div style="text-align: center; margin: 32px 0;">
          <a href="${safeInviteUrl}"
             style="display: inline-block; background: #10B981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
            Accept Invitation
          </a>
        </div>

        <p style="font-size: 13px; color: #999; text-align: center;">
          This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

        <p style="font-size: 12px; color: #999; text-align: center;">
          Powered by Angel OS — Everyone gets an Angel.
        </p>
      </body>
    </html>
  `

  const text = `${inviterName} invited you to join ${enterpriseName} as a ${roleLabel}.${message ? `\n\nMessage: "${message}"` : ''}\n\nAccept the invitation: ${fullInviteUrl}\n\nThis invitation expires in 7 days.`

  try {
    const sender = await resolveEmailSender(payload, tenantId)
    await sender.sendEmail({ to: recipientEmail, subject, html, text, cc })
    return true
  } catch (err) {
    console.warn(
      `[Tenant Invitation Email] Could not send email to ${recipientEmail}. Invite URL: ${fullInviteUrl}`,
      err instanceof Error ? err.message : err,
    )
    return false
  }
}
