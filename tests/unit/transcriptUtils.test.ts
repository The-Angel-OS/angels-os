import { describe, it, expect } from 'vitest'
import {
  buildTimestampUrl,
  chunkTranscriptSegments,
  countTranscriptWords,
  deriveDurationLabel,
  formatTimestamp,
  normalizeTranscriptSegments,
  parseTimestampToSeconds,
} from '@/utilities/transcriptUtils'

describe('formatTimestamp & parseTimestampToSeconds', () => {
  it('formats MM:SS below 1 hour and H:MM:SS at or above 1 hour', () => {
    expect(formatTimestamp(0)).toBe('00:00')
    expect(formatTimestamp(65)).toBe('01:05')
    expect(formatTimestamp(2538)).toBe('42:18')
    expect(formatTimestamp(3600)).toBe('1:00:00')
    expect(formatTimestamp(3735.9)).toBe('1:02:15')
  })

  it('returns empty string for negative or non-finite values', () => {
    expect(formatTimestamp(-1)).toBe('')
    expect(formatTimestamp(Number.NaN)).toBe('')
    expect(formatTimestamp(Number.POSITIVE_INFINITY)).toBe('')
  })

  it('parses MM:SS and H:MM:SS with optional wrappers', () => {
    expect(parseTimestampToSeconds('04:12')).toBe(252)
    expect(parseTimestampToSeconds('[04:12]')).toBe(252)
    expect(parseTimestampToSeconds('(1:02:15)')).toBe(3735)
    expect(parseTimestampToSeconds('00:00')).toBe(0)
    expect(parseTimestampToSeconds('12:75')).toBeNull()
    expect(parseTimestampToSeconds('invalid')).toBeNull()
  })
})

describe('buildTimestampUrl', () => {
  it('supports all common YouTube URL shapes', () => {
    expect(buildTimestampUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 252)).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=252',
    )
    expect(buildTimestampUrl('https://youtu.be/dQw4w9WgXcQ?si=abc', 95.8)).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=95',
    )
    expect(buildTimestampUrl('https://www.youtube.com/embed/dQw4w9WgXcQ', 12)).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12',
    )
    expect(buildTimestampUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ', 5)).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5',
    )
    expect(buildTimestampUrl('https://youtu.be/dQw4w9WgXcQ', -1)).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    )
  })

  it('supports Vimeo and generic HTTP(S) URLs cleanly', () => {
    expect(buildTimestampUrl('https://vimeo.com/123456789', 140)).toBe(
      'https://vimeo.com/123456789#t=140s',
    )
    expect(buildTimestampUrl('https://archive.example.org/video?id=7', 88)).toBe(
      'https://archive.example.org/video?id=7&t=88',
    )
    expect(buildTimestampUrl('', 10)).toBeNull()
    expect(buildTimestampUrl('not-a-url', 10)).toBeNull()
  })
})

describe('normalizeTranscriptSegments', () => {
  it('normalizes structured object arrays and compact tuples', () => {
    const objs = normalizeTranscriptSegments([
      { start: 10, end: 25, text: 'Brick masonry anomaly in St. Louis.', speaker: 'Host' },
      { t: 30, text: 'Look at the 1893 census numbers.' },
    ])
    expect(objs).toEqual([
      { startSec: 10, endSec: 25, text: 'Brick masonry anomaly in St. Louis.', speaker: 'Host' },
      { startSec: 30, text: 'Look at the 1893 census numbers.' },
    ])

    const tuples = normalizeTranscriptSegments([
      [0, 12, 'Introductory remarks'],
      [12, 'Second segment without end'],
    ])
    expect(tuples).toEqual([
      { startSec: 0, endSec: 12, text: 'Introductory remarks' },
      { startSec: 12, text: 'Second segment without end' },
    ])
  })

  it('parses timestamped lines from fullText and attaches continuation lines', () => {
    const fullText = `[00:00] Welcome back to My Lunch Break.
Continuation on the first topic.
(01:15) Notice the star fort foundations.
02:30 - Compare with the 1870 census.`
    const segs = normalizeTranscriptSegments(null, fullText)
    expect(segs).toEqual([
      { startSec: 0, text: 'Welcome back to My Lunch Break. Continuation on the first topic.' },
      { startSec: 75, text: 'Notice the star fort foundations.' },
      { startSec: 150, text: 'Compare with the 1870 census.' },
    ])
  })

  it('splits plain untimed prose into untimed segments (startSec: -1)', () => {
    const segs = normalizeTranscriptSegments(null, 'First paragraph here.\n\nSecond paragraph here.')
    expect(segs).toEqual([
      { startSec: -1, text: 'First paragraph here.' },
      { startSec: -1, text: 'Second paragraph here.' },
    ])
  })
})

describe('countTranscriptWords & deriveDurationLabel', () => {
  it('computes word count and max duration label', () => {
    const segs = [
      { startSec: 0, endSec: 35, text: 'One two three' },
      { startSec: 35, endSec: 2538, text: 'Four five' },
    ]
    expect(countTranscriptWords(segs)).toBe(5)
    expect(deriveDurationLabel(segs)).toBe('42:18')
    expect(deriveDurationLabel([{ startSec: -1, text: 'Untimed' }])).toBeNull()
  })
})

describe('chunkTranscriptSegments', () => {
  it('groups segments with overlap and preserves exact startSec/endSec boundaries', () => {
    const segs = Array.from({ length: 10 }, (_, i) => ({
      startSec: i * 30,
      endSec: (i + 1) * 30,
      text: `Segment ${i} discussing pre-1850 limestone architecture and census comparisons. `.repeat(2),
    }))

    const chunks = chunkTranscriptSegments(segs, null, { targetChars: 350, overlapSegments: 1 })
    expect(chunks.length).toBeGreaterThan(2)

    // First chunk starts at 0 and preserves exact start/end
    expect(chunks[0].chunkIndex).toBe(0)
    expect(chunks[0].startSec).toBe(0)
    expect(chunks[0].endSec).toBeGreaterThan(0)
    expect(chunks[0].tokenEstimate).toBeGreaterThan(0)

    // Subsequent chunk overlaps by 1 segment cleanly
    expect(chunks[1].startSec).toBeLessThan(chunks[0].endSec!)
  })

  it('handles oversized untimed prose by splitting at boundaries with null timestamps', () => {
    const longProse = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} in the regression transcript.`).join(' ')
    const chunks = chunkTranscriptSegments([{ startSec: -1, text: longProse }], null, {
      targetChars: 300,
    })
    expect(chunks.length).toBeGreaterThan(2)
    for (const c of chunks) {
      expect(c.startSec).toBeNull()
      expect(c.endSec).toBeNull()
      expect(c.content.length).toBeLessThanOrEqual(320)
    }
  })
})
