import React from 'react'
import { TranscriptViewer } from './TranscriptViewer'
import {
  countTranscriptWords,
  deriveDurationLabel,
  normalizeTranscriptSegments,
} from '@/utilities/transcriptUtils'

export interface TranscriptBlockProps {
  id?: string
  blockType?: 'transcript'
  blockName?: string | null
  heading?: string | null
  videoUrl?: string | null
  fallbackVideoUrl?: string | null
  sourceLabel?: string | null
  language?: string | null
  defaultCollapsed?: boolean | null
  enableSearch?: boolean | null
  wordCount?: number | null
  durationLabel?: string | null
  fullText?: string | null
  segments?: unknown
}

export const TranscriptBlockComponent: React.FC<TranscriptBlockProps> = ({
  heading,
  videoUrl,
  fallbackVideoUrl,
  sourceLabel,
  language,
  defaultCollapsed = true,
  enableSearch = true,
  wordCount,
  durationLabel,
  fullText,
  segments,
}) => {
  const normalized = normalizeTranscriptSegments(segments, fullText)
  if (normalized.length === 0) return null

  const resolvedVideoUrl =
    (typeof videoUrl === 'string' && videoUrl.trim()) ||
    (typeof fallbackVideoUrl === 'string' && fallbackVideoUrl.trim()) ||
    null

  const resolvedWordCount =
    typeof wordCount === 'number' && wordCount > 0
      ? wordCount
      : countTranscriptWords(normalized, fullText)

  const resolvedDuration =
    (typeof durationLabel === 'string' && durationLabel.trim()) ||
    deriveDurationLabel(normalized)

  return (
    <section className="container">
      <div className="mx-auto max-w-4xl">
        <TranscriptViewer
          heading={heading?.trim() || 'Full Video Transcript'}
          videoUrl={resolvedVideoUrl}
          sourceLabel={sourceLabel?.trim() || null}
          language={language?.trim() || 'en'}
          defaultCollapsed={defaultCollapsed !== false}
          enableSearch={enableSearch !== false}
          wordCount={resolvedWordCount}
          durationLabel={resolvedDuration}
          segments={normalized}
        />
      </div>
    </section>
  )
}
