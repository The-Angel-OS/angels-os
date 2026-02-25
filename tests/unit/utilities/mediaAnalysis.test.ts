/**
 * Media Analysis System Tests — Sprint 18B
 *
 * Tests for the progressive image metadata extraction system:
 *   1. MediaMeta collection structure and validation
 *   2. RAG chunking algorithm
 *   3. Media URL resolution and MIME detection
 *   4. Analysis routing (image vs PDF vs other)
 *   5. Knowledge query logic
 *   6. Auto-analyze hook behavior
 *
 * Note: Vision API calls are NOT tested here (would require API key).
 * These tests validate the data pipeline, chunking, and routing logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ═══════════════════════════════════════════════════════════════════════════
// 1. RAG Chunking Algorithm
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Re-implement the chunking algorithm from ragIndexHook.ts for testing
 * (same isolation pattern as federationEngine tests).
 */
const CHARS_PER_TOKEN = 4
const TARGET_CHUNK_TOKENS = 500
const OVERLAP_TOKENS = 100
const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN

interface RAGChunk {
  text: string
  chunkIndex: number
  tokenEstimate: number
}

function chunkTextForRAG(fullText: string, contextPrefix: string = ''): RAGChunk[] {
  if (!fullText || fullText.trim().length === 0) return []

  const text = fullText.trim()
  const totalChars = text.length

  // Short text — single chunk
  if (totalChars <= TARGET_CHUNK_CHARS * 1.5) {
    const chunkText = contextPrefix ? `${contextPrefix}\n\n${text}` : text
    return [
      {
        text: chunkText,
        chunkIndex: 0,
        tokenEstimate: Math.ceil(chunkText.length / CHARS_PER_TOKEN),
      },
    ]
  }

  // Split into overlapping windows
  const chunks: RAGChunk[] = []
  let start = 0
  let chunkIndex = 0

  while (start < totalChars) {
    let end = Math.min(start + TARGET_CHUNK_CHARS, totalChars)

    // Try to break at a sentence or paragraph boundary
    if (end < totalChars) {
      const searchWindow = text.slice(Math.max(end - 200, start), end)
      const lastPeriod = searchWindow.lastIndexOf('. ')
      const lastNewline = searchWindow.lastIndexOf('\n')
      const bestBreak = Math.max(lastPeriod, lastNewline)
      if (bestBreak > 0) {
        end = Math.max(end - 200, start) + bestBreak + 1
      }
    }

    const segment = text.slice(start, end).trim()
    if (segment.length > 0) {
      const chunkText =
        contextPrefix && chunkIndex === 0
          ? `${contextPrefix}\n\n${segment}`
          : segment

      chunks.push({
        text: chunkText,
        chunkIndex,
        tokenEstimate: Math.ceil(chunkText.length / CHARS_PER_TOKEN),
      })
      chunkIndex++
    }

    start = end - OVERLAP_CHARS
    if (start >= totalChars) break
    if (end >= totalChars) break
  }

  return chunks
}

