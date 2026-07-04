'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { XIcon, DownloadIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

interface LightboxImage {
  url: string
  alt?: string
  mediaId?: number
}

interface ImageLightboxProps {
  images: LightboxImage[]
  initialIndex?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Full-screen image lightbox.
 *
 * Intentionally NOT built on Embla/Carousel. A carousel translates a flex track
 * by measured slide widths; with `align: center` any measurement taken while the
 * Radix dialog is mid-zoom (or before images load) is off by a few px and the
 * error ACCUMULATES per slide — that's the "centers on two with 2 images, three
 * with 3" drift. A lightbox only ever shows ONE image, so we just render the
 * current index. No track, no measurement, no drift — always dead-centered.
 */
export function ImageLightbox({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
}: ImageLightboxProps) {
  const [current, setCurrent] = useState(initialIndex)

  // Snap to the clicked image whenever the lightbox (re)opens or the source
  // index changes.
  useEffect(() => {
    if (open) setCurrent(initialIndex)
  }, [open, initialIndex])

  const count = images.length
  const showNav = count > 1

  const goPrev = useCallback(() => {
    setCurrent((c) => (c - 1 + count) % count)
  }, [count])

  const goNext = useCallback(() => {
    setCurrent((c) => (c + 1) % count)
  }, [count])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      }
    },
    [goPrev, goNext],
  )

  const handleDownload = useCallback(() => {
    const img = images[current]
    if (!img) return
    const a = document.createElement('a')
    a.href = img.url
    a.download = img.alt || `image-${current + 1}`
    a.target = '_blank'
    a.click()
  }, [images, current])

  if (count === 0) return null

  const active = images[current]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // The shared DialogContent is a `grid` with `gap-4` + `p-6` and a
        // top/left-50% + translate centering. Those defaults shrink/offset the
        // image cell (the "almost centered but consistently off" drift). Force a
        // plain full-viewport block with no gap/padding so the absolutely-
        // positioned image layer below fills the box and centers true.
        className="!grid-cols-1 !grid-rows-1 gap-0 max-w-[95vw] max-h-[95vh] w-full h-full border-0 bg-black/95 p-0 sm:max-w-[95vw] overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Accessible title (visually hidden) */}
        <DialogTitle className="sr-only">
          Image {current + 1} of {count}
        </DialogTitle>

        {/* Top bar — counter + actions */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
          <span className="text-white/80 text-sm font-medium">
            {showNav ? `${current + 1} / ${count}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Download"
            >
              <DownloadIcon className="size-5" />
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Close (Esc)"
            >
              <XIcon className="size-5" />
            </button>
          </div>
        </div>

        {/* Single centered image — absolute inset-0 fills the dialog box
            regardless of the inherited grid flow, so the flex centering is
            measured against the full viewport (true center). */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={active.url}
            src={active.url}
            alt={active.alt || `Image ${current + 1}`}
            className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain rounded-lg select-none"
            draggable={false}
          />
        </div>

        {/* Navigation arrows (only for multiple images) */}
        {showNav && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/40 p-3 text-white/80 hover:bg-black/60 hover:text-white transition-colors backdrop-blur-sm"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/40 p-3 text-white/80 hover:bg-black/60 hover:text-white transition-colors backdrop-blur-sm"
              aria-label="Next image"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}

        {/* Thumbnail strip (3+ images) */}
        {count > 2 && (
          <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-t from-black/60 to-transparent">
            {images.map((img, i) => (
              <button
                key={`thumb-${i}`}
                onClick={() => setCurrent(i)}
                className={`rounded-md overflow-hidden border-2 transition-all ${
                  i === current
                    ? 'border-white/90 opacity-100 scale-110'
                    : 'border-transparent opacity-50 hover:opacity-80'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt || `Thumbnail ${i + 1}`}
                  className="size-12 object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
