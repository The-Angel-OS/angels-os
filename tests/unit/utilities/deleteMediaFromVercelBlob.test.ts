/**
 * deleteMediaFromVercelBlob — Unit Tests
 *
 * Tests the guard conditions (null/non-blob URL) and the delegate call to @vercel/blob.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@vercel/blob', () => ({
  del: vi.fn().mockResolvedValue(undefined),
}))

import { deleteMediaFromVercelBlob } from '@/utilities/deleteMediaFromVercelBlob'
import { del } from '@vercel/blob'

const mockDel = vi.mocked(del)

// ── deleteMediaFromVercelBlob ─────────────────────────────────────────────────

describe('deleteMediaFromVercelBlob', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('does nothing when url is null', async () => {
    await deleteMediaFromVercelBlob(null)
    expect(mockDel).not.toHaveBeenCalled()
  })

  it('does nothing when url is undefined', async () => {
    await deleteMediaFromVercelBlob(undefined)
    expect(mockDel).not.toHaveBeenCalled()
  })

  it('does nothing when url is empty string', async () => {
    await deleteMediaFromVercelBlob('')
    expect(mockDel).not.toHaveBeenCalled()
  })

  it('does nothing when url does not contain blob.vercel-storage.com', async () => {
    await deleteMediaFromVercelBlob('https://example.com/image.jpg')
    expect(mockDel).not.toHaveBeenCalled()
  })

  it('calls del() for a valid Vercel Blob URL', async () => {
    const url = 'https://abc.blob.vercel-storage.com/image-xyz.jpg'
    await deleteMediaFromVercelBlob(url)
    expect(mockDel).toHaveBeenCalledWith(url, expect.objectContaining({}))
  })

  it('passes a custom token to del() when provided', async () => {
    const url = 'https://abc.blob.vercel-storage.com/file.pdf'
    await deleteMediaFromVercelBlob(url, 'my-custom-token')
    expect(mockDel).toHaveBeenCalledWith(url, expect.objectContaining({ token: 'my-custom-token' }))
  })
})
