/**
 * Provision NDE & Past-Life Regression Anomaly Archive Portal
 * GET/POST /api/provision-ops/nde-portal
 *
 * Stands up `nde.spacesangels.com` ("NDE & Past-Life Anomaly Archive"):
 *   1. Tenant + Navigation + Default Pages
 *   2. Home page embedding the 3D Consciousness Recon Globe Atlas (`nde-archive`)
 *   3. Ingests curated pre-2018 blind baseline & outlier cases into `Posts`
 *      with direct links to primary NDERF / academic / YouTube archives.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>.
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
import ndeArchiveData from '@/data/nde-archive.json'

const SLUG = 'nde'
const NAME = 'NDE & Past-Life Anomaly Archive'
const DOMAIN = 'nde.spacesangels.com'
const TAGLINE =
  'Cross-Referencing Pre-2018 Blind Hypnotic Regressions, NDERF Accounts & 1700–1850 Historical Outliers'

export const provisionNdePortalHandler: PayloadHandler = async (req) => {
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

  try {
    const log: string[] = []

    // 1. Create or update the `nde` tenant
    const tenant = await findOrCreateTenant(payload, undefined, {
      name: NAME,
      slug: SLUG,
      domain: DOMAIN,
      type: 'tenant',
      branding: {
        siteName: NAME,
        tagline: TAGLINE,
        primaryColor: '#A855F7',
        secondaryColor: '#06B6D4',
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

    // 3. Customize Home Page on `nde` with 3D NDE & Past-Life Globe Atlas
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
              createHeadingNode('NDE & PAST-LIFE REGRESSION ANOMALY ARCHIVE', 'h1'),
              createParagraphNode(
                'Testing the Old World / pre-1850 advanced-civilization hypothesis against pre-2018 blind hypnotic regressions (Wambach, Cannon, Cayce, Newton), UVA verified children’s cases, and NDERF near-death accounts.',
              ),
            ]),
          },
          layout: [
            {
              blockType: 'content',
              blockName: 'nde-archive',
              columns: [
                {
                  size: 'full',
                  richText: createLexicalContent([
                    createParagraphNode(
                      'Interactive 3D Consciousness Recon Globe — Pre-2018 Blind Baselines & Edge-Case Outliers',
                    ),
                  ]),
                },
              ],
            },
          ],
          meta: {
            title: `${NAME} — ${TAGLINE}`,
            description:
              'AI-indexed archive of hypnotic past-life regressions and NDE accounts cross-referenced for pre-2018 blindness, 1700–1850 historical outliers, and lost-civilization anomalies.',
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      })
      log.push(`home page #${home.id} updated with nde-archive`)
    }

    // 4. Ingest Curated Cases into `Posts`
    const records = ndeArchiveData.records || []
    let ingestedCount = 0

    for (const rec of records) {
      const postSlug = rec.slug || `case-${rec.id}`
      const existing = await payload.find({
        collection: 'posts',
        where: { and: [{ slug: { equals: postSlug } }, { tenant: { equals: tenant.id } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      const contentNodes = [
        createHeadingNode(rec.title, 'h2'),
        createParagraphNode(
          `Category: ${rec.category} · Era Window: ${rec.eraWindow} · Recorded: ${rec.recordedYear} · Blindness: ${rec.blindnessRating} (Leading-Prompt Risk: ${rec.leadingPromptScore}/10 · Historical Deviation: ${rec.historicalDeviationScore}/10)`,
        ),
        createParagraphNode(
          `Researcher / Source: ${rec.researcher} · Geographic Anchor: ${rec.location.name} [GPS: ${rec.location.latitude}, ${rec.location.longitude}]`,
        ),
        createHeadingNode('Case Summary & Research Context', 'h3'),
        createParagraphNode(rec.summary),
        createHeadingNode('Key Anomaly & Methodological Markers', 'h3'),
        createParagraphNode(rec.anomalyMarkers.map((m: string) => `• ${m}`).join('\n')),
        createHeadingNode('Primary Source Link', 'h3'),
        createParagraphNode(
          rec.sources.map((s: { title: string; url: string }) => `${s.title}: ${s.url}`).join('\n'),
        ),
      ]

      const postData = {
        title: rec.title,
        slug: postSlug,
        tenant: tenant.id,
        _status: 'published',
        sourceUrl: rec.sources?.[0]?.url || '',
        sourceType: rec.sourceType === 'youtube_session' ? 'youtube' : 'manual',
        layout: [
          {
            blockType: 'content',
            columns: [
              {
                size: 'full',
                richText: createLexicalContent(contentNodes),
              },
            ],
          },
        ],
        meta: {
          title: `${rec.title} — ${NAME}`,
          description: rec.summary.slice(0, 155),
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
      }
    }
    log.push(`synced ${records.length} NDE/regression records (${ingestedCount} newly created)`)

    return Response.json({
      success: true,
      portal: `https://${DOMAIN}`,
      tenantId: tenant.id,
      recordsSynced: records.length,
      log,
    })
  } catch (err) {
    console.error('[provision-nde-portal] Error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
