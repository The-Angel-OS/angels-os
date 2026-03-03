/**
 * revalidatePost / revalidateDelete Hooks — Unit Tests
 *
 * Tests that the afterChange and afterDelete hooks call revalidatePath
 * with the correct paths for Post documents.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/cache — factory must be self-contained (no external variable refs)
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { revalidatePost, revalidateDelete } from '@/collections/Posts/hooks/revalidatePost'
import { revalidatePath } from 'next/cache'

// Typed reference to the mock for assertions
const mockRevalidatePath = vi.mocked(revalidatePath)

// ── Helper ────────────────────────────────────────────────────────────────────

function makeReq(opts: { disableRevalidate?: boolean } = {}) {
  return {
    payload: { logger: { info: vi.fn() } },
    context: opts.disableRevalidate !== undefined ? { disableRevalidate: opts.disableRevalidate } : {},
  } as any
}

function makeDoc(overrides: Record<string, unknown> = {}) {
  return { id: 1, slug: 'my-post', _status: 'published', ...overrides } as any
}

// ── revalidatePost ────────────────────────────────────────────────────────────

describe('revalidatePost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls revalidatePath with /posts/<slug> for a published post', () => {
    const doc = makeDoc({ slug: 'my-post', _status: 'published' })
    const result = revalidatePost({ doc, req: makeReq() } as any)
    expect(result).toEqual(doc)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/posts/my-post')
  })

  it('calls revalidatePath with /posts when slug is missing', () => {
    const doc = makeDoc({ slug: undefined, _status: 'published' })
    revalidatePost({ doc, req: makeReq() } as any)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/posts')
  })

  it('does NOT call revalidatePath when post is a draft', () => {
    const doc = makeDoc({ slug: 'draft-post', _status: 'draft' })
    revalidatePost({ doc, req: makeReq() } as any)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('skips revalidation when disableRevalidate is true', () => {
    const doc = makeDoc({ slug: 'my-post', _status: 'published' })
    revalidatePost({ doc, req: makeReq({ disableRevalidate: true }) } as any)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns doc even when revalidatePath throws', () => {
    mockRevalidatePath.mockImplementationOnce(() => {
      throw new Error('Not in Next.js context')
    })
    const doc = makeDoc({ slug: 'my-post', _status: 'published' })
    const result = revalidatePost({ doc, req: makeReq() } as any)
    expect(result).toEqual(doc)
  })
})

// ── revalidateDelete ──────────────────────────────────────────────────────────

describe('revalidateDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls revalidatePath with /posts/<slug> when a post is deleted', () => {
    const doc = makeDoc({ slug: 'my-post' })
    const result = revalidateDelete({ doc, req: makeReq() } as any)
    expect(result).toEqual(doc)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/posts/my-post')
  })

  it('calls revalidatePath with /posts when deleted post has no slug', () => {
    const doc = makeDoc({ slug: null })
    revalidateDelete({ doc, req: makeReq() } as any)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/posts')
  })

  it('skips revalidation when disableRevalidate is true', () => {
    const doc = makeDoc({ slug: 'my-post' })
    revalidateDelete({ doc, req: makeReq({ disableRevalidate: true }) } as any)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns doc even when revalidatePath throws', () => {
    mockRevalidatePath.mockImplementationOnce(() => {
      throw new Error('Not in Next.js context')
    })
    const doc = makeDoc({ slug: 'my-post' })
    const result = revalidateDelete({ doc, req: makeReq() } as any)
    expect(result).toEqual(doc)
  })
})
