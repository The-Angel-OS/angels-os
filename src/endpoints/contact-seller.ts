/**
 * Contact Seller — POST /api/contact-ops/seller
 *
 * The "Email me about this" / "Contact the seller" affordance on a product page.
 * Captures name + email (+ optional phone + message) and lands it in the tenant's
 * inbox as a `form_submission` message (via deliverLead) + Gotify escalation, WITHOUT
 * needing a Form Builder form doc. This is the endpoint form of the same primitive
 * the LEO `capture_lead` tool uses (factory principle — one path, two mounts).
 *
 * Open to anonymous visitors (a buyer browsing a fire-sale listing has no account).
 *
 * Body: {
 *   tenantId? | tenantSlug?,   // else resolved from x-tenant-id header
 *   name: string,
 *   email: string,
 *   phone?: string,
 *   message?: string,
 *   productSlug?: string,      // context so the operator knows which listing
 *   productTitle?: string,
 * }
 *
 * NOT a collection slug prefix (route-shadowing rule): uses /contact-ops/*.
 */
import type { PayloadHandler } from 'payload'
import { deliverLead } from '@/utilities/deliverLead'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const contactSellerHandler: PayloadHandler = async (req) => {
  const { payload } = req

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* empty body → validation below */
  }

  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

  const name = str(body.name)
  const email = str(body.email)
  const phone = str(body.phone)
  const message = str(body.message)
  const productSlug = str(body.productSlug)
  const productTitle = str(body.productTitle)

  if (!name) return Response.json({ error: 'name is required' }, { status: 400 })
  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: 'a valid email is required' }, { status: 400 })
  }

  try {
    // Resolve tenant: explicit id / slug, else the request's x-tenant-id header.
    let tenantId: number | string | undefined
    if (body.tenantId != null) {
      tenantId = body.tenantId as number | string
    } else if (str(body.tenantSlug)) {
      const t = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: str(body.tenantSlug) } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      tenantId = (t.docs?.[0] as { id: number | string } | undefined)?.id
    } else {
      const headerTenant = req.headers?.get('x-tenant-id')
      if (headerTenant) tenantId = headerTenant
    }
    if (tenantId == null) {
      return Response.json(
        { error: 'tenant could not be resolved (pass tenantId/tenantSlug or x-tenant-id)' },
        { status: 400 },
      )
    }

    const fields: Record<string, unknown> = {
      name,
      email,
      ...(phone ? { phone } : {}),
      ...(message ? { message } : {}),
      ...(productTitle || productSlug ? { product: productTitle || productSlug } : {}),
    }

    const formTitle = productTitle
      ? `Contact Seller: ${productTitle}`
      : 'Contact Seller'

    const result = await deliverLead(payload, {
      tenantId,
      formTitle,
      fields,
      source: 'contact_seller',
    })

    if (!result.ok) {
      // The lead is worth logging even if routing missed — surface a soft error.
      payload.logger?.warn?.(`[contact-seller] deliverLead miss: ${result.error}`)
      return Response.json(
        { error: 'Could not reach the seller right now — please try again shortly.' },
        { status: 502 },
      )
    }

    return Response.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[contact-seller] ${msg}`)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
