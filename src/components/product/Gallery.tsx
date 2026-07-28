'use client'

import type { Media as MediaType, Product } from '@/payload-types'

import { Media } from '@/components/Media'
import { GridTileImage } from '@/components/Grid/tile'
import { useSearchParams } from 'next/navigation'
import React, { useEffect } from 'react'

import { Carousel, CarouselApi, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { DefaultDocumentIDType } from 'payload'

type Props = {
  gallery: NonNullable<Product['gallery']>
}

export const Gallery: React.FC<Props> = ({ gallery }) => {
  const searchParams = useSearchParams()
  const [current, setCurrent] = React.useState(0)
  const [api, setApi] = React.useState<CarouselApi>()

  useEffect(() => {
    if (!api) {
      return
    }
  }, [api])

  useEffect(() => {
    const values = Array.from(searchParams.values())

    if (values && api) {
      const index = gallery.findIndex((item) => {
        if (!item.variantOption) return false

        let variantID: DefaultDocumentIDType

        if (item.variantOption && typeof item.variantOption === 'object') {
          variantID = item.variantOption.id
        } else variantID = item.variantOption

        return Boolean(values.find((value) => value === String(variantID)))
      })
      if (index !== -1) {
        setCurrent(index)
        api.scrollTo(index, true)
      }
    }
  }, [searchParams, api, gallery])

  // The map below already guards `typeof item.image !== 'object'` — the author
  // knew an image can come back as a bare ID. The main image did NOT, so an
  // unpopulated relation crashed the whole page during hydration: the server
  // HTML painted, then React threw and the error boundary replaced it. That is
  // exactly the "renders briefly, then breaks" report.
  const active = gallery[current] ?? gallery[0]
  const activeImage = active && typeof active.image === 'object' ? active.image : null

  return (
    <div className="flex h-full flex-col">
      {/* A fixed FRAME, not a fixed image: the image is centered and contained
          inside whatever height the column has, so portrait and landscape both
          fit without resizing the frame. min-h on small screens because a
          stacked column has no height to inherit. */}
      <div className="relative mb-6 flex min-h-[18rem] w-full flex-1 items-center justify-center overflow-hidden lg:min-h-0">
        {activeImage && (
          <Media
            resource={activeImage}
            className="flex h-full w-full items-center justify-center"
            imgClassName="max-h-full w-auto max-w-full rounded-lg object-contain"
          />
        )}
      </div>

      <Carousel setApi={setApi} className="w-full" opts={{ align: 'start', loop: false }}>
        <CarouselContent>
          {gallery.map((item, i) => {
            // `typeof null === 'object'` — a null image passed this guard and
            // `item.image.id` below threw. Yesterday's fix, one line over.
            if (!item.image || typeof item.image !== 'object') return null

            return (
              <CarouselItem
                className="basis-1/5"
                key={`${item.image.id}-${i}`}
                onClick={() => setCurrent(i)}
              >
                <GridTileImage active={i === current} media={item.image} />
              </CarouselItem>
            )
          })}
        </CarouselContent>
      </Carousel>
    </div>
  )
}
