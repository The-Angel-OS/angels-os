'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import React, { useEffect } from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'

export const HighImpactHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    setHeaderTheme('dark')
  })

  return (
    <div className="container">
      <div
        className="relative mb-8 flex min-h-[55vh] max-h-[75vh] select-none items-center justify-center overflow-hidden rounded-xl text-white"
        data-theme="dark"
      >
        {/* Background image (fills the hero) */}
        {media && typeof media === 'object' && (
          <Media fill imgClassName="object-cover" priority resource={media} size="100vw" />
        )}
        {/* Legibility overlay — keeps the headline readable over any image */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.20) 45%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        {/* Content */}
        <div className="relative z-10 flex items-center justify-center px-6 py-20 md:py-28">
          <div className="max-w-146 md:text-center">
            {richText && <RichText className="mb-6" data={richText} enableGutter={false} />}
            {Array.isArray(links) && links.length > 0 && (
              <ul className="flex md:justify-center gap-4">
                {links.map(({ link }, i) => {
                  return (
                    <li key={i}>
                      <CMSLink {...link} />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
