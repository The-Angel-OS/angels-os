/**
 * MediaMeta Collection — Progressive Image & Document Metadata
 *
 * Every media upload can be analyzed by Leo (or an automated pipeline) to
 * extract structured metadata: vision descriptions, OCR text, detected
 * objects, page-level data for PDFs, and eventually vector embeddings for
 * RAG retrieval.
 *
 * Architecture:
 *   1. Media is uploaded via the Media collection (image, PDF, etc.)
 *   2. An afterChange hook on Messages queues analysis for each attachment.
 *   3. Leo's `analyze_image` tool (or the `/api/media-ops/analyze` endpoint)
 *      processes the media with Anthropic Vision and writes results here.
 *   4. For PDFs, `extract_pdf_pages` splits the document into page images,
 *      creating one MediaMeta per page (linked by documentGroup).
 *   5. Completed MediaMeta records are chunked for RAG retrieval.
 *   6. Leo's `query_knowledge` tool searches these records to answer
 *      questions about uploaded content.
 *
 * Per-Enterprise service: each tenant's MediaMeta is scoped by the
 * multi-tenant plugin — every Enterprise builds its own knowledge base.
 *
 * Constitutional Reference: Article IV — AI Bus Protocol (visibility),
 *                           Article I — Transparency (all analysis observable)
 *
 * @see src/utilities/leo-data-tools.ts — analyze_image, extract_pdf_pages, query_knowledge
 * @see src/utilities/mediaAnalysis.ts — Vision analysis + RAG chunking engine
 */

import type { CollectionConfig } from 'payload'
import { ragIndexHook } from './hooks/ragIndexHook'

export const MediaMeta: CollectionConfig = {
  slug: 'media-meta',
  admin: {
    group: 'Content',
    useAsTitle: 'summary',
    defaultColumns: ['media', 'status', 'extractionType', 'documentGroup', 'pageNumber', 'createdAt'],
    listSearchableFields: ['summary', 'ocrText', 'documentGroup', 'processedBy'],
    description: 'Progressive metadata extracted from uploaded media — vision analysis, OCR, document pages, RAG chunks.',
  },
  access: {
    // Authenticated users can create (system/Leo creates during analysis)
    create: ({ req: { user } }) => Boolean(user),
    // Read: scoped by tenant via multi-tenant plugin
    read: ({ req: { user } }) => {
      if (!user) return false
      return true // Multi-tenant plugin handles tenant scoping
    },
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => {
      if (!user) return false
      // Only admins can delete analysis records
      const roles = (user as any).roles || []
      return roles.includes('super_admin') || roles.includes('admin')
    },
  },
  fields: [
    // ─── Source Reference ───────────────────────────────────────────
    {
      name: 'media',
      type: 'relationship',
      relationTo: 'media',
      required: true,
      index: true,
      admin: { description: 'The media item being analyzed' },
    },
    {
      name: 'sourceMessage',
      type: 'relationship',
      relationTo: 'messages',
      admin: { description: 'The chat message that contained this media (if applicable)' },
    },

    // ─── Processing Status ──────────────────────────────────────────
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      required: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Complete', value: 'complete' },
        { label: 'Error', value: 'error' },
      ],
      admin: { description: 'Current processing status of this analysis' },
    },
    {
      name: 'extractionType',
      type: 'select',
      required: true,
      options: [
        { label: 'Image Vision', value: 'image_vision' },
        { label: 'PDF Page', value: 'pdf_page' },
        { label: 'OCR', value: 'ocr' },
        { label: 'Manual', value: 'manual' },
      ],
      admin: { description: 'How metadata was extracted' },
    },

    // ─── Vision Analysis ────────────────────────────────────────────
    {
      name: 'visionAnalysis',
      type: 'json',
      admin: {
        description:
          'AI-extracted visual analysis — description, detected objects, colors, composition, text visible in image, scene understanding. Schema: { description, objects[], colors[], sceneType, textContent, confidence }',
      },
    },

    // ─── OCR / Transcription ────────────────────────────────────────
    {
      name: 'ocrText',
      type: 'textarea',
      admin: {
        description: 'Extracted text from OCR or transcription (full text of page/image)',
      },
    },

    // ─── Document Grouping (multi-page PDFs, photo sets) ────────────
    {
      name: 'documentGroup',
      type: 'text',
      index: true,
      admin: {
        description:
          'Group ID linking pages of the same document (e.g., PDF split into pages, journal photo set). Format: "doc_{mediaId}_{timestamp}"',
      },
    },
    {
      name: 'pageNumber',
      type: 'number',
      admin: { description: 'Page position within a document group (1-based)' },
    },
    {
      name: 'totalPages',
      type: 'number',
      admin: { description: 'Total pages in the document group' },
    },

    // ─── Extracted Entities & Classification ────────────────────────
    {
      name: 'tags',
      type: 'json',
      admin: {
        description: 'Auto-extracted tags (string array). E.g., ["invoice", "receipt", "2024", "office supplies"]',
      },
    },
    {
      name: 'entities',
      type: 'json',
      admin: {
        description:
          'Named entities extracted from the content. Schema: { people: string[], places: string[], organizations: string[], dates: string[], amounts: string[] }',
      },
    },
    {
      name: 'summary',
      type: 'text',
      admin: {
        description: 'AI-generated one-line summary of the content (used as admin title)',
      },
    },

    // ─── RAG / Vector Search ────────────────────────────────────────
    {
      name: 'ragIndexed',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Whether this record has been chunked and indexed for RAG retrieval' },
    },
    {
      name: 'ragChunks',
      type: 'json',
      admin: {
        description:
          'Pre-split text chunks for RAG retrieval. Array of { text, chunkIndex, tokenEstimate }. Generated from ocrText + visionAnalysis + summary.',
      },
    },
    {
      name: 'embedding',
      type: 'json',
      admin: {
        description:
          'Vector embedding of the combined text content. Float32 array. Will migrate to pgvector column when RAG scales.',
      },
    },

    // ─── Processing Metadata ────────────────────────────────────────
    {
      name: 'processedAt',
      type: 'date',
      admin: { description: 'When processing completed' },
    },
    {
      name: 'processedBy',
      type: 'text',
      admin: {
        description: 'Model or service that performed the analysis (e.g., "claude-sonnet-4-6", "tesseract-5")',
      },
    },
    {
      name: 'processingError',
      type: 'text',
      admin: {
        description: 'Error message if processing failed',
        condition: (_data, siblingData) => siblingData?.status === 'error',
      },
    },
    {
      name: 'processingDurationMs',
      type: 'number',
      admin: { description: 'How long processing took in milliseconds' },
    },

    // Note: 'tenant' field is auto-added by the multi-tenant plugin.
    // Do not define it here to avoid duplicate field errors.
  ],
  hooks: {
    afterChange: [ragIndexHook],
  },
  timestamps: true,
}
