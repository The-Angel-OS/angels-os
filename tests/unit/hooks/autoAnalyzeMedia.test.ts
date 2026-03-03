/**
 * autoAnalyzeMedia Hook — Unit Tests
 *
 * Tests the afterChange hook that queues background media analysis
 * for messages with attachments.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the heavy mediaAnalysis module so tests never hit actual AI APIs
vi.mock('@/utilities/mediaAnalysis', () => ({
  buildMediaMeta: vi.fn().mockResolvedValue(undefined),
}))

import { autoAnalyzeMedia } from '@/collections/Messages/hooks/autoAnalyzeMedia'

// ── Helper ────────────────────────────────────────────────────────────────────

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    tenant: 5,
    attachments: [] as any[],
    ...overrides,
  }
}

function makeArgs({
  doc = makeDoc(),
  operation = 'create' as 'create' | 'update',
} = {}) {
  return {
    doc,
    operation,
    req: { payload: { find: vi.fn(), create: vi.fn() } } as any,
    collection: null as any,
    context: {} as any,
    previousDoc: {} as any,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('autoAnalyzeMedia', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ANTHROPIC_API_KEY
  })

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalApiKey
    } else {
      delete process.env.ANTHROPIC_API_KEY
    }
  })

  // ── operation guard ───────────────────────────────────────────────────────

  it('returns doc unchanged on update operation', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const doc = makeDoc({ attachments: [{ media: { id: 10 } }] })
    const args = makeArgs({ doc, operation: 'update' })
    const result = await autoAnalyzeMedia(args as any)
    expect(result).toEqual(doc)
  })

  // ── attachment guard ──────────────────────────────────────────────────────

  it('returns doc unchanged when attachments is an empty array', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const doc = makeDoc({ attachments: [] })
    const args = makeArgs({ doc })
    const result = await autoAnalyzeMedia(args as any)
    expect(result).toEqual(doc)
  })

  it('returns doc unchanged when attachments is undefined', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const doc = makeDoc({ attachments: undefined })
    const args = makeArgs({ doc })
    const result = await autoAnalyzeMedia(args as any)
    expect(result).toEqual(doc)
  })

  it('returns doc unchanged when attachments is null', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const doc = makeDoc({ attachments: null })
    const args = makeArgs({ doc })
    const result = await autoAnalyzeMedia(args as any)
    expect(result).toEqual(doc)
  })

  it('returns doc unchanged when attachments is not an array (string)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const doc = makeDoc({ attachments: 'not-an-array' })
    const args = makeArgs({ doc })
    const result = await autoAnalyzeMedia(args as any)
    expect(result).toEqual(doc)
  })

  // ── API key guard ─────────────────────────────────────────────────────────

  it('returns doc unchanged when ANTHROPIC_API_KEY is not set', async () => {
    // API key deliberately not set
    const doc = makeDoc({ attachments: [{ media: { id: 10, filename: 'test.jpg' } }] })
    const args = makeArgs({ doc })
    const result = await autoAnalyzeMedia(args as any)
    expect(result).toEqual(doc)
  })

  // ── fire-and-forget ───────────────────────────────────────────────────────

  it('returns doc synchronously when all guards pass (non-blocking)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const doc = makeDoc({ attachments: [{ media: { id: 10, filename: 'photo.jpg' } }] })
    const args = makeArgs({ doc })
    // The hook should return doc immediately — not wait for media analysis
    const result = await autoAnalyzeMedia(args as any)
    expect(result).toEqual(doc)
  })

  it('resolves tenant ID from object-style tenant field', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const doc = makeDoc({
      tenant: { id: 42, name: 'Test Tenant' },
      attachments: [{ media: { id: 10 } }],
    })
    const args = makeArgs({ doc })
    // Should not throw even though tenant is an object
    await expect(autoAnalyzeMedia(args as any)).resolves.toEqual(doc)
  })

  it('resolves tenant ID from numeric tenant field', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const doc = makeDoc({
      tenant: 99,
      attachments: [{ media: { id: 10 } }],
    })
    const args = makeArgs({ doc })
    await expect(autoAnalyzeMedia(args as any)).resolves.toEqual(doc)
  })
})
