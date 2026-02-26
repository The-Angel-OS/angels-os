/**
 * Invitation Email Sender — Sprint 6
 *
 * Sends invitation emails using Payload's configured email adapter
 * (nodemailer). Falls back to logging the invite URL if no email
 * transport is configured.
 *
 * @see src/utilities/invitationSystem.ts — generates tokens and URLs
 */
import type { Payload } from 'payload'

export interface SendInvitationEmailOptions {
  payload: Payload
  recipientEmail: string
  inviterName: string
  spaceName: string
  inviteUrl: string
  role: string
  message?: string
  tenantName?: string
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

export async function sendInvitationEmail(opts: SendInvitationEmailOptions): Promise<boolean> {
  const {
    payload,
    recipientEmail,
    inviterName,
    spaceName,
    inviteUrl,
    role,
    message,
    tenantName,
  } = opts

  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const fullInviteUrl = inviteUrl.startsWith('http') ? inviteUrl : `${baseUrl}${inviteUrl}`

  const subject = `${inviterName} invited you to join ${spaceName}`

  // Escape all user-supplied values before HTML interpolation
  const safeInviterName = esc(inviterName)
  const safeSpaceName = esc(spaceName)
  const safeRole = esc(role)
  const safeTenantName = tenantName ? esc(tenantName) : ''
  const safeMessage = message ? esc(message) : ''
  const safeInviteUrl = esc(fullInviteUrl)

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
          ${safeTenantName ? `<p style="margin: 8px 0 0; font-size: 14px; color: #666;">${safeTenantName}</p>` : ''}
        </div>

        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">You're invited!</h1>

        <p style="font-size: 16px; line-height: 1.5; color: #333;">
          <strong>${safeInviterName}</strong> has invited you to join
          <strong>${safeSpaceName}</strong> as a <strong>${safeRole}</strong>.
        </p>

        ${safeMessage ? `
          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="font-size: 14px; color: #666; margin: 0 0 4px;">Personal message:</p>
            <p style="font-size: 15px; color: #333; margin: 0; font-style: italic;">"${safeMessage}"</p>
          </div>
        ` : ''}

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

  const text = `${inviterName} invited you to join ${spaceName} as a ${role}.${message ? `\n\nMessage: "${message}"` : ''}\n\nAccept the invitation: ${fullInviteUrl}\n\nThis invitation expires in 7 days.`

  try {
    await payload.sendEmail({
      to: recipientEmail,
      subject,
      html,
      text,
    })
    return true
  } catch (err) {
    // Email transport may not be configured — log the invite URL instead
    console.warn(
      `[Invitation Email] Could not send email to ${recipientEmail}. Invite URL: ${fullInviteUrl}`,
      err instanceof Error ? err.message : err,
    )
    return false
  }
}
