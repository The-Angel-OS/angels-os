/**
 * Account deletion request — POST /api/account/deletion-request
 *
 * A deletion request is an EVENT that rides the system's normal escalation chain
 * — never a hardcoded external mailbox. When a user asks to delete their account
 * and data, this:
 *   1. writes a durable in-system record (application-logs),
 *   2. posts a visible message into the tenant's #system-engineering channel
 *      (so a portal admin sees it on the AI bus), and
 *   3. fans out an `account_deletion_requested` escalation through whatever
 *      connectors the PORTAL ADMIN has configured (Gotify/Telegram/Webhook, and —
 *      once an email transport is registered — the per-tenant email_outbound
 *      connector as the configurable last step).
 *
 * WHERE the request lands is entirely configuration: it follows the tenant's
 * connectors, resolved at request time. Nothing about the recipient is baked in.
 *
 * Body: { email?: string, reason?: string }  (email required if not authenticated)
 * Auth: optional — a signed-in user is identified automatically; an anonymous
 * request must carry the account email so an admin can locate it.
 * Fail-soft: the durable log is the artifact; messaging/escalation are best-effort.
 *
 * @see src/utilities/escalation.ts        — dispatchEscalation
 * @see src/utilities/resolveEmailSender.ts       — per-tenant configurable email
 * @see src/utilities/leo-data-tools.ts            — log_maintenance_note (same rails)
 */
import type { PayloadHandler } from 'payload'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { wrapTextContent } from '@/utilities/messageContent'
import { dispatchEscalation } from '@/utilities/escalation'

const MAX_REASON = 1000

export const accountDeletionRequestHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  let body: Record<string, unknown> = {}
  try {
    body = (typeof req.json === 'function' ? await req.json() : {}) as Record<string, unknown>
  } catch {
    body = {}
  }

  const bodyEmail = typeof body.email === 'string' ? body.email.trim() : ''
  const requesterEmail = (user as { email?: string } | null)?.email || bodyEmail
  if (!requesterEmail) {
    return Response.json(
      { error: 'Sign in, or include the email address on your account.' },
      { status: 400 },
    )
  }
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, MAX_REASON).trim() : ''

  // Resolve the tenant whose admins should receive this — config-driven, from the
  // serving host / x-tenant-id, exactly like the rest of the dashboard.
  let tenantId: number | string | null = null
  try {
    const resolved = await resolveTenantFromHeaders()
    tenantId = resolved.tenantId ?? null
  } catch {
    tenantId = null
  }

  const now = new Date().toISOString()
  const requesterId = (user as { id?: unknown } | null)?.id ?? null

  // 1) Durable in-system record (visible in the dashboard's logs).
  try {
    await payload.create({
      collection: 'application-logs',
      data: {
        level: 'warn',
        source: 'account/deletion-request',
        message: `[DELETION REQUEST] ${requesterEmail}`,
        details: JSON.stringify({ requesterEmail, requesterId, reason, tenantId: tenantId || 'platform', requestedAt: now }),
        ...(tenantId ? { tenantId } : {}),
        resolved: false,
      } as never,
      overrideAccess: true,
    })
  } catch {
    // If even the durable log fails we still try to notify below.
  }

  // 2) Visible post into the tenant's #system-engineering channel + 3) escalation.
  if (tenantId) {
    try {
      const spaces = await payload.find({
        collection: 'spaces',
        where: { tenant: { equals: tenantId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        sort: '-createdAt',
      })
      const spaceId = spaces.docs?.[0]?.id as number | undefined
      if (spaceId) {
        const body = [
          `🗑️ **Account deletion request**`,
          `- **From:** ${requesterEmail}`,
          requesterId != null ? `- **User ID:** ${requesterId}` : null,
          reason ? `- **Reason:** ${reason}` : null,
          '',
          `Verify the requester and complete deletion within 30 days, per the Delete Account policy.`,
        ]
          .filter(Boolean)
          .join('\n')

        await payload.create({
          collection: 'messages',
          data: {
            content: wrapTextContent(body),
            space: spaceId,
            channel: 'system-engineering',
            messageType: 'system',
            author: 1,
            tenant: tenantId,
            visibility: 'tenant',
          } as never,
          overrideAccess: true,
          context: { skipModeration: true },
        })
      }
    } catch {
      // non-fatal — the durable log already captured the request.
    }

    void dispatchEscalation(payload, {
      tenantId,
      eventType: 'account_deletion_requested',
      title: `🗑️ Account deletion request`,
      message: `${requesterEmail}${reason ? ` — ${reason}` : ''}`,
      priority: 6,
      dedupeKey: `deletion:${requesterEmail}`,
      extras: { requesterEmail, requesterId },
    })
  }

  return Response.json({
    ok: true,
    received: true,
    message:
      'Your deletion request has been sent to the administrators of your community. They will verify and complete it within 30 days.',
  })
}
