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
import { findOrCreateTenant, findOrCreateTenantMembership } from '@/endpoints/seed/seed-helpers'
import { createDefaultTenantPages } from '@/utilities/createDefaultTenantPages'
import { createDefaultTenantNavigation } from '@/utilities/createDefaultTenantNavigation'
import { createLexicalContent, createHeadingNode, createParagraphNode } from '@/utilities/lexicalHelpers'
import { ensureTenantSpaces } from '@/utilities/ensureTenantSpaces'
import type { EndeavorType } from '@/utilities/spaceProvisioning'

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

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'New Portal'
  const slug =
    (typeof body.slug === 'string' && body.slug.trim()
      ? body.slug
      : name
    )
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'portal'
  const domain = typeof body.domain === 'string' ? body.domain.trim() : ''
  if (!domain) return Response.json({ error: 'domain is required' }, { status: 400 })

  const tagline = typeof body.tagline === 'string' ? body.tagline : 'A sovereign node in the Angel OS network'
  const primaryColor = typeof body.primaryColor === 'string' ? body.primaryColor : '#7AB5B0'
  const secondaryColor = typeof body.secondaryColor === 'string' ? body.secondaryColor : '#9B8EC4'
  const description =
    typeof body.description === 'string'
      ? body.description
      : `${name} — a sovereign portal enterprise in the Angel OS federation.`
  const missionStatement = typeof body.missionStatement === 'string' ? body.missionStatement : `Serve, coordinate, and federate as ${name}.`
  const endeavorType = typeof body.endeavorType === 'string' ? body.endeavorType : 'creator-content'

  try {
    const log: string[] = []

    // 1. Tenant (canonical helper → correct branding + domain sync)
    const tenant = await findOrCreateTenant(payload, req, {
      name,
      slug,
      domain,
      type: 'tenant',
      branding: { siteName: name, tagline, primaryColor, secondaryColor },
    })
    log.push(`tenant #${tenant.id} (${tenant.slug})`)

    // 2. Default nav (header + footer)
    try {
      await createDefaultTenantNavigation(payload, tenant.id)
      log.push('navigation ready')
    } catch (e) {
      log.push(`navigation skipped: ${(e as Error).message}`)
    }

    // 3. Default pages (home + contact), then a clean command-center hero on home
    await createDefaultTenantPages(payload, tenant.id, { siteName: name, tagline })
    const homePages = await payload.find({
      collection: 'pages',
      where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: tenant.id } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const home = homePages.docs?.[0] as { id: number | string } | undefined
    if (home) {
      await payload.update({
        collection: 'pages',
        id: home.id,
        depth: 0,
        overrideAccess: true,
        data: {
          hero: {
            type: 'lowImpact',
            richText: createLexicalContent([
              createHeadingNode(name, 'h1'),
              createParagraphNode(tagline),
            ]),
          },
          meta: { title: `${name} — ${tagline}`, description },
        } as never,
      })
      log.push(`home page #${home.id}`)
    }

    // 4. Endeavor (so the portal appears in Federation Discover as its own node)
    const existingEndeavors = await payload.find({
      collection: 'endeavors',
      where: { tenant: { equals: tenant.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existingEndeavors.docs.length === 0) {
      const endeavor = await payload.create({
        collection: 'endeavors',
        data: {
          name,
          tagline,
          description,
          endeavorType,
          holonTypes: ['creator'],
          missionStatement,
          status: 'active',
          region: { country: 'US' },
          federation: { networkVisible: true, domain },
          tenant: tenant.id,
        } as never,
        overrideAccess: true,
        req,
      })
      log.push(`endeavor #${endeavor.id}`)
    } else {
      log.push(`endeavor #${existingEndeavors.docs[0]!.id} (existing)`)
    }

    // 4b. Ensure the Community Space + channels exist (was missing — a tenant
    //     without a Space has no AI Bus). Idempotent.
    try {
      const s = await ensureTenantSpaces(payload, tenant.id, {
        endeavorType: endeavorType as EndeavorType,
        spaceName: 'Community',
        req,
      })
      log.push(
        s.createdSpace
          ? `community space #${s.spaceId} created (+ channels)`
          : `space #${s.spaceId} present (backfilled: ${s.addedChannels.join(', ') || 'none'})`,
      )
    } catch (e) {
      log.push(`spaces skipped: ${(e as Error).message}`)
    }

    // 5. Link the provisioning super_admin as tenant_admin + user.tenants
    await findOrCreateTenantMembership(payload, req, {
      userId: user.id,
      tenantId: tenant.id,
      role: 'tenant_admin',
    })
    const fullUser = (await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })) as {
      tenants?: { tenant: number | { id: number } }[]
    }
    const existingTenants = fullUser?.tenants || []
    const linked = existingTenants.some((t) => (typeof t.tenant === 'object' ? t.tenant?.id : t.tenant) === tenant.id)
    if (!linked) {
      await payload.update({
        collection: 'users',
        id: user.id,
        data: { tenants: [...existingTenants, { tenant: tenant.id }] } as never,
        overrideAccess: true,
      })
      log.push('linked super_admin → tenant')
    }

    return Response.json({ ok: true, tenant: { id: tenant.id, slug: tenant.slug, domain }, url: `https://${domain}`, log })
  } catch (e) {
    payload.logger.error(`[provision-portal] ${e instanceof Error ? e.message : e}`)
    return Response.json({ error: e instanceof Error ? e.message : 'provision failed' }, { status: 500 })
  }
}
