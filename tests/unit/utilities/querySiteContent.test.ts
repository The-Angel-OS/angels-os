/**
 * query_site_content — draft visibility.
 *
 * A page sitting in draft used to read to LEO as a page that does not exist.
 * Page 113 (`pelvic-floor`) was invisible that way while Ken was looking at it
 * in the admin. Four separate incidents this week were the same twenty minutes
 * of hunting for a bug that was a Publish button.
 */
import { describe, expect, it, vi } from 'vitest'

import { executeToolCall, type ToolExecutorContext } from '@/utilities/leo-data-tools'

const page = (over: Record<string, unknown>) => ({
  id: 1,
  title: 'Untitled',
  slug: 'untitled',
  _status: 'published',
  hero: {},
  layout: [
    { blockType: 'content', columns: [{ richText: { root: { children: [] } } }], heading: 'Some words here' },
  ],
  ...over,
})

const run = (docs: unknown[], input: Record<string, unknown> = {}) => {
  const payload = { find: vi.fn(async () => ({ docs, totalDocs: docs.length })) }
  const ctx = { payload, tenantId: 5, roles: [] } as unknown as ToolExecutorContext
  return executeToolCall('query_site_content', input, ctx)
}

describe('query_site_content draft visibility', () => {
  it('says an unpublished page EXISTS instead of reporting nothing', async () => {
    const out = await run([
      page({ id: 113, title: 'Pelvic Floor', slug: 'pelvic-floor', _status: 'draft' }),
    ])
    expect(out).toMatch(/pelvic-floor/i)
    expect(out).toMatch(/unpublished|draft/i)
    expect(out).not.toMatch(/nothing matched/i)
  })

  it('flags a draft that matches the search even when published pages answered it', async () => {
    const out = await run(
      [
        page({ id: 1, title: 'Services', slug: 'services', layout: [{ heading: 'pelvic therapy services' }] }),
        page({ id: 113, title: 'Pelvic Floor', slug: 'pelvic-floor', _status: 'draft' }),
      ],
      { search: 'pelvic' },
    )
    expect(out).toMatch(/Services/)
    expect(out).toMatch(/UNPUBLISHED/)
  })

  it('marks draft products, so LEO cannot offer one that is not live', async () => {
    const payload = {
      find: vi.fn(async () => ({
        docs: [
          { id: 1, title: 'Live Kayak', slug: 'kayak', priceInUSD: 12900, _status: 'published' },
          { id: 2, title: 'Unlisted Canoe', slug: 'canoe', priceInUSD: 9900, _status: 'draft' },
        ],
        totalDocs: 2,
      })),
    }
    const out = await executeToolCall(
      'query_products',
      {},
      { payload, tenantId: 5, roles: [] } as unknown as ToolExecutorContext,
    )
    expect(out).toMatch(/Unlisted Canoe.*DRAFT/)
    expect(out.match(/DRAFT/g)).toHaveLength(1)
  })

  it('stays quiet about unrelated drafts on an ordinary answer', async () => {
    const out = await run([
      page({ id: 1, title: 'About', slug: 'about', layout: [{ heading: 'we fix boats' }] }),
      page({ id: 2, title: 'Secret Rebrand', slug: 'rebrand', _status: 'draft' }),
    ])
    expect(out).toMatch(/About/)
    expect(out).not.toMatch(/UNPUBLISHED/)
  })
})
