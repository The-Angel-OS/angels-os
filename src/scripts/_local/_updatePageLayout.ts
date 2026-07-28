/**
 * Update a page's `layout` WITHOUT unpublishing it.
 *
 * Pages has `versions.drafts`, so `payload.update({ data: { layout } })` with no
 * `_status` writes a DRAFT — and the live page silently 404s. There is no error,
 * no warning, and the script prints "updated" either way.
 *
 * That took `/buy-kessela-now` offline (the only link on the site that takes
 * money) and later `/how-to-use-belt`, both discovered by accident hours after
 * the fact (260727).
 *
 * `_status` is carried through rather than forced to 'published': a page that
 * was deliberately a draft must stay one.
 *
 * @see docs/FOOTGUNS.md
 */
import type { Payload } from 'payload'

export type LayoutBlock = Record<string, unknown>

export async function updatePageLayout(
  payload: Payload,
  page: { id: number | string; _status?: string | null },
  layout: LayoutBlock[],
  collection: 'pages' | 'posts' = 'pages',
): Promise<void> {
  await (payload.update as never as (a: unknown) => Promise<unknown>)({
    collection,
    id: page.id,
    data: {
      layout,
      // The whole point of this helper.
      _status: page._status ?? 'published',
    },
    overrideAccess: true,
  })
}
