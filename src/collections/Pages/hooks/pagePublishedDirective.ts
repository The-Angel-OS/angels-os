/**
 * pagePublishedDirective — when a human publishes a page, drop a "your page is
 * live" card onto their device home screen (the Card Stage).
 *
 * The first REAL auto-trigger for the directive rail: a card that surfaces WITHOUT
 * anyone asking Leo — the proactive guardian in miniature. Fires only on the
 * transition INTO published (not every save-while-published) and only when a real
 * user did it (req.user) — never on seeds/imports/system writes. Fail-soft: a
 * card-delivery hiccup must never break publishing a page.
 */
import type { CollectionAfterChangeHook } from 'payload'
import type { Page } from '../../../payload-types'

export const pagePublishedDirective: CollectionAfterChangeHook<Page> = async ({
  doc,
  previousDoc,
  req,
}) => {
  try {
    const becamePublished = previousDoc?._status !== 'published' && doc._status === 'published'
    if (!becamePublished) return doc
    if (req?.context?.disableRevalidate) return doc // seed/import path — not a human publish
    const userId = req?.user?.id
    if (!userId) return doc // system/API write — no one to notify

    const tenantRaw = (doc as { tenant?: unknown }).tenant
    const tenantId = tenantRaw && typeof tenantRaw === 'object' ? (tenantRaw as { id: number }).id : tenantRaw
    if (tenantId == null) return doc

    const { resolveTenantBaseUrl } = await import('@/utilities/tenantBaseUrl')
    const base = await resolveTenantBaseUrl(req.payload, tenantId as number | string)
    const path = doc.slug === 'home' ? '' : `/${doc.slug}`
    const url = `${base}${path}`

    const { postCardDirective } = await import('@/utilities/cardDirectives')
    await postCardDirective(req.payload, {
      userId: userId as number,
      tenantId: tenantId as number | string,
      eyebrow: '✦ YOUR PAGE IS LIVE',
      title: `“${doc.title || doc.slug}” is live`,
      body: 'Your page just published. Tap to view it on your site.',
      url,
      ctaLabel: 'VIEW PAGE ▸',
      cardKind: 'update',
      dedupeKey: `page-published-${doc.id}`, // re-publish refreshes the same card
    })
  } catch (err) {
    req?.payload?.logger?.warn?.(
      `[pagePublishedDirective] ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  return doc
}
