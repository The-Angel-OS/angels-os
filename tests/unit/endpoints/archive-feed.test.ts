/**
 * Lean Public Archive Feed Endpoint — Unit Tests
 *
 * GET /api/archive-feed — archiveFeedHandler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { archiveFeedHandler } from '@/endpoints/archive-feed'

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({
      docs: [],
      page: 1,
      totalPages: 1,
      totalDocs: 0,
      hasNextPage: false,
    }),
    ...overrides,
  }
}

function makeReq(
  url: string,
  payloadOverrides: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request(url, { method: 'GET', headers })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Object.assign(nativeReq, { payload }) as any
}

describe('archiveFeedHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns safe empty response when tenant cannot be resolved', async () => {
    const req = makeReq('https://spacesangels.com/api/archive-feed?page=2&limit=12')
    const res = await archiveFeedHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      docs: [],
      page: 2,
      totalPages: 1,
      totalDocs: 0,
      hasNextPage: false,
    })
  })

  it('returns safe empty response immediately when categories contains -1', async () => {
    const req = makeReq('https://spacesangels.com/api/archive-feed?tenant=5&categories=-1')
    const res = await archiveFeedHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      docs: [],
      page: 1,
      totalPages: 1,
      totalDocs: 0,
      hasNextPage: false,
    })
    expect(req.payload.find).not.toHaveBeenCalled()
  })

  it('filters by tenant, categories, and search q while omitting layout from select', async () => {
    const findMock = vi.fn().mockResolvedValue({
      docs: [
        {
          id: 501,
          slug: 'dog-park-walk',
          title: 'Dog Park Walk',
          publishedOn: '2026-11-20T12:00:00.000Z',
          sourceUrl: 'https://www.youtube.com/watch?v=abc123def45',
          sourceType: 'youtube',
          access: 'members',
          categories: [{ id: 21, title: 'Videos', slug: 'videos' }],
          meta: {
            description: 'Morning walk at Enterprise Dog Park.',
            image: {
              id: 88,
              url: 'https://cdn.example.com/thumb.jpg',
              alt: 'Dog Park',
              width: 480,
              height: 360,
              filename: 'thumb.jpg',
              mimeType: 'image/jpeg',
            },
          },
          hero: { media: null },
          layout: [{ blockType: 'transcript', fullText: 'Should not be forwarded' }],
        },
      ],
      page: 2,
      totalPages: 10,
      totalDocs: 118,
      hasNextPage: true,
    })

    const req = makeReq(
      'https://clearwater-cruisin.spacesangels.com/api/archive-feed?tenant=5&categories=21,22&q=dog&page=2&limit=12',
      { find: findMock },
    )
    const res = await archiveFeedHandler(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=30')

    expect(findMock).toHaveBeenCalledTimes(1)
    const callArgs = findMock.mock.calls[0][0]
    expect(callArgs.collection).toBe('posts')
    expect(callArgs.draft).toBe(false)
    expect(callArgs.page).toBe(2)
    expect(callArgs.limit).toBe(12)
    expect(callArgs.sort).toBe('-publishedOn')
    expect(callArgs.select).toBeDefined()
    expect(callArgs.select.layout).toBeUndefined()
    expect(callArgs.where.and).toEqual(
      expect.arrayContaining([
        { tenant: { equals: 5 } },
        { _status: { equals: 'published' } },
        { categories: { in: [21, 22] } },
      ]),
    )

    const body = await res.json()
    expect(body.page).toBe(2)
    expect(body.totalPages).toBe(10)
    expect(body.totalDocs).toBe(118)
    expect(body.hasNextPage).toBe(true)
    expect(body.docs).toHaveLength(1)
    expect(body.docs[0]).not.toHaveProperty('layout')
    expect(body.docs[0].access).toBe('members')
    expect(body.docs[0].categories).toEqual([{ id: 21, title: 'Videos', slug: 'videos' }])
    expect(body.docs[0].meta.image.url).toBe('https://cdn.example.com/thumb.jpg')
  })

  it('resolves tenant by slug when tenant query param is non-numeric', async () => {
    const findMock = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ id: 5 }] })
      .mockResolvedValueOnce({ docs: [], page: 1, totalPages: 1, totalDocs: 0, hasNextPage: false })

    const req = makeReq(
      'https://spacesangels.com/api/archive-feed?tenant=clearwater-cruisin&limit=99',
      { find: findMock },
    )
    const res = await archiveFeedHandler(req)
    expect(res.status).toBe(200)
    expect(findMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'tenants',
        where: { slug: { equals: 'clearwater-cruisin' } },
      }),
    )
    expect(findMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'posts',
        limit: 36,
      }),
    )
  })
})
