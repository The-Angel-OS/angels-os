/**
 * Postgres RAG Indexing & Full-Text Search for Post Transcript Blocks
 *
 * Indexes published `transcript` blocks into `post_transcript_chunks` with:
 *   - Postgres `tsvector` GIN full-text index (`search_tsv`)
 *   - Optional `pgvector` HNSW `vector(768)` embeddings + JSONB `embedding_json`
 *     via Google Gemini `batchEmbedContents`
 *
 * Uses `(payload.db as any)?.pool` directly (never imports `drizzle-orm` so Next.js
 * production builds stay clean). All write hooks are strictly non-fatal.
 */
import crypto from 'node:crypto'
import type { Payload } from 'payload'
import {
  buildTimestampUrl,
  chunkTranscriptSegments,
  normalizeTranscriptSegments,
} from '@/utilities/transcriptUtils'

export interface TranscriptBlockData {
  id?: string | null
  blockType?: string
  blockName?: string | null
  heading?: string | null
  videoUrl?: string | null
  sourceLabel?: string | null
  language?: string | null
  fullText?: string | null
  segments?: unknown
}

export interface TranscriptSearchMatch {
  postId: number
  postSlug: string
  postTitle: string
  startSec: number | null
  endSec: number | null
  timestampUrl: string | null
  snippet: string
  rank: number
}

interface PreparedChunkRow {
  blockId: string | null
  chunkIndex: number
  startSec: number | null
  endSec: number | null
  videoUrl: string | null
  content: string
}

let cachedHasVectorColumn: boolean | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPgPool(payload: Payload): { query: (sql: string, params?: unknown[]) => Promise<{ rows?: any[] }> } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload?.db as any)?.pool
  return pool?.query ? pool : null
}

function resolveTenantId(tenant: unknown): number | null {
  if (typeof tenant === 'number' && Number.isFinite(tenant)) return tenant
  if (typeof tenant === 'string' && tenant.trim() !== '') {
    const n = Number(tenant)
    return Number.isFinite(n) ? n : null
  }
  if (tenant && typeof tenant === 'object' && 'id' in tenant) {
    return resolveTenantId((tenant as { id?: unknown }).id)
  }
  return null
}

/**
 * Extract all `transcript` blocks from a Post or Page `layout` array.
 */
export function extractTranscriptBlocks(layout: unknown): TranscriptBlockData[] {
  if (!Array.isArray(layout)) return []
  return layout.filter(
    (b): b is TranscriptBlockData =>
      Boolean(b && typeof b === 'object' && (b as { blockType?: unknown }).blockType === 'transcript'),
  )
}

/**
 * Compute a deterministic signature over transcript-relevant fields so metadata-only
 * edits to published posts skip redundant re-chunking and embedding calls.
 */
export function computeTranscriptSignature(doc: Record<string, unknown> | null | undefined): string {
  if (!doc || typeof doc !== 'object') return ''
  const blocks = extractTranscriptBlocks(doc.layout).map((b) => ({
    id: b.id ?? null,
    videoUrl: b.videoUrl ?? null,
    fullText: b.fullText ?? null,
    segments: b.segments ?? null,
  }))
  const payload = JSON.stringify({
    title: doc.title ?? '',
    slug: doc.slug ?? '',
    tenant: resolveTenantId(doc.tenant),
    _status: doc._status ?? '',
    sourceUrl: doc.sourceUrl ?? '',
    blocks,
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}

async function callGeminiBatchEmbed(
  model: string,
  apiKey: string,
  texts: string[],
): Promise<{ status: number; embeddings?: Array<number[] | null> }> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(6000),
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      })),
    }),
  })

  if (!res.ok) {
    return { status: res.status }
  }

  const json = (await res.json()) as {
    embeddings?: Array<{ values?: number[] }>
  }
  const vectors = texts.map((_, idx) => {
    const vals = json.embeddings?.[idx]?.values
    return Array.isArray(vals) && vals.length > 0 ? vals : null
  })
  return { status: res.status, embeddings: vectors }
}

