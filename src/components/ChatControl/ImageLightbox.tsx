'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { XIcon, DownloadIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'

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
 * Full-screen image lightbox with carousel navigation.
 * Built on existing Dialog (Radix) + Carousel (Embla) components.
 */
export function ImageLightbox({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
}: ImageLightboxProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(initialIndex)

  // Sync carousel to initialIndex when lightbox opens.
  //
  // The Radix Dialog zooms/scales in on open (~200ms). Embla measures slide
  // widths on init — if it measures DURING that scale animation, every full-width
  // slide is recorded smaller than the container, so the center-aligned snap gets a
  // nonzero offset that ACCUMULATES per slide index (the "25% off with 2 images,
  // 50% with 3, further the more images" drift; thumbnails scroll to the wrong
  // spot and the image flashes past, never centered). Re-measure with reInit() once
  // the open animation has settled, THEN jump to the initial slide.
  useEffect(() => {
    if (!api || !open) return
    const settle = window.setTimeout(() => {
      api.reInit()
      api.scrollTo(initialIndex, true)
      setCurrent(initialIndex)
    }, 260)
    return () => window.clearTimeout(settle)
  }, [api, initialIndex, open])

  // Track current slide
  useEffect(() => {
    if (!api) return
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    api.on('select', onSelect)
    return () => { api.off('select', onSelect) }
  }, [api])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        api?.scrollPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        api?.scrollNext()
      }
    },
    [api],
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

  if (images.length === 0) return null

  const showNav = images.length > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[95vw] max-h-[95vh] w-full h-full border-0 bg-black/95 p-0 sm:max-w-[95vw] overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Accessible title (visually hidden) */}
        <DialogTitle className="sr-only">
          Image {current + 1} of {images.length}
        </DialogTitle>

        {/* Top bar — counter + actions */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
          <span className="text-white/80 text-sm font-medium">
            {showNav ? `${current + 1} / ${images.length}` : ''}
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

        {/* Image carousel */}
        <div className="flex h-full w-full items-center justify-center">
          <Carousel
            setApi={setApi}
            opts={{
              startIndex: initialIndex,
              loop: showNav,
              align: 'center',
            }}
            className="w-full h-full"
          >
            <CarouselContent className="h-full ml-0">
              {images.map((img, i) => (
                <CarouselItem
                  key={`${img.url}-${i}`}
                  className="flex items-center justify-center h-[95vh] pl-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt || `Image ${i + 1}`}
                    className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain rounded-lg select-none"
                    draggable={false}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>

            {/* Navigation arrows (only for multiple images) */}
            {showNav && (
              <>
                <button
                  onClick={() => api?.scrollPrev()}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/40 p-3 text-white/80 hover:bg-black/60 hover:text-white transition-colors backdrop-blur-sm"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  onClick={() => api?.scrollNext()}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/40 p-3 text-white/80 hover:bg-black/60 hover:text-white transition-colors backdrop-blur-sm"
                  aria-label="Next image"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </Carousel>
        </div>

        {/* Thumbnail strip (3+ images) */}
        {images.length > 2 && (
          <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-t from-black/60 to-transparent">
            {images.map((img, i) => (
              <button
                key={`thumb-${i}`}
                onClick={() => api?.scrollTo(i)}
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
