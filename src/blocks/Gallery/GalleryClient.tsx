'use client'

import React, { useState } from 'react'
import { cn } from '@/utilities/cn'
import { ImageLightbox } from '@/components/ChatControl/ImageLightbox'

export interface GalleryClientImage {
  /** Full-resolution URL (opened in the lightbox). */
  url: string
  /** Optional smaller variant for the grid thumbnail; falls back to `url`. */
  thumbUrl?: string
  alt?: string
}

/**
 * GalleryClient — clickable image grid + full-screen lightbox for the Gallery
 * block. The block's server Component resolves each Media doc to {url,thumbUrl,alt}
 * and hands them here; clicking a tile opens the shared ImageLightbox at that index
 * (arrow-key nav, download, thumbnail strip). The grid tiles are real <button>s so
 * the click target is the whole image and keyboard focus works.
 */
export function GalleryClient({
  heading,
  colClass,
  images,
}: {
  heading?: string | null
  colClass: string
  images: GalleryClientImage[]
}) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  if (!images.length) return null

  const openAt = (i: number) => {
    setIndex(i)
    setOpen(true)
  }

  return (
    <div className="container">
      {heading && <h2 className="mb-6 text-2xl font-semibold tracking-tight">{heading}</h2>}
      <div className={cn('grid grid-cols-1 gap-4', colClass)}>
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => openAt(i)}
            aria-label={img.alt || `Open image ${i + 1}`}
            className="group block cursor-zoom-in overflow-hidden rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.thumbUrl || img.url}
              alt={img.alt || `Image ${i + 1}`}
              loading="lazy"
              className="h-64 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      <ImageLightbox
        images={images.map((img) => ({ url: img.url, alt: img.alt }))}
        initialIndex={index}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  )
}