/**
 * Generate 768-dim embeddings via Google Gemini `batchEmbedContents` (max 50 per call).
 * Returns `null` entries cleanly if API key is missing, disabled, or request fails.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
): Promise<Array<number[] | null>> {
  if (texts.length === 0) return []
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey || process.env.ENABLE_TRANSCRIPT_EMBEDDINGS === 'false') {
    return texts.map(() => null)
  }

  const primaryModel = process.env.GOOGLE_EMBEDDING_MODEL || 'gemini-embedding-001'
  const fallbackModel = 'text-embedding-004'
  const results: Array<number[] | null> = []

  const BATCH_SIZE = 50
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000))
    try {
      let attempt = await callGeminiBatchEmbed(primaryModel, apiKey, slice)
      if (attempt.status === 404 && primaryModel !== fallbackModel) {
        attempt = await callGeminiBatchEmbed(fallbackModel, apiKey, slice)
      }
      if (attempt.embeddings) {
        results.push(...attempt.embeddings)
      } else {
        results.push(...slice.map(() => null))
      }
    } catch {
      results.push(...slice.map(() => null))
    }
  }

  return results
}

async function detectHasVectorColumn(
  pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows?: unknown[] }> },
): Promise<boolean> {
  if (cachedHasVectorColumn !== null) return cachedHasVectorColumn
  try {
    const res = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'post_transcript_chunks' AND column_name = 'embedding' LIMIT 1`,
    )
    cachedHasVectorColumn = Boolean(res.rows && res.rows.length > 0)
  } catch {
    cachedHasVectorColumn = false
  }
  return cachedHasVectorColumn
}

/**
 * Index or purge transcript chunks for a Post in `post_transcript_chunks`.
 * Protects published chunks when Payload autosaves a draft version (`_status !== 'published'`).
 */
