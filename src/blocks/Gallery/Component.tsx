import React from 'react'
import { cn } from '@/utilities/cn'
import { Media } from '../../components/Media'
import type { Media as MediaDoc } from '@/payload-types'

type GalleryImage = { id?: string; image?: string | number | MediaDoc }

export const GalleryBlock: React.FC<{
  id?: string | number
  heading?: string | null
  columns?: '2' | '3' | '4' | null
  images?: GalleryImage[] | null
}> = ({ heading, columns, images }) => {
  if (!images?.length) return null
  const colClass =
    columns === '2' ? 'sm:grid-cols-2'
    : columns === '4' ? 'sm:grid-cols-2 lg:grid-cols-4'
    : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className="container">
      {heading && <h2 className="mb-6 text-2xl font-semibold tracking-tight">{heading}</h2>}
      <div className={cn('grid grid-cols-1 gap-4', colClass)}>
        {images.map((item, i) => (
          <Media
            key={item.id ?? i}
            resource={item.image}
            imgClassName="w-full h-64 object-cover rounded-lg border border-border"
          />
        ))}
      </div>
    </div>
  )
}
