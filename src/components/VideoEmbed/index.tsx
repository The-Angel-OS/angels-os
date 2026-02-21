/**
 * VideoEmbed — Responsive 16:9 video embed component
 *
 * Supports YouTube, Vimeo, Twitch, and custom URLs.
 * Provider-specific iframe attributes for optimal playback.
 */

import React from 'react'
import type { VideoProvider } from '@/utilities/computeEmbedUrl'

interface VideoEmbedProps {
  embedUrl: string
  provider?: VideoProvider
  title?: string
  className?: string
}

const PROVIDER_ALLOW: Record<VideoProvider, string> = {
  youtube:
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
  vimeo: 'autoplay; fullscreen; picture-in-picture',
  twitch: 'autoplay; fullscreen',
  custom: 'autoplay; fullscreen',
}

export function VideoEmbed({
  embedUrl,
  provider = 'custom',
  title = 'Video embed',
  className = '',
}: VideoEmbedProps) {
  if (!embedUrl) {
    return (
      <div
        className={`flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground ${className}`}
      >
        No video URL provided
      </div>
    )
  }

  return (
    <div className={`relative aspect-video overflow-hidden rounded-lg ${className}`}>
      <iframe
        src={embedUrl}
        title={title}
        allow={PROVIDER_ALLOW[provider] || PROVIDER_ALLOW.custom}
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  )
}
