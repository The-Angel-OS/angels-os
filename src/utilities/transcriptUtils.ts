/**
 * Pure TypeScript utilities for the Transcript block and RAG indexing.
 * Safe for both Next.js Client Components and Server/Hook execution.
 */

export interface TranscriptSegment {
  /** Start offset in seconds. `-1` indicates an untimed prose segment. */
  startSec: number
  endSec?: number
  text: string
  speaker?: string
}

export interface TranscriptChunk {
  chunkIndex: number
  startSec: number | null
  endSec: number | null
  content: string
  tokenEstimate: number
}

const CHARS_PER_TOKEN = 4
const DEFAULT_TARGET_CHUNK_CHARS = 1800
const DEFAULT_OVERLAP_SEGMENTS = 2

/**
 * Format seconds into `[H:]MM:SS`. Returns `''` for negative or non-finite values.
 */
export function formatTimestamp(seconds: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return ''
  }
  const total = Math.floor(seconds)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const mm = String(mins).padStart(2, '0')
  const ss = String(secs).padStart(2, '0')
  return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * Parse `MM:SS` or `H:MM:SS` (with optional `[]` or `()` wrappers) into total seconds.
 * Returns `null` if invalid.
 */
export function parseTimestampToSeconds(label: string): number | null {
  if (typeof label !== 'string') return null
  const cleaned = label.trim().replace(/^[\[(]+|[\])]+$/g, '')
  const match = cleaned.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null

  const first = Number(match[1])
  const second = Number(match[2])
  const third = match[3] !== undefined ? Number(match[3]) : undefined

  if (third !== undefined) {
    if (second >= 60 || third >= 60) return null
    return first * 3600 + second * 60 + third
  }

  if (second >= 60) return null
  return first * 60 + second
}

/**
 * Extract a 11-char YouTube video ID from common YouTube URL shapes.
 */
export function extractYouTubeVideoId(videoUrl: string): string | null {
  if (!videoUrl || typeof videoUrl !== 'string') return null
  const trimmed = videoUrl.trim()
  if (!trimmed) return null

  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = trimmed.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

/**
 * Build a direct outbound video link jumped to `startSec`.
 * - YouTube: `https://www.youtube.com/watch?v=<id>&t=<sec>` (or base URL if `startSec < 0`)
 * - Vimeo: `https://vimeo.com/<id>#t=<sec>s`
 * - Other HTTP(S) URLs: preserves query params and sets `?t=<sec>`
 */
export function buildTimestampUrl(
  videoUrl: string | null | undefined,
  startSec: number,
): string | null {
  if (!videoUrl || typeof videoUrl !== 'string') return null
  const trimmed = videoUrl.trim()
  if (!trimmed) return null

  const hasTime = typeof startSec === 'number' && Number.isFinite(startSec) && startSec >= 0
  const sec = hasTime ? Math.floor(startSec) : -1

  const ytId = extractYouTubeVideoId(trimmed)
  if (ytId) {
    return hasTime
      ? `https://www.youtube.com/watch?v=${ytId}&t=${sec}`
      : `https://www.youtube.com/watch?v=${ytId}`
  }

  const vimeoMatch = trimmed.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/)
  if (vimeoMatch?.[1]) {
    return hasTime
      ? `https://vimeo.com/${vimeoMatch[1]}#t=${sec}s`
      : `https://vimeo.com/${vimeoMatch[1]}`
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    if (hasTime) {
      parsed.searchParams.set('t', String(sec))
    }
    return parsed.toString()
  } catch {
    return null
  }
}

function parseFiniteNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function normalizeStructuredItem(item: unknown): TranscriptSegment | null {
  if (Array.isArray(item)) {
    const startSec = parseFiniteNumber(item[0])
    if (startSec === undefined) return null

    // Supports [startSec, text] or [startSec, endSec, text, speaker?]
    if (typeof item[1] === 'string') {
      const text = item[1].trim()
      if (!text) return null
      return { startSec, text }
    }

    const endSec = parseFiniteNumber(item[1])
    const text = typeof item[2] === 'string' ? item[2].trim() : ''
    if (!text) return null
    const speaker = typeof item[3] === 'string' && item[3].trim() ? item[3].trim() : undefined
    return {
      startSec,
      ...(endSec !== undefined ? { endSec } : {}),
      text,
      ...(speaker ? { speaker } : {}),
    }
  }

  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>
    const rawText = typeof obj.text === 'string' ? obj.text.trim() : ''
    if (!rawText) return null

    const startRaw =
      parseFiniteNumber(obj.startSec) ??
      parseFiniteNumber(obj.start) ??
      parseFiniteNumber(obj.t) ??
      -1

    const endRaw = parseFiniteNumber(obj.endSec) ?? parseFiniteNumber(obj.end)
    const speaker = typeof obj.speaker === 'string' && obj.speaker.trim() ? obj.speaker.trim() : undefined

    return {
      startSec: startRaw,
      ...(endRaw !== undefined ? { endSec: endRaw } : {}),
      text: rawText,
      ...(speaker ? { speaker } : {}),
    }
  }

  return null
}

const TIMESTAMP_LINE_RE =
  /^\s*(?:\[(\d{1,3}:\d{2}(?::\d{2})?)\]|\((\d{1,3}:\d{2}(?::\d{2})?)\)|(\d{1,3}:\d{2}(?::\d{2})?))\s*(?:[-–—:]\s*)?(.*)$/

/**
 * Normalize transcript data from structured `segments` (objects or compact tuples)
 * OR fall back to parsing `fullText` (timestamped `[MM:SS]` lines or plain paragraphs).
 */
export function normalizeTranscriptSegments(
  segments: unknown,
  fullText?: string | null,
): TranscriptSegment[] {
  let candidateArray: unknown = segments
  if (typeof candidateArray === 'string' && candidateArray.trim().startsWith('[')) {
    try {
      candidateArray = JSON.parse(candidateArray)
    } catch {
      candidateArray = null
    }
  }

  if (Array.isArray(candidateArray)) {
    const normalized = candidateArray
      .map(normalizeStructuredItem)
      .filter((s): s is TranscriptSegment => s !== null)
    if (normalized.length > 0) {
      return normalized
    }
  }

  if (typeof fullText !== 'string' || !fullText.trim()) {
    return []
  }

  const lines = fullText.replace(/\r\n/g, '\n').split('\n')
  const parsedTimed: TranscriptSegment[] = []
  let sawTimestamp = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const match = line.match(TIMESTAMP_LINE_RE)
    const tsLabel = match?.[1] || match?.[2] || match?.[3]
    const sec = tsLabel ? parseTimestampToSeconds(tsLabel) : null

    if (sec !== null && match) {
      sawTimestamp = true
      const body = (match[4] || '').trim()
      if (body) {
        parsedTimed.push({ startSec: sec, text: body })
      }
    } else if (sawTimestamp && parsedTimed.length > 0) {
      const prev = parsedTimed[parsedTimed.length - 1]
      prev.text = `${prev.text} ${line}`.trim()
    } else {
      parsedTimed.push({ startSec: -1, text: line })
    }
  }

  if (sawTimestamp && parsedTimed.length > 0) {
    return parsedTimed
  }

  // Plain prose: split on blank lines first; if a single block has multiple lines, split lines.
  const paragraphs = fullText
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)

  if (paragraphs.length > 1) {
    return paragraphs.map((text) => ({ startSec: -1, text }))
  }

  const singleLines = lines.map((l) => l.trim()).filter(Boolean)
  return singleLines.map((text) => ({ startSec: -1, text }))
}

/**
 * Count total words across normalized segments or `fullText`.
 */
