/**
 * ensureSignupForm — the "build my free website" form, as a real Form Builder doc.
 *
 * The offer is "tell us your business and we'll build the site free", but the only
 * form on either hub was the generic contact form: name, email, phone, message.
 * So a prospect who said yes gave us none of what `demo-site` actually needs
 * (business name, trade, city), and every signup became a round of phone tag
 * before anything could be built. The one-minute build was unavailable to the
 * people it was designed to impress.
 *
 * This is deliberately NOT a bespoke React form. A Form Builder doc already
 * renders through the existing formBlock, routes to the AI Bus, and (since the
 * 260818 fix) emails the owner — so the whole pipeline comes for free and the
 * owner can edit their own fields afterwards, which is the point of forms being
 * tenant-scoped in the first place.
 *
 * `trade` matches the keys in demoSiteTemplates so the answer resolves straight
 * onto a content pack — the field is the input to the build, not a note for a
 * human to re-type.
 *
 * @see src/utilities/demoSiteTemplates.ts  @see src/utilities/ensureTenantContactForm.ts
 */
import type { Payload, PayloadRequest } from 'payload'
import { TRADE_KEYS } from './demoSiteTemplates'
import { resolveOwnerEmail } from './ensureTenantContactForm'

export const SIGNUP_FORM_TITLE = 'Build My Free Website'

function richLine(text: string) {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          textFormat: 0,
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

/** Trade options, derived from the packs so a new vertical never drifts out of the form. */
export function tradeOptions(): Array<{ label: string; value: string }> {
  const label = (k: string) => k.charAt(0).toUpperCase() + k.slice(1)
  return TRADE_KEYS.map((k) => ({ label: label(k), value: k }))
}

export function signupFormFields() {
  return [
    {
      name: 'business-name',
      blockName: 'business-name',
      blockType: 'text',
      label: 'Business name',
      required: true,
      width: 100,
    },
    {
      // The single most important answer: it picks the content pack, which is
      // what makes the generated site read like their trade instead of filler.
      name: 'trade',
      blockName: 'trade',
      blockType: 'select',
      label: 'What kind of work do you do?',
      required: true,
      width: 100,
      options: tradeOptions(),
    },
    {
      name: 'city',
      blockName: 'city',
      blockType: 'text',
      label: 'Town or city you work in',
      required: false,
      width: 50,
    },
    {
      name: 'phone',
      blockName: 'phone',
      blockType: 'text',
      label: 'Phone',
      required: false,
      width: 50,
    },
    {
      name: 'email',
      blockName: 'email',
      blockType: 'email',
      label: 'Email',
      required: true,
      width: 100,
    },
    {
      name: 'anything-else',
      blockName: 'anything-else',
      blockType: 'textarea',
      label: 'Anything you want on the site? (optional)',
      required: false,
      width: 100,
    },
  ]
}

export interface EnsureSignupFormResult {
  formId: number | string | null
  created: boolean
  notifies: string | null
}

/**
 * Find-or-create the signup form for a tenant. Idempotent on (tenant, title);
 * refreshes the notification address but leaves fields alone once created, so an
 * owner's edits survive a re-run.
 */
export async function ensureSignupForm(
  payload: Payload,
  tenantId: number | string,
  req?: PayloadRequest,
): Promise<EnsureSignupFormResult> {
  const ownerEmail = await resolveOwnerEmail(payload, tenantId)

  const emails = ownerEmail
    ? [
        {
          emailTo: ownerEmail,
          emailFrom: process.env.SYSTEM_EMAIL_ADDRESS || 'hello@spacesangels.com',
          replyTo: '{{email}}',
          subject: 'New free-website signup',
          message: richLine('Someone asked for a free website. Their answers are below.'),
        },
      ]
    : []

  const existing = await payload.find({
    collection: 'forms',
    where: { and: [{ tenant: { equals: tenantId } }, { title: { equals: SIGNUP_FORM_TITLE } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs?.[0]) {
    const doc = existing.docs[0] as { id: number | string; emails?: Array<{ emailTo?: string }> }
    if (ownerEmail && !doc.emails?.some((e) => e?.emailTo === ownerEmail)) {
      await payload.update({
        collection: 'forms',
        id: doc.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { emails } as any,
        overrideAccess: true,
        req,
      })
    }
    return { formId: doc.id, created: false, notifies: ownerEmail }
  }

  const created = await payload.create({
    collection: 'forms',
    data: {
      title: SIGNUP_FORM_TITLE,
      tenant: tenantId,
      fields: signupFormFields(),
      submitButtonLabel: 'Build my free website',
      confirmationType: 'message',
      confirmationMessage: richLine(
        "Got it. We'll build your site and send you the link — usually within a day. No payment, no obligation.",
      ),
      emails,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    overrideAccess: true,
    req,
  })

  return { formId: created.id, created: true, notifies: ownerEmail }
}
