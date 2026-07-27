'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import React, { useEffect } from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'

/**
 * Full-screen hero — the "WordPress home page" look: a full-bleed background
 * image covering the viewport with the headline + CTAs overlaid, and the rest of
 * the page's blocks flowing underneath. Modeled on HighImpact but edge-to-edge and
 * tall (no container, no rounded box, ~90vh). Reusable by any portal.
 */
export const FullScreenHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    setHeaderTheme('dark')
  })

  const mediaObj = media && typeof media === 'object' ? (media as { mimeType?: string | null; url?: string | null }) : null
  const isVideo = !!mediaObj?.mimeType?.startsWith('video/')
  // A video upload can carry its own generated thumbnail; fall back to none.
  const posterUrl =
    (mediaObj as { thumbnailURL?: string | null } | null)?.thumbnailURL ?? null

  return (
    <div
      className="relative flex min-h-[90vh] w-full select-none items-center justify-center overflow-hidden text-white"
      data-theme="dark"
    >
      {/* Full-bleed background — video autoplays muted/looped; image otherwise */}
      {mediaObj && isVideo && mediaObj.url ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={mediaObj.url}
          // Without a poster the hero is an empty void until enough of the file
          // buffers — on an 18MB clip that's a grey rectangle behind the
          // legibility overlay, which is exactly what it looked like. `metadata`
          // rather than `auto` so the page doesn't pull the whole file before
          // anything else renders.
          poster={posterUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        media && typeof media === 'object' && (
          <Media fill imgClassName="object-cover" priority resource={media} size="100vw" />
        )
      )}
      {/* Legibility overlay — keeps the headline readable over any image */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.30) 45%, rgba(0,0,0,0.65) 100%)',
        }}
      />
      {/* Overlaid content */}
      <div className="relative z-10 flex items-center justify-center px-6 py-24 md:py-32">
        <div className="max-w-3xl text-center">
          {/* A full-screen hero's job is a headline you can read from the sofa.
              The default prose sizing rendered it at body weight, which read as
              a caption floating over a video rather than a statement. First
              block large and bold, the rest as a subhead. */}
          {richText && (
            <RichText
              className="mb-8 [&_p:first-child]:text-4xl [&_p:first-child]:md:text-6xl [&_p:first-child]:font-bold [&_p:first-child]:tracking-tight [&_p:first-child]:leading-[1.05] [&_p:first-child]:mb-4 [&_p:not(:first-child)]:text-lg [&_p:not(:first-child)]:md:text-xl [&_p:not(:first-child)]:text-white/85"
              data={richText}
              enableGutter={false}
            />
          )}
          {Array.isArray(links) && links.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-4">
              {links.map(({ link }, i) => (
                <li key={i}>
                  <CMSLink {...link} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
