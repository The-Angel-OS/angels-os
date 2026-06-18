/**
 * ensureTenantContactForm — give a tenant the real Payload Form Builder contact
 * form (not a plain text page). Form submissions already route to the AI Bus →
 * LEO globally (formSubmissionOverrides.hooks.afterChange: routeFormToAIBus), so
 * creating the form is all that's needed for the LEO wiring.
 *
 * Idempotent: find-or-create the 'Contact Form' for the tenant, then ensure the
 * /contact page's layout includes a formBlock pointing at it. Reuses the seed
 * template (contactFormData) so provisioning and the seed stay identical.
 */
import type { Payload, PayloadRequest } from 'payload'
import { contactFormData } from '@/endpoints/seed/contact-form'

export interface EnsureContactFormResult {
  formId: number | string | null
  formCreated: boolean
  pageWired: boolean
  note: string
}

export async function ensureTenantContactForm(
  payload: Payload,
  tenantId: number | string,
  req?: PayloadRequest,
): Promise<EnsureContactFormResult> {
  // 1. Find-or-create the Contact Form. Forms are NOT tenant-scoped in the plugin
  // (the collection has no `tenant` field), so we cannot query/set it — doing so
  // throws "path cannot be queried: tenant" and broke this helper for every tenant.
  // The per-tenant binding is the /contact page's formBlock (step 2), which IS
  // tenant-scoped; submissions route to the right tenant by request host at submit
  // time (routeFormToAIBus), so a single shared Contact Form is correct.
  const existing = await payload.find({
    collection: 'forms',
    where: { title: { equals: 'Contact Form' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  let formId: number | string | null = (existing.docs?.[0]?.id as number | string) ?? null
  let formCreated = false

  if (!formId) {
    // Strip the template's hard-coded timestamps — Payload sets its own.
    const { createdAt: _c, updatedAt: _u, ...data } = contactFormData() as Record<string, unknown>
    const created = await payload.create({
      collection: 'forms',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { ...data } as any,
      overrideAccess: true,
      req,
    })
    formId = created.id
    formCreated = true
  }

  // 2. Ensure the /contact page renders the form via a formBlock.
  let pageWired = false
  const pages = await payload.find({
    collection: 'pages',
    where: { and: [{ slug: { equals: 'contact' } }, { tenant: { equals: tenantId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const page = pages.docs?.[0] as { id: number | string; layout?: unknown[] } | undefined
  if (page && formId) {
    const layout = Array.isArray(page.layout) ? page.layout : []
    const hasForm = layout.some((b) => (b as { blockType?: string })?.blockType === 'formBlock')
    if (!hasForm) {
      await payload.update({
        collection: 'pages',
        id: page.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { layout: [...layout, { blockType: 'formBlock', enableIntro: false, form: formId }] } as any,
        overrideAccess: true,
        req,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overrideLock: true as any,
      })
      pageWired = true
    }
  }

  return {
    formId,
    formCreated,
    pageWired,
    note: `form ${formCreated ? 'created' : 'present'}, page ${pageWired ? 'wired' : page ? 'already-had-form' : 'missing'}`,
  }
}
