import React from 'react'

import { VideoEmbed } from '@/components/VideoEmbed'
import { computeEmbedUrl } from '@/utilities/computeEmbedUrl'

type MediaDoc = { url?: string | null; mimeType?: string | null; alt?: string | null }

export type VideoBlockProps = {
  heading?: string | null
  media?: MediaDoc | number | string | null
  videoUrl?: string | null
  poster?: MediaDoc | number | string | null
  aspect?: '16/9' | '9/16' | '1/1' | null
  caption?: string | null
}

/**
 * A video on its own in the page flow.
 *
 * ponytail: the browser's own <video> with controls. No player library, no
 * client component, no analytics shim. `preload="metadata"` so a page with three
 * clips on it does not pull down three videos before anyone presses play.
 *
 * No autoplay, deliberately. An autoplaying testimonial on a medical-device page
 * is an ambush, and on mobile data it is an expensive one.
 */
export const VideoBlockComponent: React.FC<VideoBlockProps> = ({
  heading,
  media,
  videoUrl,
  poster,
  aspect,
  caption,
}) => {
  const doc = media && typeof media === 'object' ? (media as MediaDoc) : null
  const posterDoc = poster && typeof poster === 'object' ? (poster as MediaDoc) : null
  const embed = !doc && videoUrl ? computeEmbedUrl(videoUrl) : null

  if (!doc?.url && !embed?.embedUrl) return null

  const ratio = (aspect || '16/9').replace('/', ' / ')
  // A 9:16 frame at full width is a skyscraper. Cap it so the page still reads.
  const cap = aspect === '9/16' ? 'max-w-[380px]' : aspect === '1/1' ? 'max-w-[640px]' : 'max-w-4xl'

  return (
    <section className="container my-12">
      {heading && <h2 className="mb-6 text-center text-2xl font-bold">{heading}</h2>}

      <div className={`mx-auto ${cap}`}>
        <div
          className="relative w-full overflow-hidden rounded-xl bg-black"
          style={{ aspectRatio: ratio }}
        >
          {doc?.url ? (
            <video
              className="h-full w-full object-contain"
              controls
              playsInline
              preload="metadata"
              poster={posterDoc?.url || undefined}
              src={doc.url}
            />
          ) : (
            <VideoEmbed
              embedUrl={embed!.embedUrl!}
              provider={embed!.provider}
              title={heading || 'Video'}
            />
          )}
        </div>

        {caption && (
          <p className="mt-3 text-center text-sm text-muted-foreground">{caption}</p>
        )}
      </div>
    </section>
  )
}
