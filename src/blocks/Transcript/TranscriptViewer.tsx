'use client'

import React, { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, Search, X } from 'lucide-react'
import {
  buildTimestampUrl,
  formatTimestamp,
  type TranscriptSegment,
} from '@/utilities/transcriptUtils'

export interface TranscriptViewerProps {
  heading: string
  videoUrl: string | null
  sourceLabel?: string | null
  language?: string | null
  defaultCollapsed: boolean
  enableSearch: boolean
  wordCount: number
  durationLabel: string | null
  segments: TranscriptSegment[]
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderHighlightedText(text: string, query: string): React.ReactNode {
  const trimmed = query.trim()
  if (!trimmed) return text

  const terms = Array.from(
    new Set(
      trimmed
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  )

  const patternSource = terms.length > 0 ? terms.map(escapeRegExp).join('|') : escapeRegExp(trimmed)
  if (!patternSource) return text

  const regex = new RegExp(`(${patternSource})`, 'gi')
  const parts = text.split(regex)
  if (parts.length <= 1) return text

  const matchSet = new Set(
    (terms.length > 0 ? terms : [trimmed]).map((t) => t.toLowerCase()),
  )

  return parts.map((part, idx) =>
    matchSet.has(part.toLowerCase()) ? (
      <mark
        key={idx}
        className="rounded bg-amber-300/60 px-0.5 text-foreground dark:bg-amber-500/35 dark:text-amber-100"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    ),
  )
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  heading,
  videoUrl,
  sourceLabel,
  language,
  defaultCollapsed,
  enableSearch,
  wordCount,
  durationLabel,
  segments,
}) => {
  const [expanded, setExpanded] = useState(!defaultCollapsed)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)

  const trimmedQuery = query.trim().toLowerCase()
  const queryTerms = useMemo(
    () => trimmedQuery.split(/\s+/).filter(Boolean),
    [trimmedQuery],
  )

  const filteredSegments = useMemo(() => {
    if (queryTerms.length === 0) return segments
    return segments.filter((seg) => {
      const hay = `${seg.speaker ? `${seg.speaker} ` : ''}${seg.text}`.toLowerCase()
      return queryTerms.every((term) => hay.includes(term))
    })
  }, [segments, queryTerms])

  const watchUrl = useMemo(() => buildTimestampUrl(videoUrl, -1), [videoUrl])

  const handleCopy = async () => {
    try {
      const plain = segments
        .map((seg) => {
          const ts = seg.startSec >= 0 ? `[${formatTimestamp(seg.startSec)}] ` : ''
          const speaker = seg.speaker ? `${seg.speaker}: ` : ''
          return `${ts}${speaker}${seg.text}`
        })
        .join('\n')
      await navigator.clipboard.writeText(plain)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (e.g. non-secure context)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* YouTube-style collapsible toggle bar */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="text-lg leading-none">
            📜
          </span>
          <span className="truncate font-semibold text-foreground">{heading}</span>
          <span className="hidden sm:inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {expanded ? 'Collapse' : 'Expand'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {wordCount > 0 && (
            <span className="rounded-full border border-border bg-background/70 px-2.5 py-0.5 font-mono">
              {wordCount.toLocaleString()} words
            </span>
          )}
          {durationLabel && (
            <span className="rounded-full border border-border bg-background/70 px-2.5 py-0.5 font-mono">
              {durationLabel}
            </span>
          )}
          <span className="rounded-full border border-border bg-background/70 px-2.5 py-0.5 font-mono">
            {segments.length} {segments.length === 1 ? 'segment' : 'segments'}
          </span>
          {sourceLabel && (
            <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 font-medium text-foreground/80">
              {sourceLabel}
            </span>
          )}
          {language && language !== 'en' && (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 uppercase font-mono">
              {language}
            </span>
          )}
          <span className="ml-1 inline-flex items-center text-foreground/80">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Toolbar: Search + Watch Video + Copy */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border bg-muted/30 px-4 py-2.5">
            {enableSearch ? (
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search inside transcript..."
                  aria-label="Search inside transcript"
                  className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear transcript search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {enableSearch && trimmedQuery && (
                <span className="rounded-md border border-border bg-background px-2 py-1 font-mono text-muted-foreground">
                  {filteredSegments.length} of {segments.length} segments matching
                </span>
              )}

              {watchUrl && (
                <a
                  href={watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <span>Watch Video</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 font-medium text-foreground transition-colors hover:bg-muted"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Transcript</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Scrollable transcript body */}
          <div className="max-h-[34rem] overflow-y-auto px-4 py-3 space-y-2.5">
            {filteredSegments.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  No transcript segments match &ldquo;{query.trim()}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Reset filter
                </button>
              </div>
            ) : (
              filteredSegments.map((seg, idx) => {
                const isTimed = typeof seg.startSec === 'number' && seg.startSec >= 0
                const tsLabel = isTimed ? formatTimestamp(seg.startSec) : ''
                const tsUrl = isTimed ? buildTimestampUrl(videoUrl, seg.startSec) : null

                if (!isTimed) {
                  return (
                    <p key={idx} className="text-sm leading-relaxed text-foreground/90">
                      {seg.speaker && (
                        <span className="mr-1.5 font-semibold text-foreground">{seg.speaker}:</span>
                      )}
                      {renderHighlightedText(seg.text, query)}
                    </p>
                  )
                }

                return (
                  <div
                    key={`${seg.startSec}-${idx}`}
                    className="group flex items-start gap-3 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/40"
                  >
                    {tsUrl ? (
                      <a
                        href={tsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Jump to ${tsLabel}`}
                        className="mt-0.5 shrink-0 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                      >
                        [{tsLabel}]
                      </a>
                    ) : (
                      <span className="mt-0.5 shrink-0 rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        [{tsLabel}]
                      </span>
                    )}

                    <p className="text-sm leading-relaxed text-foreground/90">
                      {seg.speaker && (
                        <span className="mr-1.5 font-semibold text-foreground">{seg.speaker}:</span>
                      )}
                      {renderHighlightedText(seg.text, query)}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
