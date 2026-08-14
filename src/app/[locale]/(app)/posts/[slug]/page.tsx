import type { Metadata } from 'next'
import type { Post } from '@/payload-types'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { generateMeta } from '@/utilities/generateMeta'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode, headers } from 'next/headers'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { canViewPage } from '@/utilities/pageAccess'
import { MembersOnlyGate } from '@/components/MembersOnlyGate'
import React from 'react'

import { notFound } from 'next/navigation'
import { CollectionArchive } from '@/components/CollectionArchive'
import { VideoEmbed } from '@/components/VideoEmbed'
import { computeEmbedUrl } from '@/utilities/computeEmbedUrl'

// NOTE: generateStaticParams removed — this page uses headers() + draftMode()
// which makes it dynamic. SSG conflicts with dynamic functions and causes 500s.

type Args = {
  params: Promise<{ slug: string }>
}

export default async function PostPage({ params }: Args) {
  const { slug } = await params
  const post = await queryPostBySlug({ slug })

  if (!post) return notFound()

  // Membership gate. Deliberately AFTER the lookup, so a gated post gives a join
  // prompt rather than a 404 — a locked door you can see is what converts; a
  // missing page just looks broken.
  const access = (post as { access?: string }).access
  if (access && access !== 'public') {
    const { tenantId } = await resolveTenantFromHeaders()
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: await headers() })
    if (!(await canViewPage(payload, access, user, tenantId))) {
      return (
        <MembersOnlyGate access={access} isAuthenticated={Boolean(user)} path={`/posts/${slug}`} />
      )
    }
  }

  const { hero, layout, id, relatedPosts, title, publishedOn, categories, sourceUrl, sourceType } = post
  // Frame an embedded video (YouTube/Vimeo) between the hero and the body when the
  // post carries one — e.g. a travel vlogger's post: first photo = hero, their video
  // framed here, their photos in the gallery block below.
  const video =
    sourceUrl && (sourceType === 'youtube' || sourceType === 'vimeo')
      ? computeEmbedUrl(sourceUrl)
      : null
  // relatedPosts arrive at the post's depth (1), so each related post's own image
  // relations (meta.image / hero.media — one level deeper) come back as raw IDs,
  // and the cards render "No image". Re-fetch the related posts at depth 2 so
  // their thumbnails resolve. (Deepens only these few cards, not the main layout.)
  const related = await loadRelatedPosts(relatedPosts)

  const cats = (categories ?? [])
    .map((c) => (typeof c === 'object' && c != null ? c.title : null))
    .filter(Boolean)

  return (
    <article className="pt-16 pb-24">
      {/* Post header — always show title & date even when hero type is "none" */}
      <div className="container mb-8">
        {cats.length > 0 && (
          <div className="flex gap-2 mb-3">
            {cats.map((cat) => (
              <span key={cat} className="text-xs uppercase tracking-wider text-primary font-medium">
                {cat}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-4xl font-bold">{title}</h1>
        {publishedOn && (
          <time className="mt-2 block text-sm text-muted-foreground" dateTime={publishedOn}>
            {new Date(publishedOn).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        )}
      </div>
      <RenderHero {...hero} />
      {video?.embedUrl && (
        <div className="container my-8">
          <VideoEmbed embedUrl={video.embedUrl} provider={video.provider} title={title} />
        </div>
      )}
      <RenderBlocks blocks={layout} docContext={{ id, collection: 'posts' }} />
      {related.length > 0 && (
        <div className="container mt-16">
          <h2 className="mb-6 text-2xl font-bold">Related Posts</h2>
          <CollectionArchive posts={related} showCategories columns={3} />
        </div>
      )}
    </article>
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const post = await queryPostBySlug({ slug })
  return generateMeta({ doc: post })
}

/**
 * Load related posts with depth 2 so their meta.image / hero.media populate
 * (the parent query is depth 1, which leaves those nested relations as IDs →
 * "No image" cards). Scoped to the related IDs and preserves author order.
 */
async function loadRelatedPosts(relatedPosts: Post['relatedPosts']): Promise<Post[]> {
  const ids = (relatedPosts ?? [])
    .map((p) => (typeof p === 'object' && p != null ? p.id : p))
    .filter((v): v is number => typeof v === 'number')
  if (ids.length === 0) return []
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'posts',
      where: { id: { in: ids } },
      depth: 2,
      limit: ids.length,
      overrideAccess: true,
      pagination: false,
    })
    const byId = new Map(result.docs.map((d) => [d.id, d]))
    return ids.map((id) => byId.get(id)).filter((d): d is Post => Boolean(d))
  } catch {
    return []
  }
}

async function queryPostBySlug({ slug }: { slug: string }) {
  try {
    const { isEnabled: draft } = await draftMode()
    const { tenantFilter } = await resolveTenantFromHeaders()
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'posts',
      draft,
      depth: 1,
      limit: 1,
      overrideAccess: true, // Public posts must be readable without auth
      pagination: false,
      where: {
        and: [
          { slug: { equals: slug } },
          ...(draft ? [] : [{ _status: { equals: 'published' } }]),
          tenantFilter,
        ],
      },
    })

    return result.docs?.[0] ?? null
  } catch (err) {
    console.error('[queryPostBySlug] Query failed:', err)
    return null
  }
}
