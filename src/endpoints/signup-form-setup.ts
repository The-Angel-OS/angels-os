/**
 * Signup Form Setup — POST /api/provision-ops/signup-form
 *
 * Installs the "build my free website" form on a hub and wires it onto a page.
 * Both spacesangels.com and clearwater-cruisin sell the same offer to different
 * audiences (cold search vs a YouTube audience that already trusts the family),
 * so both need the real signup form rather than the generic contact form they
 * were each using for it.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 *
 * Body: { tenant: "platform", page?: "get-started" }
 *
 * @see src/utilities/ensureSignupForm.ts
 */
import type { PayloadHandler } from 'payload'
import { ensureSignupForm } from '@/utilities/ensureSignupForm'
import { logError } from '@/utilities/logError'

export const signupFormSetupHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const tenantSlug = typeof body.tenant === 'string' ? body.tenant.trim() : ''
  const pageSlug = typeof body.page === 'string' && body.page.trim() ? body.page.trim() : null
  if (!tenantSlug) return Response.json({ error: 'tenant (slug) is required' }, { status: 400 })

  try {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const tenant = tenants.docs?.[0] as { id: number | string } | undefined
    if (!tenant) return Response.json({ error: `No tenant "${tenantSlug}"` }, { status: 404 })

    const result = await ensureSignupForm(payload, tenant.id, req)

    // Optionally bind it onto a page, replacing whatever formBlock is there. The
    // page is usually already selling the offer and ending in the wrong form.
    let pageWired: string | null = null
    if (pageSlug && result.formId) {
      const pages = await payload.find({
        collection: 'pages',
        where: { and: [{ slug: { equals: pageSlug } }, { tenant: { equals: tenant.id } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const page = pages.docs?.[0] as { id: number | string; layout?: unknown[] } | undefined
      if (page) {
        const layout = Array.isArray(page.layout) ? page.layout : []
        const hasForm = layout.some(
          (b) => (b as { blockType?: string })?.blockType === 'formBlock',
        )
        const nextLayout = hasForm
          ? layout.map((b) =>
              (b as { blockType?: string })?.blockType === 'formBlock'
                ? { ...(b as object), form: result.formId }
                : b,
            )
          : [...layout, { blockType: 'formBlock', enableIntro: false, form: result.formId }]
        await payload.update({
          collection: 'pages',
          id: page.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { layout: nextLayout } as any,
          overrideAccess: true,
          req,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          overrideLock: true as any,
        })
        pageWired = pageSlug
      }
    }

    return Response.json({
      ok: true,
      tenant: tenantSlug,
      formId: result.formId,
      created: result.created,
      notifies: result.notifies,
      pageWired,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await logError({
      source: 'provision-ops/signup-form',
      message: msg,
      details: e instanceof Error ? e.stack : undefined,
      statusCode: 500,
    })
    return Response.json({ error: msg }, { status: 500 })
  }
}
