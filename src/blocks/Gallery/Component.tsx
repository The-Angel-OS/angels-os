import React from 'react'
import type { Media as MediaDoc } from '@/payload-types'
import { GalleryClient, type GalleryClientImage } from './GalleryClient'

type GalleryImage = { id?: string; image?: string | number | MediaDoc }

/** Resolve a Gallery item's Media relationship to {url,thumbUrl,alt} for the client
 *  grid + lightbox. Unpopulated (id-only) or url-less items are dropped so the grid
 *  index maps 1:1 to the lightbox index. urls are the instance-relative media route
 *  (shared-blob safe). Prefer the `card` size for the grid thumbnail. */
function resolveImage(item: GalleryImage): GalleryClientImage | null {
  const m = item.image
  if (!m || typeof m !== 'object') return null
  const url = m.url
  if (!url) return null
  const thumbUrl = m.sizes?.card?.url || m.sizes?.thumbnail?.url || url
  return { url, thumbUrl: thumbUrl || undefined, alt: m.alt || undefined }
}

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

  const resolved = images
    .map(resolveImage)
    .filter((x): x is GalleryClientImage => x !== null)

  if (!resolved.length) return null

  return <GalleryClient heading={heading} colClass={colClass} images={resolved} />
}
