/**
 * Provision UAP & Global Disclosure Portal (`uap.spacesangels.com`)
 * Ingests declassified incidents into Posts and sets up Tactical Radar Atlas.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
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

const payload = await getPayload({ config })

console.log('[UAP] Provisioning portal...')

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
    defaultTheme: 'dark',
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any)

const tenantId = Number(tenant.id)
console.log(`[UAP] Tenant ready: #${tenantId} (${tenant.slug}) -> https://${DOMAIN}`)

// Navigation & Default Pages
try {
  await createDefaultTenantNavigation(payload, tenantId)
  console.log('[UAP] Navigation ready')
} catch (e) {
  console.log(`[UAP] Navigation notice: ${(e as Error).message}`)
}

await createDefaultTenantPages(payload, tenantId, { siteName: NAME, tagline: TAGLINE })

// Home page update with uap-radar-atlas
const homePages = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: tenantId } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

const home = homePages.docs?.[0]
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
            'Interactive tactical radar tracking crash recoveries, nuclear missile site incursions, military radar locks, and whistleblower depositions from Greer, Blue Book, and international MoD dossiers.',
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
  console.log(`[UAP] Home page #${home.id} updated with uap-radar-atlas`)
}

// Ingest incidents
const incidents = uapArchiveData.incidents || []
let ingested = 0

for (const inc of incidents) {
  const postSlug = inc.slug || `incident-${inc.id}`
  const existing = await payload.find({
    collection: 'posts',
    where: { and: [{ slug: { equals: postSlug } }, { tenant: { equals: tenantId } }] },
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
    tenant: tenantId,
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
    ingested++
  } else {
    await payload.update({
      collection: 'posts',
      id: existing.docs[0].id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: postData as any,
      overrideAccess: true,
    })
    ingested++
  }
}

console.log(`[UAP] Ingested ${ingested} incident dossiers into Posts!`)
process.exit(0)
