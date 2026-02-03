import type { Metadata } from 'next'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { generateMeta } from '@/utilities/generateMeta'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import React from 'react'

import { notFound } from 'next/navigation'
import { CollectionArchive } from '@/components/CollectionArchive'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const posts = await payload.find({
    collection: 'posts',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    where: { _status: { equals: 'published' } },
    select: { slug: true },
  })

  return (posts.docs ?? []).map(({ slug }) => ({ slug: slug! }))
}

type Args = {
  params: Promise<{ slug: string }>
}

export default async function PostPage({ params }: Args) {
  const { slug } = await params
  const post = await queryPostBySlug({ slug })

  if (!post) return notFound()

  const { hero, layout, id, relatedPosts } = post
  const related = (relatedPosts ?? []).filter(
    (p): p is import('@/payload-types').Post =>
      typeof p === 'object' && p != null && 'slug' in p,
  )

  return (
    <article className="pt-16 pb-24">
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

  const result = await payload.find({
    collection: 'posts',
    draft,
    depth: 1,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: {
      and: [
        { slug: { equals: slug } },
        ...(draft ? [] : [{ _status: { equals: 'published' } }]),
      ],
    },
  })

  return result.docs?.[0] ?? null
}
