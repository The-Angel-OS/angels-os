import type { Payload, RequiredDataFromCollectionSlug } from 'payload'
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

/**
 * One block in an ordered layout. Exactly one key is honoured per entry — the
 * spec IS the block order, which is the whole reason this exists: the legacy
 * body/cta/form/donation shortcuts can only ever emit that fixed sequence, and a
 * real site puts a gallery between two content sections.
 */
export interface SpecSection {
  content?: SpecNode[]
  cta?: SpecCta
  gallery?: { heading?: string; columns?: '2' | '3' | '4'; images: Array<number | string> }
  faq?: { heading?: string; openFirst?: boolean; items: Array<{ question: string; answer: string }> }
  mediaText?: {
    eyebrow?: string
    heading: string
    body?: string
    media?: number | string
    aspect?: '16/9' | '9/16' | '1/1' | '4/3'
    caption?: string
    mediaOnLeft?: boolean
    ctaLabel?: string
    ctaUrl?: string
  }
  trustRow?: {
    heading?: string
    footnote?: string
    items?: Array<{ icon: string; label: string; detail?: string }>
  }
  contactForm?: boolean
}

export interface PageFromSpec {
  slug: string
  title: string
  navOrder?: number
  showInNav?: boolean
  heroHeading: string
  heroSub?: string
  /** Media id for a hero image. When set, hero.type defaults to highImpact. */
  heroImage?: number | string
  /** Override the hero treatment (e.g. 'fullScreen' for a photography splash). */
  heroType?: 'none' | 'fullScreen' | 'splitPanel' | 'highImpact' | 'mediumImpact' | 'lowImpact'
  /**
   * Ordered layout. When present it IS the layout, and the body/cta/donation/
   * contactForm shortcuts below are ignored — one page has one ordering rule.
   */
  sections?: SpecSection[]
  body?: SpecNode[]
  cta?: SpecCta
  donation?: { heading?: string; blurb?: string; presetAmounts?: string }
  /** If true, append the tenant's contact form block at the bottom of the page. */
  contactForm?: boolean
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCtaBlock(cta: SpecCta): any {
  return {
    blockType: 'cta',
    richText: createLexicalContent([createHeadingNode(cta.heading, 'h2'), createParagraphNode(cta.body)]),
    links: cta.links.map((l) => ({
      link: { type: 'custom' as const, label: l.label, url: l.url, appearance: l.outline ? 'outline' : 'default' },
    })),
  }
}

/**
 * Turn one SpecSection into one layout block. Returns null for an entry that
 * names nothing we can build (or a gallery with no images), so a typo drops a
 * section instead of writing a half-block that fails validation on save.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSection(s: SpecSection, contactFormId: number | string | null): any | null {
  if (s.content?.length) return buildContentBlock(s.content)
  if (s.cta) return buildCtaBlock(s.cta)
  if (s.gallery?.images?.length) {
    return {
      blockType: 'gallery',
      ...(s.gallery.heading ? { heading: s.gallery.heading } : {}),
      columns: s.gallery.columns || '3',
      images: s.gallery.images.map((image) => ({ image })),
    }
  }
  if (s.faq?.items?.length) {
    return {
      blockType: 'faq',
      heading: s.faq.heading || 'Frequently Asked Questions',
      openFirst: s.faq.openFirst !== false,
      items: s.faq.items.map((i) => ({ question: i.question, answer: i.answer })),
    }
  }
  if (s.mediaText?.heading) {
    const m = s.mediaText
    return {
      blockType: 'mediaText',
      ...(m.eyebrow ? { eyebrow: m.eyebrow } : {}),
      heading: m.heading,
      ...(m.body ? { body: m.body } : {}),
      ...(m.media != null ? { media: m.media } : {}),
      aspect: m.aspect || '4/3',
      ...(m.caption ? { caption: m.caption } : {}),
      // Block stores which side the MEDIA sits on; the spec says it the way a
      // person reads it ("image on the left"), so invert here, not at call sites.
      videoOnRight: m.mediaOnLeft !== true,
      ...(m.ctaLabel ? { ctaLabel: m.ctaLabel } : {}),
      ...(m.ctaUrl ? { ctaUrl: m.ctaUrl } : {}),
    }
  }
  if (s.trustRow) {
    return {
      blockType: 'trustRow',
      ...(s.trustRow.heading ? { heading: s.trustRow.heading } : {}),
      ...(s.trustRow.footnote ? { footnote: s.trustRow.footnote } : {}),
      // Empty items is meaningful: the block falls back to the tenant-wide badges.
      items: (s.trustRow.items || []).map((i) => ({ icon: i.icon, label: i.label, ...(i.detail ? { detail: i.detail } : {}) })),
    }
  }
  if (s.contactForm && contactFormId) return { blockType: 'formBlock', form: contactFormId, enableIntro: false }
  return null
}

export async function provisionPagesFromSpec(
  payload: Payload,
  tenantId: number | string,
  pages: PageFromSpec[],
  opts: { overwrite?: boolean } = {},
): Promise<ProvisionPagesResult> {
  // Lazily resolve the tenant's contact form once if any page needs it.
  let contactFormId: number | string | null = null
  const needsForm = pages.some((p) => p.contactForm || p.sections?.some((s) => s.contactForm))
  if (needsForm) {
    try {
      const { ensureTenantContactForm } = await import('./ensureTenantContactForm')
      const form = await ensureTenantContactForm(payload, tenantId, {} as never)
      contactFormId = (form as unknown as { id: number | string } | null)?.id ?? null
    } catch {
      // Non-fatal — page will render without the form block if this fails.
    }
  }
  const created: string[] = []
  const updated: string[] = []
  const skipped: string[] = []

  for (const spec of pages) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layout: any[] = []
    if (spec.sections?.length) {
      for (const s of spec.sections) {
        const block = buildSection(s, contactFormId)
        if (block) layout.push(block)
      }
      // `sections` is the whole layout — fall through past the legacy shortcuts.
    } else {
      if (spec.body?.length) layout.push(buildContentBlock(spec.body))
      if (spec.cta) layout.push(buildCtaBlock(spec.cta))
      if (spec.contactForm && contactFormId) {
        layout.push({ blockType: 'formBlock', form: contactFormId, enableIntro: false })
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
        type: spec.heroType || (spec.heroImage != null ? 'highImpact' : 'lowImpact'),
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
