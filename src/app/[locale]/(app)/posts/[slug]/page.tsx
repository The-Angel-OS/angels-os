import type { Metadata } from 'next'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { generateMeta } from '@/utilities/generateMeta'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode, headers } from 'next/headers'
import React from 'react'

import { notFound } from 'next/navigation'
import { CollectionArchive } from '@/components/CollectionArchive'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  try {
    const posts = await payload.find({
      collection: 'posts',
      draft: false,
      limit: 1000,
      overrideAccess: true, // Build-time has no user context — override for static generation
      pagination: false,
      where: { _status: { equals: 'published' } },
      select: { slug: true, tenant: true },
    })

    return (posts.docs ?? []).map(({ slug }) => ({ slug: slug! }))
  } catch (err) {
    console.error('[Posts] generateStaticParams failed:', err)
    return []
  }
}

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

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant from middleware-injected header (matches posts/page.tsx pattern)
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  let tenantId: number | undefined

  if (tenantSlug) {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = tenants.docs?.[0]?.id
  }

  // Fallback to default tenant
  if (!tenantId) {
    const defaults = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'default' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = defaults.docs?.[0]?.id
  }

  const result = await payload.find({
    collection: 'posts',
    draft,
    depth: 1,
    limit: 1,
    overrideAccess: true, // Public posts must be readable without auth — multi-tenant access control blocks otherwise
    pagination: false,
    where: {
      and: [
        { slug: { equals: slug } },
        ...(draft ? [] : [{ _status: { equals: 'published' } }]),
        ...(tenantId != null ? [{ tenant: { equals: tenantId } }] : []),
      ],
    },
  })

  return result.docs?.[0] ?? null
}
