/**
 * moderateMessage — stamp a moderation verdict on every human message, and
 * escalate anything flagged to a human moderator.
 *
 * This is what lets Angel OS honestly state that **every message is screened**:
 * the reflex classifier ({@link moderateText}) runs on each new user message,
 * the verdict is written to `metadata.moderation`, and a non-`ok` verdict fans
 * out a `content_flagged` escalation to the tenant's connectors (Gotify/Telegram/
 * webhook). The message is NOT deleted or hidden here — classification and
 * enforcement are separate; a human (or a later policy) acts on the flag.
 *
 * Scope: `create` only, and only genuinely human messages (`messageType: 'user'`).
 * System / AI-agent / normalized form/transaction messages are skipped — LEO's
 * own output and machine events don't need reflex screening.
 *
 * Fail-soft: any error is swallowed; moderation must never break message save.
 * The metadata write passes context flags so it neither re-triggers moderation
 * nor marks the message "(edited)".
 *
 * @see src/utilities/moderation.ts        — the classifier (cerebellum)
 * @see src/utilities/escalation.ts  — dispatchEscalation (content_flagged)
 */
import type { CollectionAfterChangeHook } from 'payload'
import { extractTextFromContent } from '@/utilities/messageContent'
import { moderateText } from '@/utilities/moderation'
import { dispatchEscalation } from '@/utilities/escalation'

export const moderateMessage: CollectionAfterChangeHook = async ({ doc, operation, req, context }) => {
  if (operation !== 'create') return doc
  if (context?.skipModeration) return doc
  // Only screen human submittals. LEO/system/normalized messages are exempt.
  if (doc?.messageType && doc.messageType !== 'user') return doc

  try {
    const text = extractTextFromContent(doc?.content)
    if (!text || !text.trim()) return doc

    const verdict = moderateText(text, new Date().toISOString())

    // Annotate every message — `ok` included — so the screening is provable and
    // moderators can audit what passed, not just what tripped.
    const prevMeta = doc?.metadata && typeof doc.metadata === 'object' ? doc.metadata : {}
    await req.payload.update({
      collection: 'messages',
      id: doc.id,
      data: { metadata: { ...prevMeta, moderation: verdict } },
      overrideAccess: true,
      // ⚠️ THE FIX for the message-send hang: pass `req` so this nested update joins
      // the create's SAME transaction. Without it, the update ran in a SEPARATE
      // transaction and blocked forever on the Postgres ROW LOCK the uncommitted
      // create holds on this row → the create awaited the update → DEADLOCK → POST
      // /api/chat/send hung, message never committed. (overrideLock didn't help: that
      // skips Payload's doc-lock feature, not the row lock.) Reusing the transaction
      // lets the update see + modify the still-uncommitted row with no conflict.
      req,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      overrideLock: true as any,
      // Don't re-moderate the metadata write, and don't let it count as an edit.
      context: { skipModeration: true, skipMessageVersioning: true },
    })

    if (verdict.status === 'ok') return doc

    // Resolve tenant for the escalation (multi-tenant plugin field).
    const tenantId =
      doc?.tenant && typeof doc.tenant === 'object' ? (doc.tenant as { id: unknown }).id : doc?.tenant
    if (tenantId == null) return doc

    const channel = typeof doc?.channel === 'string' ? doc.channel : 'unknown'
    const snippet = text.length > 200 ? `${text.slice(0, 200)}…` : text

    await dispatchEscalation(req.payload, {
      tenantId: tenantId as string | number,
      eventType: 'content_flagged',
      title: `⚑ Message flagged for ${verdict.status} — #${channel}`,
      message: `${verdict.reason || verdict.categories.join(', ')}\n\n"${snippet}"`,
      // block-tier rides higher than review-tier.
      priority: verdict.status === 'block' ? 8 : 5,
      dedupeKey: `${channel}:${verdict.categories.join(',')}`,
      extras: {
        messageId: doc.id,
        channel,
        status: verdict.status,
        categories: verdict.categories,
        score: verdict.score,
      },
    })
  } catch {
    // Fail-soft: never break message creation because moderation hiccuped.
  }

  return doc
}
