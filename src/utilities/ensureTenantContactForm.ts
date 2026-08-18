/**
 * ensureTenantContactForm — give a tenant its OWN Payload Form Builder contact
 * form, addressed to the person who owns the business.
 *
 * Idempotent: find-or-create the tenant's form, make sure it notifies the owner,
 * then ensure the /contact page's formBlock points at it.
 *
 * History worth keeping: forms had no `tenant` field, so every portal shared one
 * "Contact Form" doc, and that doc carried the untouched Payload demo email row
 * — `emailTo: '{{email}}'` from `demo@payloadcms.com`. Every business on the
 * platform therefore had a contact form whose submissions notified NOBODY (the
 * only mail went back to the person who filled it in, from a domain we do not
 * own). Submissions still reached the AI Bus, so the bug was invisible from the
 * admin side while leads quietly went unanswered.
 */
import type { Payload, PayloadRequest } from 'payload'
import { contactFormData } from '@/endpoints/seed/contact-form'

export interface EnsureContactFormResult {
  formId: number | string | null
  formCreated: boolean
  pageWired: boolean
  /** Where this tenant's leads are mailed, or null if we have no address yet. */
  notifies: string | null
  note: string
}

/** Lexical doc for the owner notification. Plain on purpose — it is an alert. */
function notificationBody() {
  const line = (text: string) => ({
    type: 'paragraph',
    children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    version: 1,
  })
  return {
    root: {
      type: 'root',
      children: [
        line('You have a new enquiry from your website.'),
        line('{{*:table}}'),
        line('Reply straight to this email to answer them.'),
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

/**
 * Where a tenant's leads should go. The storefront contact email is the field an
 * owner can actually see and change; the admin user is the fallback so a portal
 * provisioned without one still reaches a human.
 */
export async function resolveOwnerEmail(
  payload: Payload,
  tenantId: number | string,
): Promise<string | null> {
  const tenant = await payload
    .findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
    .catch(() => null)
  const storefront = (tenant as { storefront?: { contactEmail?: string } } | null)?.storefront
  if (storefront?.contactEmail) return storefront.contactEmail

  // Fall back to a human attached to the tenant. Skip system accounts — mailing
  // leads to the platform robot is the same failure with extra steps.
  const users = await payload
    .find({
      collection: 'users',
      where: { and: [{ tenant: { equals: tenantId } }, { email: { exists: true } }] },
      limit: 5,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  const human = users?.docs?.find(
    (u) => !(u as { isSystemUser?: boolean }).isSystemUser && (u as { email?: string }).email,
  )
  return (human as { email?: string } | undefined)?.email ?? null
}

export async function ensureTenantContactForm(
  payload: Payload,
  tenantId: number | string,
  req?: PayloadRequest,
): Promise<EnsureContactFormResult> {
  const ownerEmail = await resolveOwnerEmail(payload, tenantId)

  // 1. Find-or-create THIS TENANT's form.
  const existing = await payload.find({
    collection: 'forms',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  let formId: number | string | null = (existing.docs?.[0]?.id as number | string) ?? null
  let formCreated = false

  // The owner notification. `emailTo` is the business; reply-to is the person who
  // submitted, so hitting Reply in any mail client answers the customer. The from
  // address must stay on a domain we own or it fails SPF and lands in spam —
  // never echo the submitter's address into `emailFrom`.
  const ownerEmailRow = ownerEmail
    ? [
        {
          emailTo: ownerEmail,
          emailFrom: process.env.SYSTEM_EMAIL_ADDRESS || 'hello@spacesangels.com',
          replyTo: '{{email}}',
          subject: 'New enquiry from your website',
          message: notificationBody(),
        },
      ]
    : []

  if (!formId) {
    // Strip the template's hard-coded timestamps — Payload sets its own — and its
    // demo email row, which is the bug this helper exists to not reproduce.
    const {
      createdAt: _c,
      updatedAt: _u,
      emails: _e,
      title: _t,
      ...data
    } = contactFormData() as Record<string, unknown>
    const created = await payload.create({
      collection: 'forms',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { ...data, title: 'Contact Form', tenant: tenantId, emails: ownerEmailRow } as any,
      overrideAccess: true,
      req,
    })
    formId = created.id
    formCreated = true
  } else if (ownerEmail) {
    // Repair an existing form whose notification is missing or still points at
    // the wrong place. Only touches `emails`, so any fields the owner added by
    // hand survive.
    const current = existing.docs[0] as { emails?: Array<{ emailTo?: string }> }
    const alreadyRight = current.emails?.some((e) => e?.emailTo === ownerEmail)
    if (!alreadyRight) {
      await payload.update({
        collection: 'forms',
        id: formId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { emails: ownerEmailRow } as any,
        overrideAccess: true,
        req,
      })
    }
  }

  // 2. Ensure the /contact page renders THIS form via a formBlock. A page that
  // already has a formBlock may be pointing at the old shared form, so the
  // relationship is corrected rather than only appended when absent.
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
    const formBlocks = layout.filter(
      (b) => (b as { blockType?: string })?.blockType === 'formBlock',
    ) as Array<{ form?: unknown }>
    const pointsElsewhere = formBlocks.some((b) => {
      const f = b.form
      const id = typeof f === 'object' && f !== null ? (f as { id?: unknown }).id : f
      return String(id) !== String(formId)
    })

    if (formBlocks.length === 0) {
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
    } else if (pointsElsewhere) {
      await payload.update({
        collection: 'pages',
        id: page.id,
        data: {
          layout: layout.map((b) =>
            (b as { blockType?: string })?.blockType === 'formBlock' ? { ...(b as object), form: formId } : b,
          ),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
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
    notifies: ownerEmail,
    note: `form ${formCreated ? 'created' : 'present'}, notifies ${ownerEmail || 'NOBODY (no owner email on tenant)'}, page ${pageWired ? 'wired' : page ? 'already-correct' : 'missing'}`,
  }
}
