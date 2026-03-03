import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/utilities/apiRateLimiter', () => ({
  applyRateLimit: vi.fn().mockReturnValue(null),
}))

const mockBuildMediaMeta = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/mediaAnalysis', () => ({
  buildMediaMeta: mockBuildMediaMeta,
}))

import { mediaAnalyzeHandler } from '@/endpoints/media-analyze'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(
  body: Record<string, unknown> | null,
  mediaDoc: Record<string, unknown> | null = { id: 42, tenant: 10 },
  user: Record<string, unknown> | null = { id: 1 },
) {
  const nativeReq = new Request('http://localhost/api/media/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT VALID JSON{{{',
  })
  const payload = {
    findByID: mediaDoc !== null
      ? vi.fn().mockResolvedValue(mediaDoc)
      : vi.fn().mockRejectedValue(new Error('Not found')),
  }
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('mediaAnalyzeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBuildMediaMeta.mockResolvedValue({
      success: true,
      metaIds: [101, 102],
      error: undefined,
    })
  })

  // ── Authentication ────────────────────────────────────────────────────────

  it('returns 401 when no user is authenticated', async () => {
    const req = makeReq({ mediaId: 42 }, { id: 42, tenant: 1 }, null)
    const res = await mediaAnalyzeHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/authentication required/i)
  })

  // ── Body parsing ──────────────────────────────────────────────────────────

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await mediaAnalyzeHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/invalid json/i)
  })

  // ── Field validation ──────────────────────────────────────────────────────

  it('returns 400 when mediaId is missing', async () => {
    const req = makeReq({})
    const res = await mediaAnalyzeHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/mediaId is required/i)
  })

  // ── Media fetch ───────────────────────────────────────────────────────────

  it('returns 404 when the media document is not found', async () => {
    const req = makeReq({ mediaId: 999 }, null)
    const res = await mediaAnalyzeHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/not found/i)
  })

  // ── Successful analysis ───────────────────────────────────────────────────

  it('returns 200 with success and metaIds on successful analysis', async () => {
    const req = makeReq({ mediaId: 42 })
    const res = await mediaAnalyzeHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.metaIds).toEqual([101, 102])
    expect(body.message).toMatch(/analysis complete/i)
    expect(body.message).toContain('2')
  })

  it('passes customPrompt and inventoryMode to buildMediaMeta', async () => {
    const req = makeReq({
      mediaId: 42,
      customPrompt: 'Describe the colors',
      inventoryMode: true,
    })
    await mediaAnalyzeHandler(req)
    expect(mockBuildMediaMeta).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customPrompt: 'Describe the colors',
        inventoryMode: true,
      }),
    )
  })

  it('resolves tenantId from media document (object relation)', async () => {
    const req = makeReq({ mediaId: 42 }, { id: 42, tenant: { id: 77 } })
    await mediaAnalyzeHandler(req)
    expect(mockBuildMediaMeta).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: 77 }),
    )
  })

  it('resolves tenantId from media document (scalar relation)', async () => {
    const req = makeReq({ mediaId: 42 }, { id: 42, tenant: 55 })
    await mediaAnalyzeHandler(req)
    expect(mockBuildMediaMeta).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: 55 }),
    )
  })

  it('returns 500 when buildMediaMeta throws', async () => {
    mockBuildMediaMeta.mockRejectedValueOnce(new Error('AI service unavailable'))
    const req = makeReq({ mediaId: 42 })
    const res = await mediaAnalyzeHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/ai service unavailable/i)
  })

  it('surfaces the error message from buildMediaMeta when success is false', async () => {
    mockBuildMediaMeta.mockResolvedValueOnce({
      success: false,
      metaIds: [],
      error: 'No text content found in image',
    })
    const req = makeReq({ mediaId: 42 })
    const res = await mediaAnalyzeHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toBe('No text content found in image')
  })
})
