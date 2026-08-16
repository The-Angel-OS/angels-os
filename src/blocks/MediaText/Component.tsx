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
  /** 'split' = text beside media; 'full' = media across the page, text beneath. */
  width?: 'split' | 'full' | null
  /** Which side the media sits on. 'alternate' flips per preceding block. */
  side?: 'right' | 'left' | 'alternate' | null
  /** Uploaded video only — an embed brings its own player. */
  playback?: 'player' | 'autoplay' | 'ambient' | null
  /**
   * How many Media + Text blocks precede this one in the layout. Supplied by
   * RenderBlocks; 'alternate' is a property of POSITION, which a block cannot
   * know about itself.
   */
  blockIndex?: number
  /** Legacy placement, read only when `side` is empty. @deprecated use `side` */
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
  width,
  side,
  playback,
  blockIndex = 0,
  videoOnRight = true,
  aspect,
  ctaLabel,
  ctaUrl,
}: Props) {
  const mediaDoc = media && typeof media === 'object' ? (media as MediaDoc) : null
  const isVideo = Boolean(mediaDoc?.mimeType?.startsWith('video/'))

  const full = width === 'full'
  // Rows written before `side` existed encode placement in videoOnRight, so it
  // is the fallback rather than a second source of truth: `side` always wins.
  const mediaRight =
    side === 'alternate' ? blockIndex % 2 === 0 : side ? side === 'right' : videoOnRight !== false

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
    // A portrait clip is capped in a column; full-width gives it more room but
    // still not the whole page, or a 9:16 becomes a two-storey skyscraper.
    (portrait ? (full ? ' mx-auto max-w-[520px]' : ' mx-auto max-w-[360px]') : '')

  // Ambient is the only mode that drops controls, and it is muted+looped so it
  // can never trap a visitor with sound they cannot turn off.
  const ambient = playback === 'ambient'
  const videoProps = ambient
    ? { autoPlay: true, loop: true, muted: true, preload: 'auto' as const }
    : playback === 'autoplay'
      ? { controls: true, autoPlay: true, muted: true, preload: 'auto' as const }
      : { controls: true, preload: 'metadata' as const }

  let MediaSide: React.ReactNode = null

  if (mediaDoc && isVideo && mediaDoc.url) {
    MediaSide = (
      <div className="flex flex-col justify-center">
        <div className={frame} style={{ aspectRatio: ratio }}>
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={mediaDoc.url}
            playsInline
            // Default is a real player: the visitor decides when it plays, and
            // preload=metadata fetches the poster and duration, not the file.
            {...videoProps}
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
            size={full ? '100vw' : '(max-width: 768px) 100vw, 50vw'}
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

  // Full width: media across the page, copy beneath it and measure-capped —
  // running text the full width of a 1400px container is unreadable, which is
  // the trap "just make it full width" usually falls into.
  if (full) {
    return (
      <section className="container">
        {MediaSide}
        {(heading || paragraphs.length > 0 || (ctaLabel && ctaUrl)) && (
          <div className="mt-8 max-w-3xl">{Text}</div>
        )}
      </section>
    )
  }

  return (
    <section className="container">
      <div className="grid items-center gap-10 md:grid-cols-2">
        {mediaRight ? (
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
