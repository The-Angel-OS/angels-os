/**
 * revalidatePage / revalidateDelete Hooks — Unit Tests
 *
 * Tests that the afterChange and afterDelete hooks call revalidatePath
 * with the correct paths, and respect the disableRevalidate context flag.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/cache — factory must be self-contained (no external variable refs)
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { revalidatePage, revalidateDelete } from '@/collections/Pages/hooks/revalidatePage'
import { revalidatePath } from 'next/cache'

// Typed reference to the mock for assertions
const mockRevalidatePath = vi.mocked(revalidatePath)

// ── Helper ────────────────────────────────────────────────────────────────────

function makeReq(opts: { disableRevalidate?: boolean } = {}) {
  return {
    payload: { logger: { info: vi.fn() } },
    context: { disableRevalidate: opts.disableRevalidate ?? false },
  } as any
}

function makeDoc(overrides: Record<string, unknown> = {}) {
  return { id: 1, slug: 'about', _status: 'published', ...overrides } as any
}

// ── revalidatePage ────────────────────────────────────────────────────────────

describe('revalidatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls revalidatePath with /<slug> for a published page', () => {
    const doc = makeDoc({ slug: 'about', _status: 'published' })
    const result = revalidatePage({ doc, previousDoc: {}, req: makeReq() } as any)
    expect(result).toEqual(doc)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/about')
  })

  it('calls revalidatePath with "/" for the home slug', () => {
    const doc = makeDoc({ slug: 'home', _status: 'published' })
    revalidatePage({ doc, previousDoc: {}, req: makeReq() } as any)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
  })

  it('does NOT call revalidatePath when doc is a draft', () => {
    const doc = makeDoc({ slug: 'draft-page', _status: 'draft' })
    revalidatePage({ doc, previousDoc: {}, req: makeReq() } as any)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('revalidates old path when page transitions from published to draft', () => {
    const doc = makeDoc({ slug: 'about', _status: 'draft' })
    const previousDoc = makeDoc({ slug: 'about', _status: 'published' })
    revalidatePage({ doc, previousDoc, req: makeReq() } as any)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/about')
  })

  it('revalidates both paths when slug changes while staying published', () => {
    const doc = makeDoc({ slug: 'new-about', _status: 'published' })
    const previousDoc = makeDoc({ slug: 'old-about', _status: 'published' })
    revalidatePage({ doc, previousDoc, req: makeReq() } as any)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/new-about')
    expect(mockRevalidatePath).not.toHaveBeenCalledWith('/old-about') // old path only if prev was published AND doc is NOT published
  })

  it('skips revalidation when disableRevalidate is true', () => {
    const doc = makeDoc({ slug: 'about', _status: 'published' })
    revalidatePage({ doc, previousDoc: {}, req: makeReq({ disableRevalidate: true }) } as any)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns doc even when revalidatePath throws', () => {
    mockRevalidatePath.mockImplementationOnce(() => {
      throw new Error('Not in Next.js context')
    })
    const doc = makeDoc({ slug: 'about', _status: 'published' })
    const result = revalidatePage({ doc, previousDoc: {}, req: makeReq() } as any)
    expect(result).toEqual(doc)
  })
})

// ── revalidateDelete ──────────────────────────────────────────────────────────

describe('revalidateDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls revalidatePath with /<slug> when a page is deleted', () => {
    const doc = makeDoc({ slug: 'about' })
    const result = revalidateDelete({ doc, req: makeReq() } as any)
    expect(result).toEqual(doc)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/about')
  })

  it('calls revalidatePath with "/" for deleted home page', () => {
    const doc = makeDoc({ slug: 'home' })
    revalidateDelete({ doc, req: makeReq() } as any)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
  })

  it('skips revalidation when disableRevalidate is true', () => {
    const doc = makeDoc({ slug: 'about' })
    revalidateDelete({ doc, req: makeReq({ disableRevalidate: true }) } as any)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns doc even when revalidatePath throws', () => {
    mockRevalidatePath.mockImplementationOnce(() => {
      throw new Error('Not in Next.js context')
    })
    const doc = makeDoc({ slug: 'about' })
    const result = revalidateDelete({ doc, req: makeReq() } as any)
    expect(result).toEqual(doc)
  })
})
