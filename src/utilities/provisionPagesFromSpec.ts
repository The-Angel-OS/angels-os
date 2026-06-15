import type { Payload } from 'payload'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
  createUnorderedListNode,
} from '@/utilities/lexicalHelpers'

/**
 * provisionPagesFromSpec — generic site provisioner: stamp a set of pages onto a
 * tenant from a plain JSON spec, assembled entirely from EXISTING blocks
 * (content/cta/donation) so there's zero schema-rollout risk. The reusable
 * building block behind site migrations / replicate_site — content is DATA (passed
 * in), not hardcoded per endeavor.
 *
 * Idempotent: skips a page whose slug already exists for the tenant (overwrite
 * replaces layout/hero/meta, keeping the doc id).
 *
 * @see src/utilities/provisionChurchSite.ts (the church-specific sibling)
 */

export interface SpecNode {
  /** Section heading (h2). */ h2?: string
  /** Sub-heading (h3). */ h3?: string
  /** A paragraph. */ p?: string
  /** A bulleted list. */ list?: string[]
}

export interface SpecCta {
  heading: string
  body: string
  links: Array<{ label: string; url: string; outline?: boolean }>
}

export interface PageFromSpec {
  slug: string
  title: string
  navOrder?: number
  showInNav?: boolean
  heroHeading: string
  heroSub?: string
  /** Media id for a high-impact hero image. When set, hero.type becomes highImpact. */
  heroImage?: number | string
  body?: SpecNode[]
  cta?: SpecCta
  donation?: { heading?: string; blurb?: string; presetAmounts?: string }
  meta?: { title?: string; description?: string }
}

export interface ProvisionPagesResult {
  created: string[]
  updated: string[]
  skipped: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildContentBlock(nodes: SpecNode[]): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lexNodes: any[] = []
  for (const n of nodes) {
    if (n.h2) lexNodes.push(createHeadingNode(n.h2, 'h2'))
    if (n.h3) lexNodes.push(createHeadingNode(n.h3, 'h3'))
    if (n.p) lexNodes.push(createParagraphNode(n.p))
    if (Array.isArray(n.list) && n.list.length) lexNodes.push(createUnorderedListNode(n.list))
  }
  return { blockType: 'content', columns: [{ size: 'full' as const, richText: createLexicalContent(lexNodes) }] }
}

export async function provisionPagesFromSpec(
  payload: Payload,
  tenantId: number | string,
  pages: PageFromSpec[],
  opts: { overwrite?: boolean } = {},
): Promise<ProvisionPagesResult> {
  const created: string[] = []
  const updated: string[] = []
  const skipped: string[] = []

  for (const spec of pages) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layout: any[] = []
    if (spec.body?.length) layout.push(buildContentBlock(spec.body))
    if (spec.cta) {
      layout.push({
        blockType: 'cta',
        richText: createLexicalContent([createHeadingNode(spec.cta.heading, 'h2'), createParagraphNode(spec.cta.body)]),
        links: spec.cta.links.map((l) => ({
          link: { type: 'custom' as const, label: l.label, url: l.url, appearance: l.outline ? 'outline' : 'default' },
        })),
      })
    }
    if (spec.donation) {
      layout.push({
        blockType: 'donation',
        richText: createLexicalContent([
          createHeadingNode(spec.donation.heading || 'Support This Cause', 'h2'),
          ...(spec.donation.blurb ? [createParagraphNode(spec.donation.blurb)] : []),
        ]),
        presetAmounts: spec.donation.presetAmounts || '25,50,100,250,500',
        showDonorFields: true,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageData: any = {
      slug: spec.slug,
      title: spec.title,
      _status: 'published',
      tenant: tenantId,
      showInNav: spec.showInNav !== false,
      ...(spec.navOrder != null ? { navOrder: spec.navOrder } : {}),
      hero: {
        type: spec.heroImage != null ? 'highImpact' : 'lowImpact',
        richText: createLexicalContent([
          createHeadingNode(spec.heroHeading, 'h1'),
          ...(spec.heroSub ? [createParagraphNode(spec.heroSub)] : []),
        ]),
        ...(spec.heroImage != null ? { media: spec.heroImage } : {}),
      },
      layout,
      meta: {
        title: spec.meta?.title || spec.title,
        description: spec.meta?.description || spec.heroSub || spec.title,
      },
    }

    const existing = await payload.find({
      collection: 'pages',
      where: { and: [{ slug: { equals: spec.slug } }, { tenant: { equals: tenantId } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const existingDoc = existing.docs?.[0] as { id: number | string } | undefined

    if (existingDoc) {
      if (!opts.overwrite) {
        skipped.push(spec.slug)
        continue
      }
      await payload.update({ collection: 'pages', id: existingDoc.id, depth: 0, overrideAccess: true, data: pageData })
      updated.push(spec.slug)
      continue
    }
    await payload.create({ collection: 'pages', depth: 0, overrideAccess: true, data: pageData })
    created.push(spec.slug)
  }

  return { created, updated, skipped }
}
