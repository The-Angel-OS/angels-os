import type { Payload } from 'payload'

/**
 * upsertContactFromLead — every lead automatically becomes (or updates) a CRM
 * Contact, so the contact book harvests itself from BOTH doors: voice calls
 * (deliverLead / capture_lead) and web form submissions (routeFormToAIBus).
 * Previously a lead was only a bus message — it never reached the Contacts
 * collection unless someone asked LEO to save it manually.
 *
 * Dedupe: (tenant + email) first, else (tenant + phone). Updates fill blanks
 * only — a repeat lead never clobbers existing contact data; the new message is
 * appended to notes so the history accumulates.
 *
 * Fail-soft by design: callers wrap this in their own try/catch — a contact
 * upsert failure must never lose the lead message or the operator escalation.
 */
export interface LeadContactInput {
  tenantId: number
  name?: string
  email?: string
  phone?: string
  message?: string
  leadType?: string
  source: 'voice' | 'web-form'
}

export async function upsertContactFromLead(
  payload: Payload,
  input: LeadContactInput,
): Promise<{ contactId?: number | string; created?: boolean }> {
  const email = (input.email ?? '').trim().toLowerCase()
  const phone = (input.phone ?? '').trim()
  if (!email && !phone) return {}

  const { tenantId } = input
  const noteLine = [
    `[${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${input.source}${input.leadType ? ` · ${input.leadType}` : ''}]`,
    input.message?.trim(),
  ]
    .filter(Boolean)
    .join(' ')

  // Find existing: email match first (stronger identity), then phone.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existing: Record<string, any> | undefined
  if (email) {
    const r = await payload.find({
      collection: 'contacts',
      where: { and: [{ tenant: { equals: tenantId } }, { email: { equals: email } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    existing = r.docs[0] as unknown as Record<string, unknown> | undefined
  }
  if (!existing && phone) {
    const r = await payload.find({
      collection: 'contacts',
      where: { and: [{ tenant: { equals: tenantId } }, { phone: { equals: phone } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    existing = r.docs[0] as unknown as Record<string, unknown> | undefined
  }

  const leadTag = input.leadType ? [`lead:${input.leadType}`] : []

  if (existing) {
    // Fill blanks only; append the note; merge tags.
    const prevTags: string[] = Array.isArray(existing.tags) ? existing.tags : []
    const nextTags = [...new Set([...prevTags, ...leadTag])]
    const nextNotes = [existing.notes, noteLine].filter(Boolean).join('\n')
    await payload.update({
      collection: 'contacts',
      id: existing.id,
      data: {
        ...(existing.name ? {} : input.name ? { name: input.name } : {}),
        ...(existing.email ? {} : email ? { email } : {}),
        ...(existing.phone ? {} : phone ? { phone } : {}),
        tags: nextTags,
        notes: nextNotes,
      } as never,
      overrideAccess: true,
    })
    return { contactId: existing.id as number, created: false }
  }

  const created = await payload.create({
    collection: 'contacts',
    data: {
      tenant: tenantId,
      ...(input.name ? { name: input.name } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      source: input.source,
      contactStatus: 'lead',
      tags: leadTag,
      ...(noteLine ? { notes: noteLine } : {}),
    } as never,
    overrideAccess: true,
  })
  return { contactId: created.id as number, created: true }
}