export async function indexPostTranscripts(
  payload: Payload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  previousDoc?: any,
  opts?: { force?: boolean },
): Promise<{ indexed?: number; purged?: boolean; skipped?: boolean; error?: string }> {
  if (!doc || doc.id === undefined || doc.id === null) return { skipped: true }
  const pool = getPgPool(payload)
  if (!pool) return { skipped: true }

  const postId = Number(doc.id)
  if (!Number.isFinite(postId)) return { skipped: true }

  try {
    // Draft autosave guard: never wipe live index if live row in `posts` is still published
    if (!opts?.force && doc._status !== 'published') {
      const statusRes = await pool.query(
        `SELECT _status FROM "posts" WHERE "id" = $1 LIMIT 1`,
        [postId],
      )
      const liveStatus = (statusRes.rows?.[0] as { _status?: string } | undefined)?._status
      if (liveStatus === 'published') {
        return { skipped: true }
      }
      await pool.query(`DELETE FROM "post_transcript_chunks" WHERE "post_id" = $1`, [postId])
      return { purged: true }
    }

    if (
      !opts?.force &&
      previousDoc &&
      previousDoc._status === 'published' &&
      computeTranscriptSignature(doc) === computeTranscriptSignature(previousDoc)
    ) {
      return { skipped: true }
    }

    const blocks = extractTranscriptBlocks(doc.layout)
    const fallbackVideoUrl = typeof doc.sourceUrl === 'string' ? doc.sourceUrl.trim() || null : null
    const prepared: PreparedChunkRow[] = []
    let globalChunkIndex = 0

    for (const block of blocks) {
      const normalized = normalizeTranscriptSegments(block.segments, block.fullText)
      const chunks = chunkTranscriptSegments(normalized, block.fullText)
      const blockVideoUrl =
        (typeof block.videoUrl === 'string' && block.videoUrl.trim()) || fallbackVideoUrl

      for (const ch of chunks) {
        prepared.push({
          blockId: block.id ? String(block.id) : null,
          chunkIndex: globalChunkIndex++,
          startSec: ch.startSec,
          endSec: ch.endSec,
          videoUrl: blockVideoUrl,
          content: ch.content,
        })
      }
    }

    if (prepared.length === 0) {
      await pool.query(`DELETE FROM "post_transcript_chunks" WHERE "post_id" = $1`, [postId])
      return { indexed: 0 }
    }

    const tenantId = resolveTenantId(doc.tenant)
    const postSlug = String(doc.slug || `post-${postId}`)
    const postTitle = String(doc.title || postSlug)
    const hasVectorCol = await detectHasVectorColumn(pool)

    const shouldEmbed =
      (hasVectorCol || process.env.ENABLE_TRANSCRIPT_EMBEDDINGS === 'true') &&
      process.env.ENABLE_TRANSCRIPT_EMBEDDINGS !== 'false'

    const embeddings = shouldEmbed
      ? await generateEmbeddingsBatch(prepared.map((c) => `${postTitle}\n\n${c.content}`))
      : prepared.map(() => null)

    await pool.query(`DELETE FROM "post_transcript_chunks" WHERE "post_id" = $1`, [postId])

    for (let i = 0; i < prepared.length; i++) {
      const row = prepared[i]
      const vec = embeddings[i]
      const vecJson = vec ? JSON.stringify(vec) : null

      if (hasVectorCol && vec) {
        const vectorLiteral = `[${vec.join(',')}]`
        await pool.query(
          `INSERT INTO "post_transcript_chunks"
             ("post_id", "tenant_id", "post_slug", "post_title", "block_id", "chunk_index", "start_sec", "end_sec", "video_url", "content", "embedding_json", "embedding", "updated_at")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::vector, now())`,
          [
            postId,
            tenantId,
            postSlug,
            postTitle,
            row.blockId,
            row.chunkIndex,
            row.startSec,
            row.endSec,
            row.videoUrl,
            row.content,
            vecJson,
            vectorLiteral,
          ],
        )
      } else {
        await pool.query(
          `INSERT INTO "post_transcript_chunks"
             ("post_id", "tenant_id", "post_slug", "post_title", "block_id", "chunk_index", "start_sec", "end_sec", "video_url", "content", "embedding_json", "updated_at")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())`,
          [
            postId,
            tenantId,
            postSlug,
            postTitle,
            row.blockId,
            row.chunkIndex,
            row.startSec,
            row.endSec,
            row.videoUrl,
            row.content,
            vecJson,
          ],
        )
      }
    }

    return { indexed: prepared.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[transcriptRag] indexPostTranscripts failed (non-fatal):', msg)
    return { error: msg }
  }
}

/**
 * Remove all indexed transcript chunks for a deleted Post (non-fatal).
 */
export async function deletePostTranscriptIndex(
  payload: Payload,
  postId: number | string,
): Promise<void> {
  const pool = getPgPool(payload)
  const numericId = Number(postId)
  if (!pool || !Number.isFinite(numericId)) return

  try {
    await pool.query(`DELETE FROM "post_transcript_chunks" WHERE "post_id" = $1`, [numericId])
  } catch (err) {
    console.warn(
      '[transcriptRag] deletePostTranscriptIndex failed (non-fatal):',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Search indexed transcript chunks via Postgres GIN full-text search (`websearch_to_tsquery`).
 */
export async function searchTranscriptChunks(
  payload: Payload,
  opts: { query: string; tenantId?: number | null; limit?: number },
): Promise<TranscriptSearchMatch[]> {
  const query = (opts.query || '').trim()
  if (!query) return []

  const pool = getPgPool(payload)
  if (!pool) return []

  const limit = Math.max(1, Math.min(25, Number(opts.limit) || 5))
  const tenantId = typeof opts.tenantId === 'number' && Number.isFinite(opts.tenantId) ? opts.tenantId : null

  try {
    const params: unknown[] = [query]
    let tenantSql = ''
    if (tenantId !== null) {
      params.push(tenantId)
      tenantSql = `AND c."tenant_id" = $${params.length}`
    }
    params.push(limit)

    const sql = `
      WITH q AS (SELECT websearch_to_tsquery('english', $1) AS tsq)
      SELECT
        c."post_id",
        c."post_slug",
        c."post_title",
        c."start_sec",
        c."end_sec",
        c."video_url",
        ts_rank_cd(c."search_tsv", q.tsq) AS rank,
        ts_headline(
          'english',
          c."content",
          q.tsq,
          'MaxFragments=2, MaxWords=35, MinWords=15, StartSel=**, StopSel=**'
        ) AS snippet
      FROM "post_transcript_chunks" c, q
      WHERE c."search_tsv" @@ q.tsq
        ${tenantSql}
      ORDER BY rank DESC, c."chunk_index" ASC
      LIMIT $${params.length};
    `

    const res = await pool.query(sql, params)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (res.rows || []).map((row: any) => ({
      postId: Number(row.post_id),
      postSlug: String(row.post_slug || ''),
      postTitle: String(row.post_title || ''),
      startSec: row.start_sec !== null && row.start_sec !== undefined ? Number(row.start_sec) : null,
      endSec: row.end_sec !== null && row.end_sec !== undefined ? Number(row.end_sec) : null,
      timestampUrl:
        row.video_url && row.start_sec !== null && row.start_sec !== undefined
          ? buildTimestampUrl(String(row.video_url), Number(row.start_sec))
          : row.video_url
            ? String(row.video_url)
            : null,
      snippet: String(row.snippet || ''),
      rank: Number(row.rank || 0),
    }))
  } catch (err) {
    console.warn(
      '[transcriptRag] searchTranscriptChunks failed (non-fatal):',
      err instanceof Error ? err.message : String(err),
    )
    return []
  }
}
