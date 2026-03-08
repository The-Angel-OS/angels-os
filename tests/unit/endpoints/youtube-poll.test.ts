/**
 * YouTube Channel Poll — Unit Tests
 *
 * Tests the YouTube-to-Posts synchronization endpoint.
 * Mocks: Payload local API, YouTube RSS feed, connector utilities.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock YouTube metadata ──────────────────────────────────────────────────
const mockFeed = [
  {
    videoId: 'abc123',
    title: 'Soul Quest Episode 1',
    sourceUrl: 'https://www.youtube.com/watch?v=abc123',
    publishedAt: '2026-03-01T12:00:00Z',
    thumbnailUrl: 'https://img.youtube.com/vi/abc123/maxresdefault.jpg',
    description: 'First episode of our Soul Quest series.',
    channelName: 'Clearwater Cruisin',
    channelId: 'UCtest123',
  },
  {
    videoId: 'def456',
    title: 'Dog Park Ministry',
    sourceUrl: 'https://www.youtube.com/watch?v=def456',
    publishedAt: '2026-03-02T12:00:00Z',
    thumbnailUrl: 'https://img.youtube.com/vi/def456/maxresdefault.jpg',
    description: 'At the dog park sharing love.',
    channelName: 'Clearwater Cruisin',
    channelId: 'UCtest123',
  },
]

vi.mock('@/utilities/youtubeMetadata', () => ({
  fetchYouTubeChannelFeed: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/utilities/resolveConnector', () => ({
  findAllConnectors: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/utilities/bridgeHelpers', () => ({
  markConnectorActive: vi.fn().mockResolvedValue(undefined),
  markConnectorError: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utilities/logError', () => ({
  logCaughtError: vi.fn(),
}))

vi.mock('@/utilities/lexicalHelpers', () => ({
  createLexicalContent: vi.fn((nodes: any[]) => ({ root: { children: nodes } })),
  createHeadingNode: vi.fn((text: string, tag: string) => ({ type: 'heading', tag, children: [{ text }] })),
  createParagraphNode: vi.fn((text: string) => ({ type: 'paragraph', children: [{ text }] })),
}))

import { fetchYouTubeChannelFeed } from '@/utilities/youtubeMetadata'
import { findAllConnectors } from '@/utilities/resolveConnector'
import { markConnectorActive, markConnectorError } from '@/utilities/bridgeHelpers'

// ── Helper: build a mock PayloadHandler request ───────────────────────────

function makeReq(overrides: Record<string, unknown> = {}) {
  const mockPayload = {
    find: vi.fn().mockResolvedValue({ docs: [] }),
    create: vi.fn().mockResolvedValue({ id: 1 }),
  }

  return {
    payload: mockPayload,
    headers: new Headers({
      authorization: `Bearer test-cron-secret`,
    }),
    ...overrides,
  } as any
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('YouTube Poll Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-cron-secret'
  })

  // We test the exported handler by importing it
  // Since we can't easily test the full handler (it needs Response.json),
  // we test the core logic through the mocked dependencies

  describe('Authorization', () => {
    it('rejects requests without valid cron secret', async () => {
      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq({
        headers: new Headers({ authorization: 'Bearer wrong-secret' }),
      })
      const res = await youtubePollHandler(req)
      expect(res.status).toBe(401)
    })

    it('allows requests with valid cron secret', async () => {
      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      const res = await youtubePollHandler(req)
      expect(res.status).toBe(200)
    })
  })

  describe('No connectors', () => {
    it('returns empty results when no connectors exist', async () => {
      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      const res = await youtubePollHandler(req)
      const body = await res.json()
      expect(body.results).toEqual([])
    })
  })

  describe('With connectors', () => {
    it('processes connector and creates posts for new videos', async () => {
      vi.mocked(findAllConnectors).mockResolvedValue([
        {
          id: 'conn-1',
          tenantId: '1',
          config: { channelId: 'UCtest123', limit: 10, status: 'published' },
        },
      ])
      vi.mocked(fetchYouTubeChannelFeed).mockResolvedValue(mockFeed)

      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      const res = await youtubePollHandler(req)
      const body = await res.json()

      expect(body.connectors).toBe(1)
      expect(body.totalCreated).toBe(2)
      expect(body.totalSkipped).toBe(0)
      expect(fetchYouTubeChannelFeed).toHaveBeenCalledWith('UCtest123', 10)
      expect(markConnectorActive).toHaveBeenCalledWith(expect.anything(), 'conn-1')
    })

    it('skips already-ingested videos (deduplication)', async () => {
      vi.mocked(findAllConnectors).mockResolvedValue([
        {
          id: 'conn-1',
          tenantId: '1',
          config: { channelId: 'UCtest123', limit: 10 },
        },
      ])
      vi.mocked(fetchYouTubeChannelFeed).mockResolvedValue(mockFeed)

      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      // Make the first video "already exist"
      req.payload.find.mockImplementation(async (args: any) => {
        if (args.collection === 'posts' && args.where?.sourceUrl?.equals === mockFeed[0].sourceUrl) {
          return { docs: [{ id: 99 }] }
        }
        return { docs: [] }
      })

      const res = await youtubePollHandler(req)
      const body = await res.json()

      expect(body.totalCreated).toBe(1)
      expect(body.totalSkipped).toBe(1)
    })

    it('handles missing channelId in config', async () => {
      vi.mocked(findAllConnectors).mockResolvedValue([
        {
          id: 'conn-bad',
          tenantId: '1',
          config: { limit: 10 }, // no channelId
        },
      ])

      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      const res = await youtubePollHandler(req)
      const body = await res.json()

      expect(body.results[0].error).toBe('Missing channelId in config')
      expect(markConnectorError).toHaveBeenCalledWith(
        expect.anything(),
        'conn-bad',
        'Missing channelId in config',
      )
    })

    it('marks connector as error when RSS feed returns empty', async () => {
      vi.mocked(findAllConnectors).mockResolvedValue([
        {
          id: 'conn-empty',
          tenantId: '1',
          config: { channelId: 'UCnonexistent' },
        },
      ])
      vi.mocked(fetchYouTubeChannelFeed).mockResolvedValue([])

      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      const res = await youtubePollHandler(req)
      const body = await res.json()

      expect(body.results[0].error).toContain('No videos in RSS feed')
      expect(markConnectorError).toHaveBeenCalled()
    })

    it('clamps limit to 1-15 range', async () => {
      vi.mocked(findAllConnectors).mockResolvedValue([
        {
          id: 'conn-limit',
          tenantId: '1',
          config: { channelId: 'UCtest123', limit: 50 },
        },
      ])
      vi.mocked(fetchYouTubeChannelFeed).mockResolvedValue([])

      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      await youtubePollHandler(req)

      // Should be clamped to 15
      expect(fetchYouTubeChannelFeed).toHaveBeenCalledWith('UCtest123', 15)
    })

    it('defaults status to "published" when not set', async () => {
      vi.mocked(findAllConnectors).mockResolvedValue([
        {
          id: 'conn-1',
          tenantId: '1',
          config: { channelId: 'UCtest123' },
        },
      ])
      vi.mocked(fetchYouTubeChannelFeed).mockResolvedValue([mockFeed[0]])

      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      await youtubePollHandler(req)

      // Verify the post was created with published status
      expect(req.payload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            _status: 'published',
            sourceType: 'youtube',
          }),
        }),
      )
    })

    it('creates posts with draft status when configured', async () => {
      vi.mocked(findAllConnectors).mockResolvedValue([
        {
          id: 'conn-draft',
          tenantId: '1',
          config: { channelId: 'UCtest123', status: 'draft' },
        },
      ])
      vi.mocked(fetchYouTubeChannelFeed).mockResolvedValue([mockFeed[0]])

      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      await youtubePollHandler(req)

      expect(req.payload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ _status: 'draft' }),
        }),
      )
    })

    it('sets tenant on created posts', async () => {
      vi.mocked(findAllConnectors).mockResolvedValue([
        {
          id: 'conn-1',
          tenantId: '42',
          config: { channelId: 'UCtest123' },
        },
      ])
      vi.mocked(fetchYouTubeChannelFeed).mockResolvedValue([mockFeed[0]])

      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      await youtubePollHandler(req)

      expect(req.payload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenant: '42' }),
        }),
      )
    })

    it('handles create failure gracefully and counts it as failed', async () => {
      vi.mocked(findAllConnectors).mockResolvedValue([
        {
          id: 'conn-1',
          tenantId: '1',
          config: { channelId: 'UCtest123' },
        },
      ])
      vi.mocked(fetchYouTubeChannelFeed).mockResolvedValue([mockFeed[0]])

      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      req.payload.create.mockRejectedValue(new Error('DB connection lost'))

      const res = await youtubePollHandler(req)
      const body = await res.json()

      expect(body.results[0].failed).toBe(1)
      expect(body.results[0].created).toBe(0)
    })

    it('handles connector exception gracefully', async () => {
      vi.mocked(findAllConnectors).mockResolvedValue([
        {
          id: 'conn-throw',
          tenantId: '1',
          config: { channelId: 'UCtest123' },
        },
      ])
      vi.mocked(fetchYouTubeChannelFeed).mockRejectedValue(new Error('Network timeout'))

      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      const res = await youtubePollHandler(req)
      const body = await res.json()

      expect(body.results[0].error).toBe('Network timeout')
      expect(markConnectorError).toHaveBeenCalledWith(
        expect.anything(),
        'conn-throw',
        'Network timeout',
      )
    })

    it('resolves categories by name', async () => {
      vi.mocked(findAllConnectors).mockResolvedValue([
        {
          id: 'conn-cat',
          tenantId: '1',
          config: { channelId: 'UCtest123', categories: ['Ministry'] },
        },
      ])
      vi.mocked(fetchYouTubeChannelFeed).mockResolvedValue([mockFeed[0]])

      const { youtubePollHandler } = await import('@/endpoints/youtube-poll')
      const req = makeReq()
      // Mock category lookup
      req.payload.find.mockImplementation(async (args: any) => {
        if (args.collection === 'categories') {
          return { docs: [{ id: 7 }] }
        }
        return { docs: [] }
      })

      await youtubePollHandler(req)

      expect(req.payload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ categories: [7] }),
        }),
      )
    })
  })
})
