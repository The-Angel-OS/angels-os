/**
 * angelOsEmailLayout — the shared Angel OS branded HTML email shell.
 *
 * This is the chrome you see on the tenant-invitation email (the green "A" mark,
 * the enterprise name, and the "Powered by Angel OS — Everyone gets an Angel."
 * footer). Extracted so EVERY outbound Angel OS email — invites, order
 * confirmations, and now Form Builder submissions — shares one look instead of
 * each sender hand-rolling its own `<html>`.
 *
 * @see src/utilities/sendTenantInvitationEmail.ts — the original of this markup
 */

/** Escape user-supplied values for safe HTML interpolation. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface AngelOsEmailLayoutOptions {
  /** Big H1 heading at the top of the body (already trusted/escaped by caller if needed). */
  heading?: string
  /** The inner body HTML (trusted — caller is responsible for escaping user content). */
  bodyHtml: string
  /** Small brand label under the logo mark (e.g. the tenant/enterprise name). */
  brandName?: string
}

/**
 * Wrap body HTML in the Angel OS branded shell. `bodyHtml` is inserted verbatim,
 * so callers must escape any user-supplied content they place into it. `heading`
 * and `brandName` are escaped here.
 */
export function angelOsEmailLayout({ heading, bodyHtml, brandName }: AngelOsEmailLayoutOptions): string {
  const safeBrand = brandName ? escapeHtml(brandName) : ''
  const safeHeading = heading ? escapeHtml(heading) : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #10B981; color: white; width: 48px; height: 48px; border-radius: 12px; line-height: 48px; font-size: 20px; font-weight: bold;">A</div>
          ${safeBrand ? `<p style="margin: 8px 0 0; font-size: 14px; color: #666;">${safeBrand}</p>` : ''}
        </div>

        ${safeHeading ? `<h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">${safeHeading}</h1>` : ''}

        <div style="font-size: 16px; line-height: 1.5; color: #333;">
          ${bodyHtml}
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

        <p style="font-size: 12px; color: #999; text-align: center;">
          Powered by Angel OS — Everyone gets an Angel.
        </p>
      </body>
    </html>
  `
}
