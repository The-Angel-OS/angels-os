import type { Block } from 'payload'

/**
 * Transcript — collapsible, timestamp-linked video/session transcript block.
 *
 * Defaults to collapsed (`defaultCollapsed: true`) so long episodes and
 * regression dossiers stay readable while preserving full-text searchability
 * in the UI and Postgres RAG indexing via `post_transcript_chunks`.
 */
export const Transcript: Block = {
  slug: 'transcript',
  interfaceName: 'TranscriptBlock',
  labels: {
    singular: 'Transcript',
    plural: 'Transcripts',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      defaultValue: 'Full Video Transcript',
      admin: {
        description: 'Header label shown on the collapsible transcript toggle bar.',
      },
    },
    {
      name: 'videoUrl',
      type: 'text',
      admin: {
        description:
          'Optional primary video URL (YouTube/Vimeo). Leave blank to inherit the parent Post sourceUrl for [MM:SS] timestamp links.',
      },
    },
    {
      name: 'sourceLabel',
      type: 'text',
      admin: {
        description:
          'Optional provenance label (e.g. "YouTube Auto-Captions", "Whisper v3", "QHHT Session").',
      },
    },
    {
      name: 'language',
      type: 'text',
      defaultValue: 'en',
      admin: {
        description: 'ISO language code (e.g. en, es).',
      },
    },
    {
      name: 'defaultCollapsed',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Keep the transcript collapsed by default (YouTube-style expand bar).',
      },
    },
    {
      name: 'enableSearch',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Show a live in-transcript keyword filter input when expanded.',
      },
    },
    {
      name: 'wordCount',
      type: 'number',
      admin: {
        description: 'Optional total word count (auto-computed at render if omitted).',
      },
    },
    {
      name: 'durationLabel',
      type: 'text',
      admin: {
        description: 'Optional total duration badge (e.g. 42:18). Auto-derived from segments if blank.',
      },
    },
    {
      name: 'fullText',
      type: 'textarea',
      admin: {
        rows: 12,
        description:
          'Plain text or timestamp-prefixed lines (e.g. "[04:12] First segment..."). Used automatically if structured segments are empty.',
      },
    },
    {
      name: 'segments',
      type: 'json',
      admin: {
        description:
          'Optional structured segments: [{ startSec, endSec?, text, speaker? }] or compact tuples [[startSec, endSec, text]].',
      },
    },
  ],
}
