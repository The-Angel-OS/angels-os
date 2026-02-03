'use client'

import Link from 'next/link'
import React, { Fragment } from 'react'

import type { Post } from '@/payload-types'
import { Media } from '@/components/Media'
import { cn } from '@/utilities/cn'

export type PostCardData = Pick<Post, 'slug' | 'title' | 'categories' | 'meta' | 'publishedOn'> & {
  id?: number | string
  hero?: { media?: number | Post['hero']['media'] }
}

export const PostCard: React.FC<{
  className?: string
  post: PostCardData
  showCategories?: boolean
}> = ({ className, post, showCategories = true }) => {
  const { slug, title, categories, meta, publishedOn, hero } = post
  const metaImage = typeof meta?.image === 'object' ? meta.image : null
  const heroMedia = typeof hero?.media === 'object' ? hero.media : null
  const thumbnail = metaImage || heroMedia

  const description = typeof meta?.description === 'string' ? meta.description : undefined
  const hasCategories = categories && Array.isArray(categories) && categories.length > 0

  return (
    <article
      className={cn(
        'border border-border rounded-lg overflow-hidden bg-card hover:border-primary/50 transition-colors',
        className,
      )}
    >
      <Link href={`/posts/${slug}`} className="block">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          {thumbnail && typeof thumbnail === 'object' ? (
            <Media fill imgClassName="object-cover" resource={thumbnail} size="33vw" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No image
            </div>
          )}
        </div>
      </Link>
      <div className="p-4">
        {showCategories && hasCategories && (
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {(categories as { name?: string; title?: string }[]).map((cat, i) => (
              <Fragment key={i}>
                {typeof cat === 'object' && (cat?.title ?? cat?.name) ? (cat.title ?? cat.name) : 'Uncategorized'}
                {i < (categories?.length ?? 0) - 1 && ', '}
              </Fragment>
            ))}
          </div>
        )}
        <h3 className="text-lg font-semibold">
          <Link href={`/posts/${slug}`} className="hover:underline">
            {title}
          </Link>
        </h3>
        {publishedOn && (
          <time
            dateTime={new Date(publishedOn).toISOString()}
            className="mt-1 block text-sm text-muted-foreground"
          >
            {new Date(publishedOn).toLocaleDateString()}
          </time>
        )}
        {description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </article>
  )
}
