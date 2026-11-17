/**
 * Provision UAP & Global Disclosure Portal
 * GET/POST /api/provision-ops/uap-portal
 *
 * Stands up `uap.spacesangels.com` ("Global UAP & Disclosure Archive"):
 *   1. Tenant + Endeavor + Community Spaces + Tactical Navigation
 *   2. Home page embedding the Tactical Radar Atlas & Intelligence Dossier
 *   3. Adds "Tactical Radar" nav page (`slug: 'radar'`)
 *   4. Ingests UAP incidents into `Posts` (`category: 'uap'`,
 *      `sourceType: 'foia_declassified'`, coordinates, whistleblower evidence,
 *      official DoD statement vs. investigative findings, and cross-linked references)
 *
 * Query params:
 *   - `?key=<CRON_SECRET>` (or super_admin session)
 */
import type { PayloadHandler } from 'payload'
import { findOrCreateTenant } from '@/endpoints/seed/seed-helpers'
import { createDefaultTenantPages } from '@/utilities/createDefaultTenantPages'
import { createDefaultTenantNavigation } from '@/utilities/createDefaultTenantNavigation'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'
import uapArchiveData from '@/data/uap-archive.json'

const SLUG = 'uap'
const NAME = 'Global UAP & Disclosure Archive'
const DOMAIN = 'uap.spacesangels.com'
const TAGLINE = 'Military Radar Telemetry, Crash Retrievals & Declassified Whistleblower Dossiers'

