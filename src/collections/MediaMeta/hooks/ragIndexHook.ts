/**
 * RAG Index Hook — afterChange on MediaMeta
 *
 * When a MediaMeta record transitions to 'complete' status, this hook:
 *   1. Combines all extractable text (OCR, vision description, summary, entities)
 *   2. Splits into overlapping chunks suitable for retrieval
 *   3. Stores chunks in the ragChunks field
 *   4. Marks ragIndexed: true
 *
 * Chunking strategy:
 *   - Target chunk size: ~500 tokens (~2000 chars)
 *   - Overlap: 100 tokens (~400 chars) between chunks
 *   - Each chunk includes document context (page number, document group, summary prefix)
 *   - Short documents (<500 tokens) become a single chunk
 *
 * Future: generate vector embeddings and store in pgvector column.
 *
 * @see src/utilities/mediaAnalysis.ts — chunkTextForRAG helper
 */

import type { CollectionAfterChangeHook } from 'payload'

/** Rough estimate: ~4 chars per token */
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

/**
 * Split text into overlapping chunks for RAG retrieval.
 */
function chunkTextForRAG(
  fullText: string,
  contextPrefix: string = '',
): RAGChunk[] {
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

    // Advance with overlap
    start = end - OVERLAP_CHARS
    if (start >= totalChars) break
    // Prevent infinite loop
    if (end >= totalChars) break
  }

  return chunks
}

/**
 * Build the full searchable text from a MediaMeta document.
 */
function buildSearchableText(doc: Record<string, unknown>): string {
  const parts: string[] = []

  // Summary (most important — first)
  if (doc.summary && typeof doc.summary === 'string') {
    parts.push(doc.summary)
  }

  // Vision analysis description
  const vision = doc.visionAnalysis as Record<string, unknown> | undefined
  if (vision) {
    if (vision.description && typeof vision.description === 'string') {
      parts.push(vision.description)
    }
    if (vision.textContent && typeof vision.textContent === 'string') {
      parts.push(`Visible text: ${vision.textContent}`)
    }
    if (Array.isArray(vision.objects) && vision.objects.length > 0) {
      parts.push(`Objects: ${vision.objects.join(', ')}`)
    }
  }

  // OCR text (can be very long)
  if (doc.ocrText && typeof doc.ocrText === 'string') {
    parts.push(doc.ocrText)
  }

  // Entities
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

  // Tags
  const tags = doc.tags as string[] | undefined
  if (Array.isArray(tags) && tags.length > 0) {
    parts.push(`Tags: ${tags.join(', ')}`)
  }

  return parts.join('\n\n')
}

/**
 * Build a context prefix for RAG chunks (page/document context).
 */
function buildContextPrefix(doc: Record<string, unknown>): string {
  const parts: string[] = []

  if (doc.documentGroup) {
    parts.push(`Document: ${doc.documentGroup}`)
  }
  if (typeof doc.pageNumber === 'number') {
    const totalStr = typeof doc.totalPages === 'number' ? `/${doc.totalPages}` : ''
    parts.push(`Page ${doc.pageNumber}${totalStr}`)
  }

  return parts.join(' | ')
}

/**
 * RAG Index Hook — runs after MediaMeta changes.
 *
 * Only processes when status transitions to 'complete' and
 * the record isn't already RAG-indexed.
 */
export const ragIndexHook: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  // Only index when transitioning TO 'complete'
  const wasComplete = previousDoc?.status === 'complete'
  const isComplete = doc.status === 'complete'
  const isAlreadyIndexed = doc.ragIndexed === true

  if (!isComplete || (wasComplete && isAlreadyIndexed)) {
    return doc
  }

  try {
    const searchableText = buildSearchableText(doc as Record<string, unknown>)

    if (searchableText.trim().length === 0) {
      // Nothing to index
      return doc
    }

    const contextPrefix = buildContextPrefix(doc as Record<string, unknown>)
    const chunks = chunkTextForRAG(searchableText, contextPrefix)

    if (chunks.length === 0) return doc

    // Update the document with RAG chunks
    await req.payload.update({
      collection: 'media-meta',
      id: doc.id,
      data: {
        ragChunks: chunks,
        ragIndexed: true,
      } as any,
      overrideAccess: true,
      // Don't re-trigger this hook
      context: { skipRagIndex: true },
    })

  } catch (err) {
    // Non-fatal — don't block the save
    console.warn('[RAG Index] Failed to index:', err)
  }

  return doc
}
