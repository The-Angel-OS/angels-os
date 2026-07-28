import React from 'react'
import Link from 'next/link'

import { Media } from '@/components/Media'

type MediaDoc = { url?: string | null; alt?: string | null }

export type ShowcaseProps = {
  heading?: string | null
  statement?: string | null
  background?: 'brand' | 'aurora' | 'dark' | 'none' | null
  items?:
    | { image?: MediaDoc | number | string | null; caption?: string | null; url?: string | null; id?: string | null }[]
    | null
}

/**
 * The gradient is CSS, not an image.
 *
 * `brand` builds the whole band out of `--tenant-primary` using colour-mix, so a
 * portal gets a gradient in its own colour without anyone picking hex values or
 * exporting a background. `aurora` is Kessela's own blue→magenta ramp, kept as an
 * explicit choice rather than the default — the default has to make a NEW portal
 * look like itself.
 */
const BACKGROUNDS: Record<string, string> = {
  brand:
    'linear-gradient(135deg, color-mix(in oklab, var(--tenant-primary, #F0524A) 55%, #1d4ed8) 0%, var(--tenant-primary, #F0524A) 55%, color-mix(in oklab, var(--tenant-primary, #F0524A) 70%, #7c1d6f) 100%)',
  aurora: 'linear-gradient(120deg, #1d3fd8 0%, #7b2ff7 38%, #d1218a 70%, #f0524a 100%)',
  dark: 'linear-gradient(135deg, #0b0d11 0%, #171a21 100%)',
  none: '',
}

/** The mark that makes the page look like theirs. Same path as the hero. */
const Squiggle = () => (
  <svg className="mb-2 h-3 w-16 opacity-90" viewBox="0 0 112 16" fill="none" aria-hidden="true">
    <path
      d="M2 12 L16 4 L30 12 L44 4 L58 12 L72 4 L86 12 L100 4 L110 10"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const ShowcaseBlock: React.FC<ShowcaseProps> = ({
  heading,
  statement,
  background,
  items,
}) => {
  const list = (items || []).filter((i) => i?.image)
  if (!list.length && !statement) return null

  const bg = BACKGROUNDS[background || 'brand'] ?? BACKGROUNDS.brand
  const onColour = (background || 'brand') !== 'none'

  return (
    <section
      // Full-bleed: the band is the point, and a container-width gradient reads
      // as a mistake rather than a design.
      className={onColour ? 'relative w-full py-16' : 'relative w-full py-12'}
      style={bg ? { backgroundImage: bg } : undefined}
    >
      <div className="container">
        {heading && (
          <h2
            className={`mb-10 text-center text-2xl font-bold ${onColour ? 'text-white' : ''}`}
          >
            {heading}
          </h2>
        )}

        {list.length > 0 && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((item, i) => {
              const img = typeof item.image === 'object' ? (item.image as MediaDoc) : null
              const card = (
                <div className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-black/20 shadow-xl">
                  {img && (
                    <Media
                      fill
                      imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
                      resource={item.image as never}
                      size="(max-width: 640px) 100vw, 33vw"
                    />
                  )}
                  {/* Bottom scrim — a caption over a photograph is unreadable
                      without one, and a solid bar would hide the photograph. */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-16 text-white">
                    <Squiggle />
                    <span className="block text-lg font-semibold leading-tight">
                      {item.caption}
                    </span>
                  </div>
                </div>
              )

              return (
                <li key={item.id || i}>
                  {item.url ? (
                    <Link href={item.url} className="block">
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {statement && (
          <div className="mx-auto mt-14 max-w-3xl text-center">
            <div className={`mx-auto mb-5 flex justify-center ${onColour ? 'text-white' : 'text-primary'}`}>
              <Squiggle />
            </div>
            <p
              className={`text-xl leading-relaxed sm:text-2xl ${onColour ? 'text-white' : 'text-foreground'}`}
            >
              {statement}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