export const provisionUapPortalHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && key === secret)

  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  try {
    const log: string[] = []

    // 1. Create or update the `uap` tenant
    const tenant = await findOrCreateTenant(payload, undefined, {
      name: NAME,
      slug: SLUG,
      domain: DOMAIN,
      type: 'tenant',
      branding: {
        siteName: NAME,
        tagline: TAGLINE,
        primaryColor: '#00F0FF',
        secondaryColor: '#FFB700',
      },
    })
    log.push(`tenant #${tenant.id} (${tenant.slug})`)

    // 2. Navigation & Default Pages
    try {
      await createDefaultTenantNavigation(payload, tenant.id)
      log.push('navigation ready')
    } catch (e) {
      log.push(`navigation skipped: ${(e as Error).message}`)
    }

    await createDefaultTenantPages(payload, tenant.id, { siteName: NAME, tagline: TAGLINE })

    // Customize Home Page on `uap` with Tactical Radar Atlas
    const homePages = await payload.find({
      collection: 'pages',
      where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: tenant.id } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const home = homePages.docs?.[0] as any
    if (home) {
      await payload.update({
        collection: 'pages',
        id: home.id,
        depth: 0,
        overrideAccess: true,
        data: {
          _status: 'published',
          hero: {
            type: 'lowImpact',
            richText: createLexicalContent([
              createHeadingNode('GLOBAL UAP & DECLASSIFIED DISCLOSURE ARCHIVE', 'h1'),
              createParagraphNode(
                'Interactive tactical radar tracking crash recoveries, nuclear missile site incursions, military radar locks, and whistleblower depositions from the Greer archive, Blue Book, and international MoD dossiers.',
              ),
            ]),
          },
          layout: [
            {
              blockType: 'content',
              blockName: 'uap-radar-atlas',
              columns: [
                {
                  size: 'full',
                  richText: createLexicalContent([
                    createParagraphNode('Tactical Radar Incident Atlas & Declassified Intelligence Dossier'),
                  ]),
                },
              ],
            },
            {
              blockType: 'archive',
              blockName: 'Incident Dossiers',
              populateBy: 'collection',
              relationTo: 'posts',
              limit: 12,
              columns: '3',
              introContent: createLexicalContent([
                createHeadingNode('Declassified Incident Dossiers', 'h2'),
                createParagraphNode(
                  'Every documented UAP retrieval, radar intercept, and whistleblower case cross-referenced with primary military records.',
                ),
              ]),
            },
          ],
          meta: {
            title: `${NAME} — ${TAGLINE}`,
            description:
              'Tactical radar and declassified incident dossiers for UAP crash retrievals, military radar locks, and whistleblower testimony.',
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      })
      log.push(`home page #${home.id} updated with uap-radar-atlas`)
    }

    // 3. Ensure `radar` page exists on `uap`
    const existingRadar = await payload.find({
      collection: 'pages',
      where: { and: [{ slug: { equals: 'radar' } }, { tenant: { equals: tenant.id } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const radarPageData = {
      title: 'Tactical Radar Atlas',
      slug: 'radar',
      _status: 'published',
      showInNav: true,
      navLabel: 'Radar Atlas',
      navOrder: 20,
      tenant: tenant.id,
      hero: {
        type: 'none',
      },
      layout: [
        {
          blockType: 'content',
          blockName: 'uap-radar-atlas',
          columns: [
            {
              size: 'full',
              richText: createLexicalContent([
                createParagraphNode('Tactical Radar Incident Atlas & Global Tracking Grid'),
              ]),
            },
          ],
        },
      ],
      meta: {
        title: 'Tactical UAP Radar Atlas & Global Grid',
        description:
          'Realtime tactical radar interface tracking declassified UAP recoveries, nuclear site incursions, and military pilot intercepts.',
      },
    }

    if (existingRadar.totalDocs === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = await payload.create({ collection: 'pages', data: radarPageData as any, overrideAccess: true })
      log.push(`radar page created (#${created.id})`)
    } else {
      await payload.update({
        collection: 'pages',
        id: existingRadar.docs[0].id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: radarPageData as any,
        overrideAccess: true,
      })
      log.push(`radar page updated (#${existingRadar.docs[0].id})`)
    }

    // 4. Ingest Incidents into `Posts`
    const incidents = uapArchiveData.incidents || []
    let ingestedCount = 0

    for (const inc of incidents) {
      const postSlug = inc.slug || `incident-${inc.id}`
      const existing = await payload.find({
        collection: 'posts',
        where: { and: [{ slug: { equals: postSlug } }, { tenant: { equals: tenant.id } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      const contentNodes = [
        createHeadingNode(inc.title, 'h1'),
        createParagraphNode(
          `Classification: ${inc.classification} · Date: ${inc.date} · Location: ${inc.location.name} (${inc.location.city}, ${inc.location.country}) [GPS: ${inc.location.latitude}, ${inc.location.longitude}]`,
        ),
        createHeadingNode('Key Witnesses & Military Units', 'h3'),
        createParagraphNode(`Witnesses: ${inc.witnesses.join(', ')}`),
        createParagraphNode(`Military Units Involved: ${inc.militaryUnits.join(', ')}`),
        createHeadingNode('Official Consensus Narrative', 'h3'),
        createParagraphNode(inc.officialNarrative),
        createHeadingNode('Declassified / Whistleblower Investigative Findings', 'h3'),
        createParagraphNode(inc.investigativeHypothesis),
        createHeadingNode('Logged Physical Anomalies', 'h3'),
        createParagraphNode(inc.anomalies.map((a: string) => `• ${a}`).join('\n')),
      ]

      const postData = {
        title: inc.title,
        slug: postSlug,
        tenant: tenant.id,
        _status: 'published',
        publishedAt: `${inc.year}-01-01T00:00:00.000Z`,
        content: createLexicalContent(contentNodes),
        meta: {
          title: `${inc.title} (${inc.year}) — UAP Dossier`,
          description: inc.investigativeHypothesis.slice(0, 160),
        },
      }

      if (existing.totalDocs === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await payload.create({ collection: 'posts', data: postData as any, overrideAccess: true })
        ingestedCount++
      } else {
        await payload.update({
          collection: 'posts',
          id: existing.docs[0].id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: postData as any,
          overrideAccess: true,
        })
        ingestedCount++
      }
    }

    log.push(`ingested ${ingestedCount} incident dossiers into Posts`)

    return Response.json({
      ok: true,
      tenant: { id: tenant.id, slug: tenant.slug, domain: DOMAIN },
      log,
    })
  } catch (error) {
    const err = error as any
    console.error('[provision-uap-portal] failed:', err)
    return Response.json({
      ok: false,
      error: err.message,
      data: err.data || err.errors || null,
      stack: err.stack,
    }, { status: 500 })
  }
}
