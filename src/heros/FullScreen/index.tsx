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
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
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
          {richText && <RichText className="mb-8" data={richText} enableGutter={false} />}
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
