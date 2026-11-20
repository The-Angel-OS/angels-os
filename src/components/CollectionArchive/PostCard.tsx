'use client'

import Link from 'next/link'
import React, { Fragment } from 'react'

import type { Post } from '@/payload-types'
import { Media } from '@/components/Media'
import { computeEmbedUrl } from '@/utilities/computeEmbedUrl'
import { cn } from '@/utilities/cn'

export type PostCardData = Pick<
  Post,
  'slug' | 'title' | 'categories' | 'meta' | 'publishedOn' | 'sourceUrl' | 'sourceType'
> & {
  id?: number | string
  access?: string | null
  hero?: { media?: number | Post['hero']['media'] }
}

export const PostCard: React.FC<{
  className?: string
  post: PostCardData
  showCategories?: boolean
  /** Where the card links. The Archive block renders products through this same
   *  card, and every one of them linked to /posts/<slug> — a 404. */
  basePath?: string
}> = ({ className, post, showCategories = true, basePath = '/posts' }) => {
  const { slug, title, categories, meta, publishedOn, hero, sourceUrl, sourceType, access } = post
  const metaImage = typeof meta?.image === 'object' ? meta.image : null
  const heroMedia = typeof hero?.media === 'object' ? hero.media : null
  const thumbnail = metaImage || heroMedia

  const ytEmbed =
    !thumbnail && sourceUrl && (sourceType === 'youtube' || sourceUrl.includes('youtu'))
      ? computeEmbedUrl(sourceUrl)
      : null
  const ytFallbackThumb =
    ytEmbed?.provider === 'youtube' && ytEmbed.videoId
      ? `https://i.ytimg.com/vi/${ytEmbed.videoId}/hqdefault.jpg`
      : null

  const description = typeof meta?.description === 'string' ? meta.description : undefined
  const hasCategories = categories && Array.isArray(categories) && categories.length > 0

  return (
    <article
      className={cn(
        'border border-border rounded-lg overflow-hidden bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200',
        className,
      )}
    >
      <Link href={`${basePath}/${slug}`} className="block">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          {thumbnail && typeof thumbnail === 'object' ? (
            <Media fill imgClassName="object-cover" resource={thumbnail} size="33vw" />
          ) : ytFallbackThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ytFallbackThumb}
              alt={title || 'Video thumbnail'}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No image
            </div>
          )}
          {access && access !== 'public' && (
            <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-slate-950/85 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 shadow-sm backdrop-blur-sm">
              {access === 'authenticated' ? '🔒 Sign In' : '🔒 Members Only'}
            </span>
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
          <Link href={`${basePath}/${slug}`} className="hover:underline">
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
