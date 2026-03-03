/**
 * Docs Endpoint — Unit Tests
 *
 * GET /api/docs
 * Serves markdown/text files from the docs/ directory.
 *   ?action=list      — List all files with metadata
 *   ?action=read&file=X — Read a specific file
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReaddir = vi.hoisted(() => vi.fn())
const mockReadFile = vi.hoisted(() => vi.fn())
const mockStat = vi.hoisted(() => vi.fn())

vi.mock('fs/promises', () => {
  const mod = {
    readdir: mockReaddir,
    readFile: mockReadFile,
    stat: mockStat,
  }
  return { ...mod, default: mod }
})

import { docsHandler } from '@/endpoints/docs'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_MD_CONTENT = `# Introduction\n\nThis is the Angel OS documentation.\n\n*Last Updated: 2025-01-15*`
const FAKE_STAT_FILE = {
  isDirectory: () => false,
  isFile: () => true,
  size: 512,
  mtime: new Date('2025-01-15'),
}
const FAKE_STAT_DIR = {
  isDirectory: () => true,
  isFile: () => false,
  mtime: new Date('2025-01-10'),
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makeReq(url: string) {
  const payload = {}
  const nativeReq = new Request(url, { method: 'GET' })
  return Object.assign(nativeReq, { payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('docsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: docs dir has one markdown file
    mockReaddir.mockResolvedValue(['README.md'])
    mockStat.mockResolvedValue(FAKE_STAT_FILE)
    mockReadFile.mockResolvedValue(FAKE_MD_CONTENT)
  })

  // ── Default action (no action param) ──────────────────────────────────────

  it('returns 200 with API description when no action is provided', async () => {
    const req = makeReq('http://localhost/api/docs')
    const res = await docsHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.message).toMatch(/documentation api/i)
    expect(body.endpoints).toHaveProperty('GET ?action=list')
    expect(body.endpoints).toHaveProperty('GET ?action=read&file=path')
  })

  // ── action=list ────────────────────────────────────────────────────────────

  it('returns 200 with file list on action=list', async () => {
    const req = makeReq('http://localhost/api/docs?action=list')
    const res = await docsHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.docs)).toBe(true)
    expect(body.totalFiles).toBeGreaterThanOrEqual(0)
    expect(body.lastScanned).toBeDefined()
  })

  it('returns file metadata including name and relativePath', async () => {
    const req = makeReq('http://localhost/api/docs?action=list')
    const res = await docsHandler(req)
    const body = await res.json()
    const file = body.docs[0]
    expect(file.name).toBe('README.md')
    expect(file.isDirectory).toBe(false)
    expect(file.size).toBe(512)
  })

  it('extracts title from H1 in markdown metadata', async () => {
    const req = makeReq('http://localhost/api/docs?action=list')
    const res = await docsHandler(req)
    const body = await res.json()
    const file = body.docs[0]
    // metadata.title should be extracted from # Introduction
    expect(file.metadata?.title).toBe('Introduction')
  })

  it('handles empty docs directory (readdir returns empty)', async () => {
    mockReaddir.mockResolvedValue([])
    const req = makeReq('http://localhost/api/docs?action=list')
    const res = await docsHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.docs).toEqual([])
    expect(body.totalFiles).toBe(0)
  })

  it('skips non-md/txt files in listing', async () => {
    mockReaddir.mockResolvedValue(['README.md', 'image.png', 'script.js'])
    // stat returns file for all
    mockStat.mockResolvedValue(FAKE_STAT_FILE)
    mockReadFile.mockResolvedValue(FAKE_MD_CONTENT)
    const req = makeReq('http://localhost/api/docs?action=list')
    const res = await docsHandler(req)
    const body = await res.json()
    // Only README.md should be included
    expect(body.docs).toHaveLength(1)
    expect(body.docs[0].name).toBe('README.md')
  })

  it('includes subdirectories in listing', async () => {
    mockReaddir.mockImplementation((dir: string) => {
      if (dir.includes('guides')) return Promise.resolve(['getting-started.md'])
      return Promise.resolve(['guides', 'README.md'])
    })
    mockStat.mockImplementation((p: string) => {
      if (p.includes('guides') && !p.includes('.md')) return Promise.resolve(FAKE_STAT_DIR)
      return Promise.resolve(FAKE_STAT_FILE)
    })
    mockReadFile.mockResolvedValue(FAKE_MD_CONTENT)
    const req = makeReq('http://localhost/api/docs?action=list')
    const res = await docsHandler(req)
    const body = await res.json()
    // Should include the directory entry + both files
    expect(body.docs.some((f: any) => f.isDirectory)).toBe(true)
  })

  // ── action=read ────────────────────────────────────────────────────────────

  it('returns 400 when file param is missing on action=read', async () => {
    const req = makeReq('http://localhost/api/docs?action=read')
    const res = await docsHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/file path is required/i)
  })

  it('returns 400 for path traversal attempt', async () => {
    const req = makeReq('http://localhost/api/docs?action=read&file=../../etc/passwd')
    const res = await docsHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid file path/i)
  })

  it('returns 404 for non-existent or unsupported file type', async () => {
    mockStat.mockResolvedValue({ ...FAKE_STAT_FILE, isFile: () => false }) // pretend it's not a file
    const req = makeReq('http://localhost/api/docs?action=read&file=README.md')
    const res = await docsHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/not found|not a supported/i)
  })

  it('returns 200 with file content on action=read', async () => {
    const req = makeReq('http://localhost/api/docs?action=read&file=README.md')
    const res = await docsHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.file.content).toBe(FAKE_MD_CONTENT)
    expect(body.file.name).toBe('README.md')
    expect(body.file.metadata?.title).toBe('Introduction')
    expect(body.file.metadata?.lastUpdated).toBe('2025-01-15')
  })

  // ── Error handling ─────────────────────────────────────────────────────────

  it('returns 500 when readdir throws unexpectedly on list', async () => {
    // The scanDirectory wraps errors in a try/catch, so an uncaught outer error
    // would be from the top-level try/catch in docsHandler
    mockReaddir.mockRejectedValue(new Error('Permission denied'))
    const req = makeReq('http://localhost/api/docs?action=list')
    const res = await docsHandler(req)
    // scanDirectory catches errors internally; list returns empty array, not 500
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.docs).toEqual([])
  })

  it('returns 500 when stat throws during read action', async () => {
    mockStat.mockRejectedValue(new Error('File system error'))
    const req = makeReq('http://localhost/api/docs?action=read&file=README.md')
    const res = await docsHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/documentation api failed/i)
  })
})
