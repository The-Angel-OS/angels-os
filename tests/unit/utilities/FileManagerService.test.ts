/**
 * FileManagerService — Unit Tests
 *
 * Tests the pure formatFileSize and getFileTypeIcon helpers,
 * plus fetch-based methods via stubbed global.fetch.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

import { FileManagerService } from '@/utilities/FileManagerService'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(ok: boolean, body: unknown) {
  const spy = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── formatFileSize ─────────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('returns "0 Bytes" for 0', () => {
    expect(FileManagerService.formatFileSize(0)).toBe('0 Bytes')
  })

  it('returns bytes for small values', () => {
    expect(FileManagerService.formatFileSize(512)).toContain('Bytes')
  })

  it('formats 1024 as 1 KB', () => {
    expect(FileManagerService.formatFileSize(1024)).toBe('1 KB')
  })

  it('formats 1536 as 1.5 KB', () => {
    expect(FileManagerService.formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats 1048576 as 1 MB', () => {
    expect(FileManagerService.formatFileSize(1048576)).toBe('1 MB')
  })

  it('formats 1073741824 as 1 GB', () => {
    expect(FileManagerService.formatFileSize(1073741824)).toBe('1 GB')
  })

  it('formats 2.5 MB correctly', () => {
    expect(FileManagerService.formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})

// ── getFileTypeIcon ────────────────────────────────────────────────────────────

describe('getFileTypeIcon', () => {
  it('returns image icon for image/* types', () => {
    expect(FileManagerService.getFileTypeIcon('image/jpeg')).toContain('🖼️')
    expect(FileManagerService.getFileTypeIcon('image/png')).toContain('🖼️')
  })

  it('returns video icon for video/* types', () => {
    expect(FileManagerService.getFileTypeIcon('video/mp4')).toContain('🎥')
  })

  it('returns audio icon for audio/* types', () => {
    expect(FileManagerService.getFileTypeIcon('audio/mpeg')).toContain('🎵')
  })

  it('returns pdf icon for application/pdf', () => {
    expect(FileManagerService.getFileTypeIcon('application/pdf')).toContain('📄')
  })

  it('returns document icon for word/document types', () => {
    expect(FileManagerService.getFileTypeIcon('application/msword')).toContain('📝')
  })

  it('returns spreadsheet icon for excel/spreadsheet types', () => {
    // Use ms-excel (contains 'excel') to avoid 'officedocument' prefix ambiguity
    expect(FileManagerService.getFileTypeIcon('application/vnd.ms-excel')).toContain('📊')
  })

  it('returns presentation icon for powerpoint types', () => {
    expect(FileManagerService.getFileTypeIcon('application/vnd.ms-powerpoint')).toContain('📈')
  })

  it('returns archive icon for zip types', () => {
    expect(FileManagerService.getFileTypeIcon('application/zip')).toContain('🗜️')
  })

  it('returns generic file icon for unknown types', () => {
    expect(FileManagerService.getFileTypeIcon('application/octet-stream')).toContain('📁')
  })
})

// ── loadFiles ──────────────────────────────────────────────────────────────────

describe('loadFiles', () => {
  it('returns empty array when response is not ok', async () => {
    mockFetch(false, {})
    const result = await FileManagerService.loadFiles()
    expect(result).toEqual([])
  })

  it('maps docs to ManagedFile shape', async () => {
    const doc = {
      id: 'media-1',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      filesize: 204800,
      url: 'https://cdn.example.com/photo.jpg',
      createdAt: '2026-03-01T00:00:00.000Z',
      sizes: { thumbnail: { url: 'https://cdn.example.com/photo-thumb.jpg' } },
    }
    mockFetch(true, { docs: [doc] })
    const result = await FileManagerService.loadFiles(1)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('media-1')
    expect(result[0].mimeType).toBe('image/jpeg')
    expect(result[0].filesize).toBe(204800)
    expect(result[0].thumbnailUrl).toBe('https://cdn.example.com/photo-thumb.jpg')
  })

  it('returns empty array when docs is empty', async () => {
    mockFetch(true, { docs: [] })
    const result = await FileManagerService.loadFiles()
    expect(result).toEqual([])
  })
})

// ── deleteFile ─────────────────────────────────────────────────────────────────

describe('deleteFile', () => {
  it('calls DELETE /api/media/:id', async () => {
    const fetchSpy = mockFetch(true, {})
    await FileManagerService.deleteFile('media-7')
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/media/media-7',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('throws when response is not ok', async () => {
    mockFetch(false, {})
    await expect(FileManagerService.deleteFile('media-7')).rejects.toThrow('Failed to delete media file')
  })
})

// ── updateFile ─────────────────────────────────────────────────────────────────

describe('updateFile', () => {
  it('calls PATCH /api/media/:id', async () => {
    const fetchSpy = mockFetch(true, {})
    await FileManagerService.updateFile('media-3', { alt: 'New alt text' })
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/media/media-3',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('throws when response is not ok', async () => {
    mockFetch(false, {})
    await expect(FileManagerService.updateFile('media-3', { alt: 'x' })).rejects.toThrow(
      'Failed to update media file',
    )
  })
})

// ── getFileStats ───────────────────────────────────────────────────────────────

describe('getFileStats', () => {
  it('returns zero stats when no files', async () => {
    mockFetch(true, { docs: [] })
    const stats = await FileManagerService.getFileStats()
    expect(stats.totalFiles).toBe(0)
    expect(stats.totalSize).toBe(0)
    expect(stats.recentUploads).toBe(0)
  })

  it('counts file types by extension', async () => {
    const docs = [
      { id: '1', filename: 'a.jpg', mimeType: 'image/jpeg', filesize: 1000, url: '', createdAt: new Date().toISOString() },
      { id: '2', filename: 'b.jpg', mimeType: 'image/jpeg', filesize: 2000, url: '', createdAt: new Date().toISOString() },
      { id: '3', filename: 'c.pdf', mimeType: 'application/pdf', filesize: 3000, url: '', createdAt: new Date().toISOString() },
    ]
    mockFetch(true, { docs })
    const stats = await FileManagerService.getFileStats()
    expect(stats.totalFiles).toBe(3)
    expect(stats.fileTypes['jpg']).toBe(2)
    expect(stats.fileTypes['pdf']).toBe(1)
    expect(stats.totalSize).toBe(6000)
  })

  it('counts recent uploads (within last 7 days)', async () => {
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 3) // 3 days ago — recent

    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 10) // 10 days ago — not recent

    const docs = [
      { id: '1', filename: 'recent.jpg', mimeType: 'image/jpeg', filesize: 1000, url: '', createdAt: recentDate.toISOString() },
      { id: '2', filename: 'old.jpg', mimeType: 'image/jpeg', filesize: 1000, url: '', createdAt: oldDate.toISOString() },
    ]
    mockFetch(true, { docs })
    const stats = await FileManagerService.getFileStats()
    expect(stats.recentUploads).toBe(1)
  })
})
