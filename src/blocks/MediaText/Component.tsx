import React from 'react'
import { computeEmbedUrl } from '@/utilities/computeEmbedUrl'

type Props = {
  eyebrow?: string
  heading?: string
  body?: string
  videoUrl?: string
  caption?: string
  videoOnRight?: boolean
  ctaLabel?: string
  ctaUrl?: string
}

// Server component: text beside an embedded video. Matches the common WordPress
// "text + video" section. Renders nothing if there's no heading.
export function MediaTextBlock({
  eyebrow,
  heading,
  body,
  videoUrl,
  caption,
  videoOnRight = true,
  ctaLabel,
  ctaUrl,
}: Props) {
  if (!heading && !body && !videoUrl) return null

  const embed = videoUrl ? computeEmbedUrl(videoUrl) : null
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

  const Media = embed?.embedUrl ? (
    <div className="flex flex-col justify-center">
      <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          src={embed.embedUrl}
          title={heading || 'Video'}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
      {caption && <p className="mt-3 text-sm italic text-muted-foreground">{caption}</p>}
    </div>
  ) : null

  return (
    <section className="container my-12">
      <div className="grid items-center gap-10 md:grid-cols-2">
        {videoOnRight ? (
          <>
            {Text}
            {Media}
          </>
        ) : (
          <>
            {Media}
            {Text}
          </>
        )}
      </div>
    </section>
  )
}
