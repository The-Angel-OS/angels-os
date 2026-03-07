import type { Metadata } from 'next'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { generateMeta } from '@/utilities/generateMeta'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import React from 'react'

import { notFound } from 'next/navigation'
import { CollectionArchive } from '@/components/CollectionArchive'

// NOTE: generateStaticParams removed — this page uses headers() + draftMode()
// which makes it dynamic. SSG conflicts with dynamic functions and causes 500s.

type Args = {
  params: Promise<{ slug: string }>
}

export default async function PostPage({ params }: Args) {
  const { slug } = await params
  const post = await queryPostBySlug({ slug })

  if (!post) return notFound()

  const { hero, layout, id, relatedPosts, title, publishedOn, categories } = post
  const related = (relatedPosts ?? []).filter(
    (p): p is import('@/payload-types').Post =>
      typeof p === 'object' && p != null && 'slug' in p,
  )

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

async function queryPostBySlug({ slug }: { slug: string }) {
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
}