export function countTranscriptWords(
  segments: TranscriptSegment[],
  fullText?: string | null,
): number {
  const source =
    segments.length > 0
      ? segments.map((s) => s.text).join(' ')
      : typeof fullText === 'string'
        ? fullText
        : ''
  const trimmed = source.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

/**
 * Derive a display duration label (`MM:SS` or `H:MM:SS`) from timed segments.
 */
export function deriveDurationLabel(segments: TranscriptSegment[]): string | null {
  let maxSec = 0
  for (const seg of segments) {
    const candidate =
      typeof seg.endSec === 'number' && Number.isFinite(seg.endSec) && seg.endSec >= 0
        ? seg.endSec
        : seg.startSec
    if (Number.isFinite(candidate) && candidate > maxSec) {
      maxSec = candidate
    }
  }
  return maxSec > 0 ? formatTimestamp(maxSec) : null
}

function splitLongText(text: string, maxChars: number, overlapChars: number): string[] {
  const clean = text.trim()
  if (!clean) return []
  if (clean.length <= maxChars) return [clean]

  const parts: string[] = []
  let start = 0

  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length)

    if (end < clean.length) {
      const windowStart = Math.max(start + Math.floor(maxChars * 0.5), end - 240)
      const window = clean.slice(windowStart, end)
      const lastSentence = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('? '),
        window.lastIndexOf('! '),
        window.lastIndexOf('\n'),
      )
      if (lastSentence > 0) {
        end = windowStart + lastSentence + 1
      } else {
        const lastSpace = window.lastIndexOf(' ')
        if (lastSpace > 0) {
          end = windowStart + lastSpace
        }
      }
    }

    const slice = clean.slice(start, end).trim()
    if (slice) parts.push(slice)
    if (end >= clean.length) break

    const nextStart = end - overlapChars
    start = nextStart > start ? nextStart : end
  }

  return parts
}

/**
 * Group transcript segments into overlapping RAG-ready chunks (~450 tokens each),
 * preserving exact `startSec` and `endSec` timestamp boundaries per chunk.
 */
export function chunkTranscriptSegments(
  segments: TranscriptSegment[],
  fullText?: string | null,
  opts?: { targetChars?: number; overlapSegments?: number },
): TranscriptChunk[] {
  const sourceSegments =
    segments.length > 0 ? segments : normalizeTranscriptSegments([], fullText)
  if (sourceSegments.length === 0) return []

  const targetChars = Math.max(200, opts?.targetChars ?? DEFAULT_TARGET_CHUNK_CHARS)
  const overlapSegments = Math.max(0, opts?.overlapSegments ?? DEFAULT_OVERLAP_SEGMENTS)
  const textOverlapChars = Math.min(300, Math.floor(targetChars / 4))

  // Expand any oversized single segment (e.g. massive untimed paragraph) before windowing
  const expanded: TranscriptSegment[] = []
  for (const seg of sourceSegments) {
    const text = seg.speaker ? `${seg.speaker}: ${seg.text}` : seg.text
    if (text.length <= targetChars) {
      expanded.push({ ...seg, text })
    } else {
      const subParts = splitLongText(text, targetChars, textOverlapChars)
      for (const part of subParts) {
        expanded.push({
          startSec: seg.startSec,
          ...(seg.endSec !== undefined ? { endSec: seg.endSec } : {}),
          text: part,
        })
      }
    }
  }

  const chunks: TranscriptChunk[] = []
  let idx = 0
  let chunkIndex = 0

  while (idx < expanded.length) {
    let charLen = 0
    let endIdx = idx

    while (endIdx < expanded.length) {
      const nextText = expanded[endIdx].text
      const addition = (endIdx > idx ? 1 : 0) + nextText.length
      if (endIdx > idx && charLen + addition > targetChars) {
        break
      }
      charLen += addition
      endIdx++
    }

    const window = expanded.slice(idx, endIdx)
    const content = window.map((s) => s.text).join('\n').trim()

    if (content) {
      let chunkStart: number | null = null
      let chunkEnd: number | null = null

      for (const s of window) {
        if (Number.isFinite(s.startSec) && s.startSec >= 0) {
          if (chunkStart === null) chunkStart = Math.floor(s.startSec)
          const candEnd =
            typeof s.endSec === 'number' && Number.isFinite(s.endSec) && s.endSec >= 0
              ? s.endSec
              : s.startSec
          chunkEnd = Math.floor(candEnd)
        }
      }

      chunks.push({
        chunkIndex,
        startSec: chunkStart,
        endSec: chunkEnd,
        content,
        tokenEstimate: Math.ceil(content.length / CHARS_PER_TOKEN),
      })
      chunkIndex++
    }

    if (endIdx >= expanded.length) break

    const step = Math.max(1, endIdx - idx - overlapSegments)
    idx += step
  }

  return chunks
}
