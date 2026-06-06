/**
 * Provision Portal — POST /api/provision-ops/portal
 *
 * Stands up a single "portal enterprise" (tenant + endeavor + default nav/pages +
 * super_admin membership) on the node it's called on — parameterized, so it works
 * for any node as it comes online (kendev today, the next one tomorrow). A
 * generalization of provision-wdeg-portal, reusing the same canonical helpers the
 * Provision Wizard uses, so it exercises the real multi-tenancy path.
 *
 * Idempotent (find-or-create). super_admin only. Runs on the live Payload (no
 * local boot). Body:
 *   { name, slug, domain, tagline?, primaryColor?, secondaryColor?,
 *     endeavorType?, missionStatement?, description? }
 */
import type { PayloadHandler } from 'payload'
import { provisionPortal } from '@/utilities/provisionPortal'

export const provisionPortalHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user || !((user as { roles?: string[] }).roles)?.includes('super_admin')) {
    return Response.json({ error: 'super_admin required' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* allow empty body for GET-style probes */
  }

  const domain = typeof body.domain === 'string' ? body.domain.trim() : ''
  if (!domain) return Response.json({ error: 'domain is required' }, { status: 400 })

  // Accept domain aliases either as a string[] or as the Tenants-shaped [{ domain }].
  const rawAliases = Array.isArray(body.domains) ? body.domains : Array.isArray(body.domainAliases) ? body.domainAliases : []
  const domainAliases = rawAliases
    .map((d) => (typeof d === 'string' ? d : typeof d === 'object' && d && typeof (d as { domain?: unknown }).domain === 'string' ? (d as { domain: string }).domain : ''))
    .filter(Boolean)

  try {
    const result = await provisionPortal(
      payload,
      {
        name: typeof body.name === 'string' ? body.name : 'New Portal',
        slug: typeof body.slug === 'string' ? body.slug : undefined,
        domain,
        domainAliases,
        tagline: typeof body.tagline === 'string' ? body.tagline : undefined,
        primaryColor: typeof body.primaryColor === 'string' ? body.primaryColor : undefined,
        secondaryColor: typeof body.secondaryColor === 'string' ? body.secondaryColor : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        missionStatement: typeof body.missionStatement === 'string' ? body.missionStatement : undefined,
        endeavorType: typeof body.endeavorType === 'string' ? body.endeavorType : undefined,
      },
      { req, actingUserId: user.id },
    )
    return Response.json(result)
  } catch (e) {
    payload.logger.error(`[provision-portal] ${e instanceof Error ? e.message : e}`)
    return Response.json({ error: e instanceof Error ? e.message : 'provision failed' }, { status: 500 })
  }
}
