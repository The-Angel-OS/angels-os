import type { Payload } from 'payload'
import { createFormSubmissionContent } from '@/utilities/messageContent'
import { resolveAiBusSpaceId } from '@/utilities/ensureSystemSpace'
import { dispatchToGotify } from '@/utilities/gotifyEscalation'
import { upsertContactFromLead } from '@/utilities/upsertContactFromLead'

/**
 * deliverLead — the one path that lands a lightweight contact/lead into a tenant's
 * inbox WITHOUT a Form Builder form doc.
 *
 * The full form-builder flow (routeFormToAIBus) requires a `forms` row; lead capture
 * on a product page, a "contact the seller" affordance, or a LEO `capture_lead` tool
 * has no such doc. This writes the SAME `form_submission` message shape into the
 * tenant's AI Bus space so the lead shows up in their inbox / priority queue exactly
 * like a real form submission, and escalates to Gotify so the operator's phone lights
 * up. Fail-soft: an escalation or routing miss never loses the lead if the message
 * itself was written.
 *
 * @returns { ok, messageId?, spaceId? } — ok:false when no tenant AI-bus space exists.
 */
export async function deliverLead(
  payload: Payload,
  args: {
    tenantId: number | string
    /** Human title for the submission, e.g. "Contact Seller: 2011 Ferrari 458". */
    formTitle: string
    /** Ordered field label → value pairs surfaced in the inbox summary + data. */
    fields: Record<string, unknown>
    /** Channel slug to post into (default 'support', matching form submissions). */
    channel?: string
    /** Escalate to Gotify (default true). */
    escalate?: boolean
    /** Extra structured metadata stored on the message content data. */
    source?: string
  },
): Promise<{ ok: boolean; messageId?: number | string; spaceId?: number | string; error?: string }> {
  const { tenantId, formTitle, fields, channel = 'support', escalate = true, source } = args

  try {
    const spaceIdRaw = await resolveAiBusSpaceId(payload as never, tenantId)
    if (!spaceIdRaw) return { ok: false, error: 'no AI-bus space for tenant' }
    const spaceId = Number(spaceIdRaw)

    // LEO system user for this tenant → author; else fall back to system user 1.
    let leoUserId: number | undefined
    try {
      const leoUsers = await payload.find({
        collection: 'users',
        where: {
          and: [
            { servesTenant: { equals: tenantId } },
            { 'agentConfig.agentType': { equals: 'leo' } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      leoUserId = leoUsers.docs[0]?.id as number | undefined
    } catch {
      /* fall back to system author */
    }

    // Human-readable summary — mirrors routeFormToAIBus so the inbox row looks identical.
    const fieldLines = Object.entries(fields).map(([label, value]) => {
      const pretty = label.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      const shown = value == null || value === '' ? '(empty)' : String(value)
      return `• **${pretty}:** ${shown}`
    })
    const summaryText = [
      `📋 **New Lead: ${formTitle}**`,
      `Submitted: ${new Date().toISOString()}`,
      '',
      ...fieldLines,
    ].join('\n')

    const content = createFormSubmissionContent(summaryText, fields)
    if (source && content.data && typeof content.data === 'object') {
      ;(content.data as Record<string, unknown>).source = source
    }

    const created = await payload.create({
      collection: 'messages',
      data: {
        content,
        space: spaceId,
        channel,
        messageType: 'form_submission',
        author: leoUserId || 1,
        tenant: tenantId,
        visibility: 'tenant',
      } as never,
      overrideAccess: true,
    })

    // Harvest the CRM contact — every lead becomes (or updates) a Contacts row
    // automatically, so the contact book fills itself from every door. Fail-soft:
    // the message + escalation above are the source of truth; a contact hiccup
    // must never lose the lead.
    try {
      const f = (k: string) =>
        (Object.entries(fields).find(([key]) => key.toLowerCase().includes(k))?.[1] as string | undefined) || undefined
      await upsertContactFromLead(payload, {
        tenantId: Number(tenantId),
        name: f('name'),
        email: f('email'),
        phone: f('phone'),
        message: f('message'),
        leadType: f('leadtype'),
        source: source === 'capture_lead' ? 'voice' : 'web-form',
      })
    } catch (err) {
      console.error('[deliverLead] contact upsert failed (lead message still delivered):', err)
    }

    if (escalate) {
      const who =
        (Object.entries(fields).find(([k]) => k.toLowerCase().includes('name'))?.[1] as string) ||
        (Object.entries(fields).find(([k]) => k.toLowerCase().includes('email'))?.[1] as string) ||
        'someone'
      void dispatchToGotify(payload, {
        tenantId: Number(tenantId),
        eventType: 'form_submission',
        title: `📋 ${formTitle}`,
        message: `New lead from ${String(who)}`,
        priority: 5,
        dedupeKey: `lead:${tenantId}:${formTitle}`,
        extras: { messageId: created.id, source: source || 'lead' },
      }).catch(() => {})
    }

    return { ok: true, messageId: created.id, spaceId }
  } catch (err) {
    payload.logger?.error?.({ err, msg: '[deliverLead] failed to route lead' })
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
