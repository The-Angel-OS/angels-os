/**
 * Report a message — POST /api/moderation/report
 *
 * The user-facing half of moderation: any logged-in user can report a message
 * (or its author) for review. Reports are appended to the message's
 * `metadata.reports[]` (append-only, schema-free — no new table, prod-safe) and
 * fan out a `content_reported` escalation to the tenant's connectors so a human
 * moderator is notified. This is the report/block capability Google's UGC policy
 * expects of a social app.
 *
 * Body: { messageId: string|number, reason?: string }
 * Auth: any authenticated user.
 * Fail-soft on escalation; the report itself is the durable record.
 *
 * @see src/collections/Messages/hooks/moderateMessage.ts — the reflex (system) half
 * @see src/utilities/escalation.ts — dispatchEscalation (content_reported)
 */
import type { PayloadHandler } from 'payload'
import { extractTextFromContent } from '@/utilities/messageContent'
import { dispatchEscalation } from '@/utilities/escalation'

const MAX_REASON = 500

export const reportMessageHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'authentication required' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try {
    body = (typeof req.json === 'function' ? await req.json() : {}) as Record<string, unknown>
  } catch {
    body = {}
  }

  const messageId = body.messageId as string | number | undefined
  if (messageId == null || messageId === '') {
    return Response.json({ error: 'messageId required' }, { status: 400 })
  }
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, MAX_REASON).trim() : ''

  // Load the reported message (override access — a reporter may not be able to
  // read it under normal RBAC, but they can still report what they saw).
  let message: Record<string, unknown> | null = null
  try {
    message = (await payload.findByID({
      collection: 'messages',
      id: messageId as string | number,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    message = null
  }
  if (!message) return Response.json({ error: 'message not found' }, { status: 404 })

  const now = new Date().toISOString()
  const report = {
    by: (user as { id: unknown }).id,
    reason: reason || null,
    at: now,
  }

  // Append to metadata.reports[] (schema-free JSON; preserves moderation + revisions).
  const prevMeta = (message.metadata && typeof message.metadata === 'object'
    ? (message.metadata as Record<string, unknown>)
    : {}) as Record<string, unknown>
  const prevReports = Array.isArray(prevMeta.reports) ? (prevMeta.reports as unknown[]) : []
  // Idempotent-ish: one report per user per message (replace their prior entry).
  const deduped = prevReports.filter(
    (r) => !(r && typeof r === 'object' && String((r as { by?: unknown }).by) === String(report.by)),
  )

  try {
    await payload.update({
      collection: 'messages',
      id: messageId as string | number,
      data: { metadata: { ...prevMeta, reports: [...deduped, report] } },
      overrideAccess: true,
      context: { skipModeration: true, skipMessageVersioning: true },
    })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'failed to record report' },
      { status: 500 },
    )
  }

  // Escalate to a human moderator (fail-soft).
  const tenantId =
    message.tenant && typeof message.tenant === 'object'
      ? (message.tenant as { id: unknown }).id
      : message.tenant
  if (tenantId != null) {
    const channel = typeof message.channel === 'string' ? message.channel : 'unknown'
    const text = extractTextFromContent(message.content)
    const snippet = text.length > 200 ? `${text.slice(0, 200)}…` : text
    try {
      await dispatchEscalation(payload, {
        tenantId: tenantId as string | number,
        eventType: 'content_reported',
        title: `⚑ User report — #${channel}`,
        message: `${reason ? `Reason: ${reason}\n\n` : ''}"${snippet}"`,
        priority: 6,
        dedupeKey: `report:${messageId}`,
        extras: { messageId, channel, reportedBy: report.by, reportCount: deduped.length + 1 },
      })
    } catch {
      // non-fatal — the report record is already persisted.
    }
  }

  return Response.json({ ok: true, reported: true })
}
