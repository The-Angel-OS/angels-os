import React from 'react'
import { computeEmbedUrl } from '@/utilities/computeEmbedUrl'
import { Media as MediaComponent } from '@/components/Media'

type MediaDoc = {
  url?: string | null
  mimeType?: string | null
  alt?: string | null
  thumbnailURL?: string | null
}

type Props = {
  eyebrow?: string
  heading?: string
  body?: string
  /** Uploaded image or video — takes precedence over videoUrl. */
  media?: MediaDoc | number | string | null
  videoUrl?: string
  caption?: string
  videoOnRight?: boolean
  /** Frame shape. Portrait exists because phone testimonials are 9:16. */
  aspect?: '16/9' | '9/16' | '1/1' | '4/3' | null
  ctaLabel?: string
  ctaUrl?: string
}

/**
 * Server component: text beside media. The WordPress "text + video" section.
 *
 * Media resolution order — upload first, external embed second. Pasting a Media
 * URL into `videoUrl` used to "work" by accident: it rendered as a bare
 * <video src> and started playing the moment the page loaded.
 *
 * Uploaded video gets a REAL PLAYER, not a background loop: controls, no
 * autoplay, poster frame. A hero autoplays because there is one of it and it is
 * the whole screen. You can stack four of these on a page — four videos playing
 * at once is a wall of motion nobody asked for, and on a phone it costs real
 * bandwidth and battery. Their own site gets this right with a "Play" button.
 */
export function MediaTextBlock({
  eyebrow,
  heading,
  body,
  media,
  videoUrl,
  caption,
  videoOnRight = true,
  aspect,
  ctaLabel,
  ctaUrl,
}: Props) {
  const mediaDoc = media && typeof media === 'object' ? (media as MediaDoc) : null
  const isVideo = Boolean(mediaDoc?.mimeType?.startsWith('video/'))

  const embed = !mediaDoc && videoUrl ? computeEmbedUrl(videoUrl) : null

  if (!heading && !body && !mediaDoc && !embed) return null

  const paragraphs = (body || '').split(/\n\n+/).map((p) => p.trim()).filter(Boolean)

  const Text = (
    <div className="flex flex-col justify-center">
      {eyebrow && (
        <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</div>
      )}
      {heading && <h2 className="mb-5 text-3xl font-bold leading-tight md:text-4xl">{heading}</h2>}
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-4 text-muted-foreground leading-relaxed">{p}</p>
      ))}
      {ctaLabel && ctaUrl && (
        <a
          href={ctaUrl}
          className="mt-2 inline-flex w-fit items-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90"
        >
          {ctaLabel}
        </a>
      )}
    </div>
  )

  // A 9:16 frame at full column width is a skyscraper — cap it so a portrait
  // clip sits at a sane height instead of pushing the copy off the screen.
  const ratio = (aspect || '16/9').replace('/', ' / ')
  const portrait = aspect === '9/16'
  const frame =
    'relative w-full overflow-hidden rounded-xl bg-black' +
    (portrait ? ' mx-auto max-w-[360px]' : '')

  let MediaSide: React.ReactNode = null

  if (mediaDoc && isVideo && mediaDoc.url) {
    MediaSide = (
      <div className="flex flex-col justify-center">
        <div className={frame} style={{ aspectRatio: ratio }}>
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={mediaDoc.url}
            // A real player: the visitor decides when it plays.
            controls
            playsInline
            // metadata, not auto — the poster and duration load, the file doesn't.
            preload="metadata"
            poster={mediaDoc.thumbnailURL ?? undefined}
          />
        </div>
        {caption && <p className="mt-3 text-sm italic text-muted-foreground">{caption}</p>}
      </div>
    )
  } else if (mediaDoc) {
    MediaSide = (
      <div className="flex flex-col justify-center">
        <div className={frame}>
          <MediaComponent
            imgClassName="w-full h-auto object-cover"
            resource={media as never}
            size="(max-width: 768px) 100vw, 50vw"
          />
        </div>
        {caption && <p className="mt-3 text-sm italic text-muted-foreground">{caption}</p>}
      </div>
    )
  } else if (embed?.embedUrl) {
    MediaSide = (
      <div className="flex flex-col justify-center">
        <div className={frame} style={{ aspectRatio: ratio }}>
          <iframe
            src={embed.embedUrl}
            title={heading || 'Video'}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>
        {caption && <p className="mt-3 text-sm italic text-muted-foreground">{caption}</p>}
      </div>
    )
  }

  return (
    <section className="container my-12">
      <div className="grid items-center gap-10 md:grid-cols-2">
        {videoOnRight ? (
          <>
            {Text}
            {MediaSide}
          </>
        ) : (
          <>
            {MediaSide}
            {Text}
          </>
        )}
      </div>
    </section>
  )
}
