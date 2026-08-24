'use client'

import React, { useState } from 'react'
import Image from 'next/image'

/**
 * The event gallery, weighted by when you are looking at it.
 *
 * `Events.gallery` has carried a `category` (venue / speaker / promo / recap /
 * sponsor) since the collection was written, and nothing ever rendered it. That
 * field is what lets one page be two things: before the event the promo and
 * venue shots are the pitch, after it the recap shots are the reason the page is
 * worth returning to. So the order flips on `isPast` rather than the page having
 * a separate "recap" mode.
 *
 * Client component only because of the lightbox. If that ever goes, so does this.
 */

type GalleryImage = {
  image?: { url?: string; alt?: string; width?: number; height?: number } | number | null
  caption?: string | null
  category?: string | null
  isFeatured?: boolean | null
}

const LABELS: Record<string, string> = {
  venue: 'The venue',
  speaker: 'Who you will hear',
  promo: 'Promo',
  recap: 'From the day',
  sponsor: 'With thanks to',
}

/** Before: sell it. After: remember it. */
const ORDER_UPCOMING = ['promo', 'speaker', 'venue', 'recap', 'sponsor']
const ORDER_PAST = ['recap', 'speaker', 'venue', 'promo', 'sponsor']

const url = (i: GalleryImage) =>
  i.image && typeof i.image === 'object' && i.image.url ? i.image.url : null

export const EventGallery: React.FC<{ images?: GalleryImage[] | null; isPast: boolean }> = ({
  images,
  isPast,
}) => {
  const [open, setOpen] = useState<number | null>(null)

  const usable = (images || []).filter((i) => url(i))
  if (usable.length === 0) return null

  const order = isPast ? ORDER_PAST : ORDER_UPCOMING
  const rank = (c?: string | null) => {
    const i = order.indexOf(c || 'recap')
    return i === -1 ? order.length : i
  }
  // Featured first within a category, categories in temporal order.
  const sorted = [...usable].sort(
    (a, b) => rank(a.category) - rank(b.category) || Number(!!b.isFeatured) - Number(!!a.isFeatured),
  )

  // One heading, taken from whatever the leading category is — not a heading per
  // category. Five headings over eleven photos reads as an admin screen.
  const heading = LABELS[sorted[0]?.category || 'recap'] || 'Gallery'

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">{heading}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sorted.map((img, i) => {
          const src = url(img)!
          return (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(i)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              <Image
                src={src}
                alt={img.caption || ''}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover transition-transform group-hover:scale-105"
              />
              {img.caption && (
                <span className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 text-left text-[11px] leading-tight text-white">
                  {img.caption}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {open !== null && url(sorted[open]) && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <div
          role="dialog"
          aria-modal="true"
          aria-label={sorted[open].caption || 'Photo'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setOpen(null)}
        >
          <div className="relative max-h-full w-full max-w-4xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url(sorted[open])!}
              alt={sorted[open].caption || ''}
              className="mx-auto max-h-[85vh] w-auto rounded-lg object-contain"
            />
            {sorted[open].caption && (
              <p className="mt-3 text-center text-sm text-white/80">{sorted[open].caption}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-white hover:bg-white/20"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  )
}
