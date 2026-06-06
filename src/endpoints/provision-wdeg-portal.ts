/**
 * Provision WDEG Portal — POST/GET /api/provision-ops/wdeg-portal
 *
 * Stands up "Where Did Everyone Go" as its own tenant + endeavor at
 * wheredideveryonego.spacesangels.com, presenting the WDEG book (already a
 * Library work at /learn/wdeg) as that portal's headline. A deliberate
 * end-to-end exercise of the multi-tenancy provisioning path — it reuses the
 * same canonical helpers the Provision Wizard uses, so it tests the real flow.
 *
 * Idempotent: re-running finds existing records and updates rather than
 * duplicating. super_admin only. Runs on the live (Vercel) Payload — no local
 * boot required.
 */
import type { PayloadHandler } from 'payload'
import { findOrCreateTenant, findOrCreateTenantMembership } from '@/endpoints/seed/seed-helpers'
import { createDefaultTenantPages } from '@/utilities/createDefaultTenantPages'
import { createDefaultTenantNavigation } from '@/utilities/createDefaultTenantNavigation'
import { ensureTenantSpaces } from '@/utilities/ensureTenantSpaces'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'

const SLUG = 'wheredideveryonego'
const NAME = 'Where Did Everyone Go'
const DOMAIN = 'wheredideveryonego.spacesangels.com'
const TAGLINE = 'An illustrated primer — read it free'

export const provisionWdegPortalHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user || !((user as any).roles as string[] | undefined)?.includes('super_admin')) {
    return Response.json({ error: 'super_admin required' }, { status: 403 })
  }

  try {
    const log: string[] = []

    // 1. Tenant (reuses the canonical helper → correct branding + domain sync)
    const tenant = await findOrCreateTenant(payload, req, {
      name: NAME,
      slug: SLUG,
      domain: DOMAIN,
      type: 'tenant',
      branding: {
        siteName: NAME,
        tagline: TAGLINE,
        primaryColor: '#9B8EC4',
        secondaryColor: '#7AB5B0',
      },
    })
    log.push(`tenant #${tenant.id} (${tenant.slug})`)

    // 2. Default nav (header + footer) for the tenant
    try {
      await createDefaultTenantNavigation(payload, tenant.id)
      log.push('navigation ready')
    } catch (e) {
      log.push(`navigation skipped: ${(e as Error).message}`)
    }

    // 3. Default pages (home + contact), then customize home to present the book
    await createDefaultTenantPages(payload, tenant.id, { siteName: NAME, tagline: TAGLINE })

    const homePages = await payload.find({
      collection: 'pages',
      where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: tenant.id } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const home = homePages.docs?.[0] as any
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
              createHeadingNode(NAME, 'h1'),
              createParagraphNode(
                'A 26-page illustrated book — readable now in 17 languages, with page-flip and continuous-scroll modes. Free to read.',
              ),
            ]),
          },
          layout: [
            {
              blockType: 'cta',
              richText: createLexicalContent([
                createHeadingNode('Read the Book', 'h2'),
                createParagraphNode(
                  'The full illustrated primer, live in the Library. No account required.',
                ),
              ]),
              links: [
                {
                  link: {
                    type: 'custom' as const,
                    label: 'Open the Book',
                    url: '/learn/wdeg',
                    appearance: 'default',
                  },
                },
                {
                  link: {
                    type: 'custom' as const,
                    label: 'The Library',
                    url: '/learn/works',
                    appearance: 'outline',
                  },
                },
              ],
            },
          ],
          meta: {
            title: `${NAME} — ${TAGLINE}`,
            description:
              'Where Did Everyone Go — a 26-page illustrated book, free to read in the Angel OS Library.',
          },
        } as any,
      })
      log.push(`home page #${home.id} → presents the book`)
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
          name: NAME,
          tagline: TAGLINE,
          description:
            'A standalone portal presenting the illustrated book "Where Did Everyone Go" — a sovereign work in the Angel OS Library.',
          endeavorType: 'creator-content',
          holonTypes: ['creator'],
          missionStatement: 'Publish and share the illustrated primer, freely.',
          status: 'active',
          region: { country: 'US' },
          federation: { networkVisible: true, domain: DOMAIN },
          tenant: tenant.id,
        } as any,
        overrideAccess: true,
        req,
      })
      log.push(`endeavor #${endeavor.id}`)
    } else {
      log.push(`endeavor #${existingEndeavors.docs[0]!.id} (existing)`)
    }

    // 4b. Ensure the Community Space + channels exist (this step was missing —
    //     WDEG had a tenant/endeavor but no Space, so no AI Bus). Idempotent.
    try {
      const spacesResult = await ensureTenantSpaces(payload, tenant.id, {
        endeavorType: 'creator-content',
        spaceName: 'Community',
        req,
      })
      log.push(
        spacesResult.createdSpace
          ? `community space #${spacesResult.spaceId} created (+ channels)`
          : `space #${spacesResult.spaceId} present (channels backfilled: ${spacesResult.addedChannels.join(', ') || 'none'})`,
      )
    } catch (e) {
      log.push(`spaces skipped: ${(e as Error).message}`)
    }

    // 5. Link the provisioning super_admin as tenant_admin
    await findOrCreateTenantMembership(payload, req, {
      userId: user.id,
      tenantId: tenant.id,
      role: 'tenant_admin',
    })
    const fullUser = (await payload.findByID({
      collection: 'users',
      id: user.id,
      depth: 0,
      overrideAccess: true,
    })) as any
    const existingTenants = fullUser?.tenants || []
    const linked = existingTenants.some(
      (t: any) => (typeof t.tenant === 'object' ? t.tenant?.id : t.tenant) === tenant.id,
    )
    if (!linked) {
      await payload.update({
        collection: 'users',
        id: user.id,
        data: { tenants: [...existingTenants, { tenant: tenant.id }] } as any,
        overrideAccess: true,
      })
      log.push('linked super_admin → tenant')
    }

    return Response.json({
      ok: true,
      tenant: { id: tenant.id, slug: tenant.slug, domain: DOMAIN },
      url: `https://${DOMAIN}`,
      steps: log,
    })
  } catch (err) {
    console.error('[Provision WDEG Portal] Error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Provisioning failed' },
      { status: 500 },
    )
  }
}