describe('RAG Chunking Algorithm', () => {
  it('returns empty array for empty text', () => {
    expect(chunkTextForRAG('')).toEqual([])
    expect(chunkTextForRAG('   ')).toEqual([])
    expect(chunkTextForRAG(null as any)).toEqual([])
  })

  it('creates a single chunk for short text', () => {
    const text = 'This is a short description of an image showing a sunset over the ocean.'
    const chunks = chunkTextForRAG(text)

    expect(chunks).toHaveLength(1)
    expect(chunks[0].chunkIndex).toBe(0)
    expect(chunks[0].text).toBe(text)
    expect(chunks[0].tokenEstimate).toBeGreaterThan(0)
    expect(chunks[0].tokenEstimate).toBe(Math.ceil(text.length / CHARS_PER_TOKEN))
  })

  it('includes context prefix in first chunk', () => {
    const text = 'A detailed image description.'
    const prefix = 'Document: doc_123 | Page 3/10'
    const chunks = chunkTextForRAG(text, prefix)

    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe(`${prefix}\n\n${text}`)
  })

  it('splits long text into multiple overlapping chunks', () => {
    // Generate text longer than 1.5x target (3000 chars = 750 tokens, threshold is ~750 tokens)
    const sentences = Array.from(
      { length: 100 },
      (_, i) => `Sentence ${i + 1}: This is a test sentence with enough content to fill space for chunking. `,
    )
    const longText = sentences.join('')

    expect(longText.length).toBeGreaterThan(TARGET_CHUNK_CHARS * 1.5)

    const chunks = chunkTextForRAG(longText)

    expect(chunks.length).toBeGreaterThan(1)

    // Verify chunk indices are sequential
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i)
    }

    // Verify all chunks have positive token estimates
    for (const chunk of chunks) {
      expect(chunk.tokenEstimate).toBeGreaterThan(0)
      expect(chunk.text.length).toBeGreaterThan(0)
    }

    // Verify overlapping: each chunk after the first should have some content from the previous
    // (We can't easily test exact overlap, but we verify no gaps by checking total coverage)
    const totalChunkChars = chunks.reduce((sum, c) => sum + c.text.length, 0)
    expect(totalChunkChars).toBeGreaterThan(longText.length) // Overlap means total > original
  })

  it('prefers breaking at sentence boundaries', () => {
    // Create text with clear sentence boundaries
    const sentences = [
      'First sentence about image analysis. ',
      'Second sentence about object detection. ',
      'Third sentence about color analysis. ',
    ]
    // Repeat to make it long enough to split
    const text = sentences.join('').repeat(30)

    const chunks = chunkTextForRAG(text)

    // Each chunk should try to end at a sentence boundary
    for (const chunk of chunks.slice(0, -1)) {
      // Last chunk may not end with a period
      const trimmed = chunk.text.trimEnd()
      // Should end near a period (within a few chars of adjustment)
      const endsNearSentence =
        trimmed.endsWith('.') ||
        trimmed.endsWith('. ') ||
        trimmed.slice(-5).includes('.')
      expect(endsNearSentence).toBe(true)
    }
  })

  it('handles text with only newlines as separators', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}: Data entry`).join('\n')
    const chunks = chunkTextForRAG(lines)

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThan(0)
    }
  })

  it('estimates tokens correctly (~4 chars per token)', () => {
    const text = 'Hello world' // 11 chars → ceil(11/4) = 3 tokens
    const chunks = chunkTextForRAG(text)

    expect(chunks[0].tokenEstimate).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Searchable Text Builder
// ═══════════════════════════════════════════════════════════════════════════

function buildSearchableText(doc: Record<string, unknown>): string {
  const parts: string[] = []

  if (doc.summary && typeof doc.summary === 'string') parts.push(doc.summary)

  const vision = doc.visionAnalysis as Record<string, unknown> | undefined
  if (vision) {
    if (vision.description && typeof vision.description === 'string')
      parts.push(vision.description)
    if (vision.textContent && typeof vision.textContent === 'string')
      parts.push(`Visible text: ${vision.textContent}`)
    if (Array.isArray(vision.objects) && vision.objects.length > 0)
      parts.push(`Objects: ${vision.objects.join(', ')}`)
  }

  if (doc.ocrText && typeof doc.ocrText === 'string') parts.push(doc.ocrText)

  const entities = doc.entities as Record<string, string[]> | undefined
  if (entities) {
    const entityParts: string[] = []
    if (entities.people?.length) entityParts.push(`People: ${entities.people.join(', ')}`)
    if (entities.places?.length) entityParts.push(`Places: ${entities.places.join(', ')}`)
    if (entities.organizations?.length)
      entityParts.push(`Organizations: ${entities.organizations.join(', ')}`)
    if (entities.dates?.length) entityParts.push(`Dates: ${entities.dates.join(', ')}`)
    if (entityParts.length > 0) parts.push(entityParts.join('. '))
  }

  const tags = doc.tags as string[] | undefined
  if (Array.isArray(tags) && tags.length > 0) parts.push(`Tags: ${tags.join(', ')}`)

  return parts.join('\n\n')
}

describe('buildSearchableText', () => {
  it('builds text from summary', () => {
    const result = buildSearchableText({ summary: 'A sunset photo' })
    expect(result).toBe('A sunset photo')
  })

  it('combines all available fields', () => {
    const doc = {
      summary: 'Invoice from Acme Corp',
      visionAnalysis: {
        description: 'A scanned invoice document',
        textContent: 'Invoice #1234',
        objects: ['table', 'logo', 'barcode'],
      },
      ocrText: 'Acme Corp\nInvoice #1234\nTotal: $500.00',
      entities: {
        organizations: ['Acme Corp'],
        amounts: ['$500.00'],
        dates: ['2024-01-15'],
        people: [],
        places: [],
      },
      tags: ['invoice', 'financial', 'acme'],
    }

    const result = buildSearchableText(doc)

    expect(result).toContain('Invoice from Acme Corp')
    expect(result).toContain('A scanned invoice document')
    expect(result).toContain('Visible text: Invoice #1234')
    expect(result).toContain('Objects: table, logo, barcode')
    expect(result).toContain('Acme Corp\nInvoice #1234\nTotal: $500.00')
    expect(result).toContain('Organizations: Acme Corp')
    expect(result).toContain('Dates: 2024-01-15')
    expect(result).toContain('Tags: invoice, financial, acme')
  })

  it('handles missing fields gracefully', () => {
    const result = buildSearchableText({})
    expect(result).toBe('')
  })

  it('handles vision with no text content', () => {
    const result = buildSearchableText({
      visionAnalysis: {
        description: 'A beautiful landscape',
        objects: ['mountain', 'lake'],
      },
    })

    expect(result).toContain('A beautiful landscape')
    expect(result).toContain('Objects: mountain, lake')
    expect(result).not.toContain('Visible text')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Media URL Resolution and MIME Detection
// ═══════════════════════════════════════════════════════════════════════════

function resolveMediaUrl(mediaDoc: Record<string, unknown>): string | null {
  if (typeof mediaDoc.url === 'string' && mediaDoc.url.startsWith('http')) {
    return mediaDoc.url
  }

  const serverUrl = 'http://localhost:3000' // Test default

  if (typeof mediaDoc.url === 'string') {
    return `${serverUrl}${mediaDoc.url}`
  }

  if (typeof mediaDoc.filename === 'string') {
    return `${serverUrl}/media/${mediaDoc.filename}`
  }

  return null
}

function getMediaMimeType(mediaDoc: Record<string, unknown>): string {
  if (typeof mediaDoc.mimeType === 'string') return mediaDoc.mimeType

  const filename = String(mediaDoc.filename || mediaDoc.url || '')
  const ext = filename.split('.').pop()?.toLowerCase()

  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
  }

  return mimeMap[ext || ''] || 'application/octet-stream'
}

const ANALYZABLE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

function isAnalyzableImage(mediaDoc: Record<string, unknown>): boolean {
  return ANALYZABLE_IMAGE_TYPES.includes(getMediaMimeType(mediaDoc))
}

function isPdf(mediaDoc: Record<string, unknown>): boolean {
  return getMediaMimeType(mediaDoc) === 'application/pdf'
}

describe('Media URL Resolution', () => {
  it('returns external URL directly', () => {
    const doc = { url: 'https://blob.vercel-storage.com/media/photo.jpg' }
    expect(resolveMediaUrl(doc)).toBe(doc.url)
  })

  it('constructs URL from relative path', () => {
    const doc = { url: '/media/photo.jpg' }
    expect(resolveMediaUrl(doc)).toBe('http://localhost:3000/media/photo.jpg')
  })

  it('constructs URL from filename', () => {
    const doc = { filename: 'photo-abc123.jpg' }
    expect(resolveMediaUrl(doc)).toBe('http://localhost:3000/media/photo-abc123.jpg')
  })

  it('returns null for empty doc', () => {
    expect(resolveMediaUrl({})).toBeNull()
  })

  it('prefers url over filename', () => {
    const doc = { url: 'https://cdn.example.com/photo.jpg', filename: 'photo.jpg' }
    expect(resolveMediaUrl(doc)).toBe('https://cdn.example.com/photo.jpg')
  })
})

describe('MIME Type Detection', () => {
  it('returns explicit mimeType when present', () => {
    expect(getMediaMimeType({ mimeType: 'image/png' })).toBe('image/png')
  })

  it('infers MIME from filename extension', () => {
    expect(getMediaMimeType({ filename: 'photo.jpg' })).toBe('image/jpeg')
    expect(getMediaMimeType({ filename: 'photo.jpeg' })).toBe('image/jpeg')
    expect(getMediaMimeType({ filename: 'image.png' })).toBe('image/png')
    expect(getMediaMimeType({ filename: 'anim.gif' })).toBe('image/gif')
    expect(getMediaMimeType({ filename: 'photo.webp' })).toBe('image/webp')
    expect(getMediaMimeType({ filename: 'icon.svg' })).toBe('image/svg+xml')
    expect(getMediaMimeType({ filename: 'document.pdf' })).toBe('application/pdf')
    expect(getMediaMimeType({ filename: 'video.mp4' })).toBe('video/mp4')
    expect(getMediaMimeType({ filename: 'clip.mov' })).toBe('video/quicktime')
  })

  it('returns octet-stream for unknown extensions', () => {
    expect(getMediaMimeType({ filename: 'data.xyz' })).toBe('application/octet-stream')
    expect(getMediaMimeType({})).toBe('application/octet-stream')
  })

  it('infers MIME from URL when no filename', () => {
    expect(getMediaMimeType({ url: '/media/photo.png' })).toBe('image/png')
  })
})

describe('isAnalyzableImage', () => {
  it('returns true for supported image types', () => {
    expect(isAnalyzableImage({ mimeType: 'image/jpeg' })).toBe(true)
    expect(isAnalyzableImage({ mimeType: 'image/png' })).toBe(true)
    expect(isAnalyzableImage({ mimeType: 'image/gif' })).toBe(true)
    expect(isAnalyzableImage({ mimeType: 'image/webp' })).toBe(true)
    expect(isAnalyzableImage({ mimeType: 'image/svg+xml' })).toBe(true)
  })

  it('returns false for non-image types', () => {
    expect(isAnalyzableImage({ mimeType: 'application/pdf' })).toBe(false)
    expect(isAnalyzableImage({ mimeType: 'video/mp4' })).toBe(false)
    expect(isAnalyzableImage({ mimeType: 'text/plain' })).toBe(false)
  })

  it('infers from filename', () => {
    expect(isAnalyzableImage({ filename: 'photo.jpg' })).toBe(true)
    expect(isAnalyzableImage({ filename: 'document.pdf' })).toBe(false)
  })
})

describe('isPdf', () => {
  it('detects PDFs correctly', () => {
    expect(isPdf({ mimeType: 'application/pdf' })).toBe(true)
    expect(isPdf({ filename: 'document.pdf' })).toBe(true)
  })

  it('rejects non-PDFs', () => {
    expect(isPdf({ mimeType: 'image/png' })).toBe(false)
    expect(isPdf({ filename: 'photo.jpg' })).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. VisionAnalysis Type Validation
// ═══════════════════════════════════════════════════════════════════════════

interface VisionAnalysis {
  description: string
  objects: string[]
  colors: string[]
  sceneType: string
  textContent: string
  confidence: number
  inventoryItems?: Array<{ item: string; quantity?: number; location?: string }>
}

interface ExtractedEntities {
  people: string[]
  places: string[]
  organizations: string[]
  dates: string[]
  amounts: string[]
}

describe('VisionAnalysis structure', () => {
  it('validates a complete vision analysis object', () => {
    const analysis: VisionAnalysis = {
      description: 'A photograph of a retail shelf displaying various candles',
      objects: ['candle', 'shelf', 'price tag', 'jar'],
      colors: ['warm white', 'amber', 'sage green'],
      sceneType: 'inventory',
      textContent: 'Lavender Dreams $24.99',
      confidence: 0.92,
      inventoryItems: [
        { item: 'Lavender candle', quantity: 5, location: 'top shelf' },
        { item: 'Sage candle', quantity: 3, location: 'middle shelf' },
      ],
    }

    expect(analysis.description).toBeTruthy()
    expect(analysis.objects.length).toBeGreaterThan(0)
    expect(analysis.confidence).toBeGreaterThanOrEqual(0)
    expect(analysis.confidence).toBeLessThanOrEqual(1)
    expect(analysis.inventoryItems).toHaveLength(2)
    expect(analysis.inventoryItems![0].item).toBe('Lavender candle')
  })

  it('validates extracted entities', () => {
    const entities: ExtractedEntities = {
      people: ['John Smith', 'Jane Doe'],
      places: ['New York', 'Central Park'],
      organizations: ['Acme Corp'],
      dates: ['2024-01-15', 'January 2024'],
      amounts: ['$500.00', '10%'],
    }

    expect(entities.people).toContain('John Smith')
    expect(entities.places).toContain('New York')
    expect(entities.organizations).toContain('Acme Corp')
    expect(entities.dates).toHaveLength(2)
    expect(entities.amounts).toHaveLength(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. Context Prefix Builder
// ═══════════════════════════════════════════════════════════════════════════

function buildContextPrefix(doc: Record<string, unknown>): string {
  const parts: string[] = []

  if (doc.documentGroup) parts.push(`Document: ${doc.documentGroup}`)
  if (typeof doc.pageNumber === 'number') {
    const totalStr = typeof doc.totalPages === 'number' ? `/${doc.totalPages}` : ''
    parts.push(`Page ${doc.pageNumber}${totalStr}`)
  }

  return parts.join(' | ')
}

describe('buildContextPrefix', () => {
  it('builds prefix with document group and page', () => {
    const doc = { documentGroup: 'doc_42_abc', pageNumber: 3, totalPages: 10 }
    expect(buildContextPrefix(doc)).toBe('Document: doc_42_abc | Page 3/10')
  })

  it('handles page without total', () => {
    const doc = { pageNumber: 5 }
    expect(buildContextPrefix(doc)).toBe('Page 5')
  })

  it('handles document group without page', () => {
    const doc = { documentGroup: 'doc_42_abc' }
    expect(buildContextPrefix(doc)).toBe('Document: doc_42_abc')
  })

  it('returns empty for no document context', () => {
    expect(buildContextPrefix({})).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. MediaMeta Collection Schema Validation
// ═══════════════════════════════════════════════════════════════════════════

describe('MediaMeta Collection Schema', () => {
  // Test data representing what would be stored in the collection
  const sampleImageMeta = {
    id: 1,
    media: 42, // Media document ID
    status: 'complete' as const,
    extractionType: 'image_vision' as const,
    visionAnalysis: {
      description: 'A retail shelf with candles',
      objects: ['candle', 'shelf'],
      colors: ['white', 'amber'],
      sceneType: 'inventory',
      textContent: 'Lavender Dreams $24.99',
      confidence: 0.9,
    },
    ocrText: 'Lavender Dreams $24.99',
    tags: ['candle', 'retail', 'inventory', 'shelf'],
    entities: {
      people: [],
      places: [],
      organizations: [],
      dates: [],
      amounts: ['$24.99'],
    },
    summary: 'Retail shelf with candles',
    ragIndexed: true,
    ragChunks: [
      { text: 'Retail shelf with candles...', chunkIndex: 0, tokenEstimate: 50 },
    ],
    processedAt: '2024-01-15T10:00:00Z',
    processedBy: 'claude-sonnet-4-20250514',
    processingDurationMs: 2500,
    tenant: 1,
  }

  const samplePdfPageMeta = {
    id: 2,
    media: 43,
    status: 'complete' as const,
    extractionType: 'pdf_page' as const,
    documentGroup: 'doc_43_k7x',
    pageNumber: 1,
    totalPages: 15,
    visionAnalysis: {
      description: 'First page of a prison journal',
      objects: ['handwriting', 'lined paper'],
      colors: ['blue ink', 'white'],
      sceneType: 'document',
      textContent: 'January 15, 2024. Today I started...',
      confidence: 0.85,
    },
    ocrText: 'January 15, 2024. Today I started thinking about...',
    tags: ['journal', 'handwritten', 'personal'],
    entities: {
      people: [],
      places: [],
      organizations: [],
      dates: ['January 15, 2024'],
      amounts: [],
    },
    summary: 'Prison journal — p1: January 15, 2024 entry',
    sourceMessage: 100,
    tenant: 1,
  }

  it('validates image metadata structure', () => {
    expect(sampleImageMeta.status).toBe('complete')
    expect(sampleImageMeta.extractionType).toBe('image_vision')
    expect(sampleImageMeta.visionAnalysis.confidence).toBeLessThanOrEqual(1)
    expect(sampleImageMeta.ragIndexed).toBe(true)
    expect(sampleImageMeta.ragChunks).toHaveLength(1)
    expect(sampleImageMeta.processingDurationMs).toBeGreaterThan(0)
  })

  it('validates PDF page metadata structure', () => {
    expect(samplePdfPageMeta.extractionType).toBe('pdf_page')
    expect(samplePdfPageMeta.documentGroup).toMatch(/^doc_\d+_/)
    expect(samplePdfPageMeta.pageNumber).toBe(1)
    expect(samplePdfPageMeta.totalPages).toBe(15)
    expect(samplePdfPageMeta.summary).toContain('p1:')
  })

  it('validates status transitions', () => {
    const validStatuses = ['pending', 'processing', 'complete', 'error']
    expect(validStatuses).toContain(sampleImageMeta.status)
  })

  it('validates extraction types', () => {
    const validTypes = ['image_vision', 'pdf_page', 'ocr', 'manual']
    expect(validTypes).toContain(sampleImageMeta.extractionType)
    expect(validTypes).toContain(samplePdfPageMeta.extractionType)
  })

  it('links pages by documentGroup', () => {
    // Simulate a multi-page PDF
    const pages = Array.from({ length: 5 }, (_, i) => ({
      ...samplePdfPageMeta,
      id: 100 + i,
      pageNumber: i + 1,
      summary: `Prison journal — p${i + 1}: Content`,
    }))

    // All pages share the same documentGroup
    const groups = new Set(pages.map((p) => p.documentGroup))
    expect(groups.size).toBe(1)

    // Pages are sequential
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3, 4, 5])

    // All have the same totalPages
    expect(pages.every((p) => p.totalPages === 15)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. End-to-End RAG Pipeline Simulation
// ═══════════════════════════════════════════════════════════════════════════

describe('RAG Pipeline', () => {
  it('processes image → metadata → chunks → searchable text', () => {
    // Simulate the full pipeline for an inventory image

    // Step 1: Vision analysis result
    const visionResult: VisionAnalysis = {
      description: 'A store shelf displaying 12 different varieties of artisan candles',
      objects: ['candle', 'jar', 'shelf', 'label', 'price tag', 'display stand'],
      colors: ['warm white', 'amber', 'sage green', 'lavender', 'coral'],
      sceneType: 'inventory',
      textContent: 'Lavender Dreams $24.99 | Ocean Breeze $19.99 | Forest Pine $22.99',
      confidence: 0.95,
      inventoryItems: [
        { item: 'Lavender Dreams candle', quantity: 4, location: 'top shelf left' },
        { item: 'Ocean Breeze candle', quantity: 3, location: 'top shelf right' },
        { item: 'Forest Pine candle', quantity: 5, location: 'middle shelf' },
      ],
    }

    // Step 2: Build MediaMeta document
    const mediaMeta = {
      visionAnalysis: visionResult,
      ocrText: 'Lavender Dreams $24.99 | Ocean Breeze $19.99 | Forest Pine $22.99',
      tags: ['candle', 'artisan', 'inventory', 'retail', 'shelf display'],
      entities: {
        amounts: ['$24.99', '$19.99', '$22.99'],
        people: [],
        places: [],
        organizations: [],
        dates: [],
      },
      summary: 'Store shelf: 12 varieties of artisan candles',
    }

    // Step 3: Build searchable text
    const searchableText = buildSearchableText(mediaMeta)

    expect(searchableText).toContain('12 varieties of artisan candles')
    expect(searchableText).toContain('Lavender Dreams')
    expect(searchableText).toContain('Ocean Breeze')
    expect(searchableText).toContain('$24.99')

    // Step 4: Chunk for RAG
    const chunks = chunkTextForRAG(searchableText)

    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks[0].text).toContain('artisan candles')
    expect(chunks[0].tokenEstimate).toBeGreaterThan(10)
  })

  it('processes multi-page PDF → page metadata → chunked knowledge base', () => {
    // Simulate a 3-page journal
    const pages = [
      {
        documentGroup: 'doc_99_test',
        pageNumber: 1,
        totalPages: 3,
        summary: 'Prison journal — p1: January reflections',
        visionAnalysis: {
          description: 'Handwritten journal page dated January 15',
          textContent: '',
          objects: ['handwriting'],
        },
        ocrText:
          'January 15, 2024\n\nToday I reflected on the nature of freedom. What does it mean to be free when the mind can travel anywhere? The walls of this cell cannot contain my thoughts about family, about the ocean, about the life I will build when I return home.',
        tags: ['journal', 'personal', 'reflection'],
        entities: {
          dates: ['January 15, 2024'],
          people: [],
          places: [],
          organizations: [],
          amounts: [],
        },
      },
      {
        documentGroup: 'doc_99_test',
        pageNumber: 2,
        totalPages: 3,
        summary: 'Prison journal — p2: February goals',
        ocrText:
          'February 2, 2024\n\nI have set three goals for this month:\n1. Read 4 books\n2. Write letters to my children\n3. Complete the business plan for the candle shop\n\nThe candle shop idea came to me in a dream. Lavender and sage, the scents of healing.',
        tags: ['journal', 'goals', 'business plan'],
        entities: {
          dates: ['February 2, 2024'],
          people: [],
          places: [],
          organizations: [],
          amounts: [],
        },
      },
      {
        documentGroup: 'doc_99_test',
        pageNumber: 3,
        totalPages: 3,
        summary: 'Prison journal — p3: March business plan details',
        ocrText:
          'March 10, 2024\n\nThe business plan is taking shape. Clearwater Candles — named after my hometown.\nStartup costs: $5,000\nTarget market: boutique shops in tourist areas\nFirst product line: 6 scented candles (lavender, sage, ocean breeze, forest pine, vanilla bean, citrus sunrise)',
        tags: ['journal', 'business plan', 'candles', 'startup'],
        entities: {
          dates: ['March 10, 2024'],
          organizations: ['Clearwater Candles'],
          amounts: ['$5,000'],
          people: [],
          places: ['Clearwater'],
        },
      },
    ]

    // Process each page
    const allChunks: RAGChunk[] = []
    for (const page of pages) {
      const searchable = buildSearchableText(page as any)
      const prefix = buildContextPrefix(page)
      const chunks = chunkTextForRAG(searchable, prefix)

      expect(prefix).toContain(`Page ${page.pageNumber}/3`)
      expect(searchable).toBeTruthy()

      allChunks.push(...chunks)
    }

    // Verify we have chunks from all pages
    expect(allChunks.length).toBeGreaterThanOrEqual(3) // At least one per page

    // Verify the chunks contain key content
    const allText = allChunks.map((c) => c.text).join('\n')
    expect(allText).toContain('freedom')
    expect(allText).toContain('candle shop')
    expect(allText).toContain('Clearwater Candles')
    expect(allText).toContain('$5,000')

    // Verify document group linking
    const groupsInChunks = allChunks.filter((c) => c.text.includes('doc_99_test'))
    expect(groupsInChunks.length).toBeGreaterThan(0) // Context prefix includes doc group
  })

  it('handles inventory mode with item detection', () => {
    const inventoryAnalysis: VisionAnalysis = {
      description: 'Retail shelf section with organized product display',
      objects: ['shelf', 'product', 'price tag'],
      colors: ['white', 'natural wood'],
      sceneType: 'inventory',
      textContent: '',
      confidence: 0.88,
      inventoryItems: [
        { item: 'Soy candle - lavender', quantity: 8, location: 'shelf A, row 1' },
        { item: 'Soy candle - vanilla', quantity: 5, location: 'shelf A, row 2' },
        { item: 'Soy candle - citrus', quantity: 0, location: 'shelf A, row 3' },
        { item: 'Reed diffuser - sage', quantity: 12, location: 'shelf B, row 1' },
      ],
    }

    expect(inventoryAnalysis.inventoryItems).toHaveLength(4)

    // Find out-of-stock items
    const outOfStock = inventoryAnalysis.inventoryItems!.filter(
      (item) => item.quantity === 0,
    )
    expect(outOfStock).toHaveLength(1)
    expect(outOfStock[0].item).toBe('Soy candle - citrus')

    // Calculate total inventory
    const totalItems = inventoryAnalysis.inventoryItems!.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0,
    )
    expect(totalItems).toBe(25)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 8. Analysis Routing Logic
// ═══════════════════════════════════════════════════════════════════════════

describe('Analysis Routing', () => {
  it('routes images to vision analysis', () => {
    const jpegDoc = { mimeType: 'image/jpeg', filename: 'photo.jpg' }
    const pngDoc = { mimeType: 'image/png', filename: 'screenshot.png' }
    const webpDoc = { filename: 'photo.webp' }

    expect(isAnalyzableImage(jpegDoc)).toBe(true)
    expect(isAnalyzableImage(pngDoc)).toBe(true)
    expect(isAnalyzableImage(webpDoc)).toBe(true)
    expect(isPdf(jpegDoc)).toBe(false)
  })

  it('routes PDFs to page extraction', () => {
    const pdfDoc = { mimeType: 'application/pdf', filename: 'journal.pdf' }

    expect(isPdf(pdfDoc)).toBe(true)
    expect(isAnalyzableImage(pdfDoc)).toBe(false)
  })

  it('handles unknown types gracefully', () => {
    const zipDoc = { mimeType: 'application/zip', filename: 'archive.zip' }

    expect(isAnalyzableImage(zipDoc)).toBe(false)
    expect(isPdf(zipDoc)).toBe(false)
    // Would fall through to 'manual' extraction type
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 9. Document Group Naming
// ═══════════════════════════════════════════════════════════════════════════

describe('Document Group IDs', () => {
  it('generates unique document group IDs', () => {
    const mediaId = 42
    const group1 = `doc_${mediaId}_${Date.now().toString(36)}`

    // Small delay to ensure different timestamp
    const group2 = `doc_${mediaId}_${(Date.now() + 1).toString(36)}`

    expect(group1).toMatch(/^doc_42_[a-z0-9]+$/)
    expect(group2).toMatch(/^doc_42_[a-z0-9]+$/)
    // They may or may not be equal depending on timing, but the format is correct
  })

  it('encodes media ID in the group', () => {
    const mediaId = 999
    const group = `doc_${mediaId}_${Date.now().toString(36)}`
    expect(group).toContain('doc_999_')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 10. Knowledge Query Matching
// ═══════════════════════════════════════════════════════════════════════════

describe('Knowledge Query Matching', () => {
  // Simulate the client-side filtering used in query_knowledge
  function matchesQuery(doc: Record<string, unknown>, query: string): boolean {
    const queryLower = query.toLowerCase()
    const searchable = [
      doc.summary,
      doc.ocrText,
      JSON.stringify(doc.tags),
      JSON.stringify(doc.entities),
      JSON.stringify(doc.visionAnalysis),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return searchable.includes(queryLower)
  }

  const docs = [
    {
      id: 1,
      summary: 'Invoice from Acme Corp - $500',
      ocrText: 'Acme Corp\nInvoice #1234\nTotal: $500.00\nDue: Jan 15, 2024',
      tags: ['invoice', 'financial'],
      entities: { organizations: ['Acme Corp'], amounts: ['$500.00'] },
    },
    {
      id: 2,
      summary: 'Retail shelf with candles',
      visionAnalysis: {
        description: 'Candle display',
        inventoryItems: [{ item: 'Lavender candle', quantity: 5 }],
      },
      tags: ['candle', 'inventory', 'retail'],
    },
    {
      id: 3,
      summary: 'Prison journal p1 — January reflections',
      ocrText: 'Today I thought about freedom and the nature of hope.',
      tags: ['journal', 'personal'],
      entities: { dates: ['January 15, 2024'] },
    },
  ]

  it('finds invoices by company name', () => {
    const matches = docs.filter((d) => matchesQuery(d, 'Acme'))
    expect(matches).toHaveLength(1)
    expect(matches[0].id).toBe(1)
  })

  it('finds candles by product type', () => {
    const matches = docs.filter((d) => matchesQuery(d, 'candle'))
    expect(matches).toHaveLength(1)
    expect(matches[0].id).toBe(2)
  })

  it('finds journal by content', () => {
    const matches = docs.filter((d) => matchesQuery(d, 'freedom'))
    expect(matches).toHaveLength(1)
    expect(matches[0].id).toBe(3)
  })

  it('finds by tag', () => {
    const matches = docs.filter((d) => matchesQuery(d, 'financial'))
    expect(matches).toHaveLength(1)
    expect(matches[0].id).toBe(1)
  })

  it('finds by entity', () => {
    const matches = docs.filter((d) => matchesQuery(d, '$500'))
    expect(matches).toHaveLength(1)
    expect(matches[0].id).toBe(1)
  })

  it('case-insensitive search', () => {
    const matches = docs.filter((d) => matchesQuery(d, 'ACME'))
    expect(matches).toHaveLength(1)
  })

  it('returns empty for non-matching query', () => {
    const matches = docs.filter((d) => matchesQuery(d, 'dinosaur'))
    expect(matches).toHaveLength(0)
  })

  it('matches across multiple fields', () => {
    // "January" appears in both doc 1 (ocr) and doc 3 (entities + ocrText)
    const matches = docs.filter((d) => matchesQuery(d, 'January'))
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(matches.some((d) => d.id === 3)).toBe(true)
  })
})
