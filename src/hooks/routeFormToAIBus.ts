import type { CollectionAfterChangeHook } from 'payload'
import { createFormSubmissionContent } from '@/utilities/messageContent'
import { dispatchEscalation } from '@/utilities/escalation'

/**
 * Route form submissions to the AI Bus (Messages collection).
 *
 * When a form is submitted (via the Payload form-builder plugin),
 * this hook creates a `form_submission` message in the tenant's
 * default space so LEO can see and respond to it.
 *
 * Non-blocking: all errors are caught and logged — never fails the submission.
 */
export const routeFormToAIBus: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  try {
    const payload = req.payload
    const submissionData = doc.submissionData as Array<{ field: string; value: unknown }> | undefined
    if (!submissionData?.length) return doc

    // Resolve the form to get its title
    const formRef = doc.form
    const formId = typeof formRef === 'object' ? (formRef as any)?.id : formRef
    if (!formId) return doc

    let formTitle = 'Unknown Form'
    try {
      const form = await payload.findByID({
        collection: 'forms',
        id: formId,
        depth: 0,
        overrideAccess: true,
      })
      formTitle = (form as any)?.title || 'Untitled Form'
    } catch {
      // Form lookup failed — continue with default title
    }

    // Resolve tenant: try from the authenticated user's tenant memberships
    // or from the request headers (x-tenant-id)
    let tenantId: number | undefined

    // Try the request user's served tenant (system users)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = req.user as any
    if (user?.servesTenant) {
      tenantId = typeof user.servesTenant === 'object'
        ? user.servesTenant?.id
        : user.servesTenant as number
    }

    // Fallback: try tenant memberships
    if (!tenantId && user?.id) {
      try {
        const memberships = await payload.find({
          collection: 'tenant-memberships',
          where: { user: { equals: user.id }, status: { equals: 'active' } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (memberships.docs[0]) {
          const mem = memberships.docs[0] as any
          tenantId = typeof mem.tenant === 'object' ? mem.tenant?.id : mem.tenant as number
        }
      } catch {
        // Continue without tenant
      }
    }

    // Fallback: try x-tenant-id header
    if (!tenantId) {
      const headerTenant = req.headers?.get?.('x-tenant-id') || (req.headers as any)?.['x-tenant-id']
      if (headerTenant) {
        try {
          const tenants = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: String(headerTenant) } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          tenantId = tenants.docs[0]?.id as number | undefined
        } catch {
          // Continue without tenant
        }
      }
    }

    if (!tenantId) {
      // No tenant context — can't route to AI bus
      return doc
    }

    // Find a space to post the message into
    let spaceId: number | undefined
    try {
      const spaces = await payload.find({
        collection: 'spaces',
        where: { tenant: { equals: tenantId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        sort: '-createdAt',
      })
      spaceId = spaces.docs[0]?.id as number | undefined
    } catch {
      // No space found
    }

    if (!spaceId) return doc

    // Find the LEO system user for this tenant
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
      // Use fallback author
    }

    // Render a single submission value — signature fields are a JSON payload, so
    // surface them as a readable "signed by" line instead of dumping raw JSON.
    const renderValue = (raw: unknown): string => {
      if (raw == null || raw === '') return '(empty)'
      const str = String(raw)
      if (str.includes('__signature')) {
        try {
          const s = JSON.parse(str) as { __signature?: boolean; signerName?: string; type?: string; agreement?: string }
          if (s.__signature && s.signerName) {
            return `✍️ Signed by ${s.signerName} (${s.type === 'drawn' ? 'drawn' : 'typed'})${s.agreement ? ' — agreement accepted' : ''}`
          }
        } catch {
          /* fall through to raw */
        }
      }
      return str
    }

    // Build human-readable submission text
    const fieldLines = submissionData.map((f) => {
      // Convert field name to label: "full-name" → "Full Name"
      const label = f.field
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
      return `• **${label}:** ${renderValue(f.value)}`
    })

    const summaryText = [
      `📋 **New Form Submission: ${formTitle}**`,
      `Submitted: ${new Date().toISOString()}`,
      '',
      ...fieldLines,
      '',
      `---`,
      `Form ID: ${formId} | Submission ID: ${doc.id}`,
    ].join('\n')

    // Build submission data as a record for UMS
    const formDataRecord: Record<string, unknown> = {}
    for (const f of submissionData) {
      formDataRecord[f.field] = f.value
    }

    // Create the Message
    await payload.create({
      collection: 'messages',
      data: {
        content: createFormSubmissionContent(summaryText, formDataRecord, formId),
        space: spaceId,
        channel: 'support', // Default channel for form submissions
        messageType: 'form_submission',
        author: leoUserId || 1, // LEO or fallback to system
        tenant: tenantId,
        visibility: 'tenant',
      } as any,
      req,
      overrideAccess: true,
    })

    // Harvest the CRM contact from the form fields — the contact book fills
    // itself from web submissions the same way it does from voice leads.
    // Fail-soft: the message above is the source of truth.
    try {
      const { upsertContactFromLead } = await import('@/utilities/upsertContactFromLead')
      const pick = (k: string) =>
        (submissionData.find((f) => f.field.toLowerCase().includes(k))?.value as string | undefined) || undefined
      await upsertContactFromLead(payload, {
        tenantId: Number(tenantId),
        name: pick('name'),
        email: pick('email'),
        phone: pick('phone'),
        message: pick('message'),
        leadType: pick('contacttype') || pick('leadtype'),
        source: 'web-form',
      })
    } catch (err) {
      console.error('[routeFormToAIBus] contact upsert failed (message still delivered):', err)
    }

    // Escalate to Gotify so the operator's phone lights up on a new lead/contact.
    // Fail-soft and policy-gated per gotify connector (see escalation.ts) —
    // dedupeKey is per-form so a burst of one form's submissions is throttled but
    // different forms still each get through.
    const firstValue = (name: string) => {
      const hit = submissionData.find(
        (f) => f.field.toLowerCase().includes(name) && typeof f.value === 'string' && !f.value.includes('__signature'),
      )
      return hit?.value
    }
    const who = firstValue('name') || firstValue('email') || 'someone'
    void dispatchEscalation(payload, {
      tenantId,
      eventType: 'form_submission',
      title: `📋 ${formTitle}`,
      message: `New submission from ${String(who)}`,
      priority: 5,
      dedupeKey: `form:${formId}`,
      extras: { formId, submissionId: doc.id },
    }).catch(() => {})
  } catch (err) {
    // Non-blocking: log but never fail the form submission
    req.payload.logger?.error?.({
      err,
      msg: `[routeFormToAIBus] Failed to route form submission ${doc.id} to AI bus`,
    })
  }

  return doc
}
