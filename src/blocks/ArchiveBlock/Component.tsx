import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import type { Post, Product, ArchiveBlock as ArchiveBlockProps } from '@/payload-types'

import configPromise from '@payload-config'
import { DefaultDocumentIDType, getPayload } from 'payload'
import React from 'react'
import { RichText } from '@/components/RichText'

import { CollectionArchive } from '@/components/CollectionArchive'

export const ArchiveBlock: React.FC<
  ArchiveBlockProps & {
    id?: DefaultDocumentIDType
    className?: string
  }
> = async (props) => {
  const { id, categories, columns, introContent, limit: limitFromProps, populateBy, relationTo, selectedDocs } =
    props

  const limit = limitFromProps || 3

  // Which collection this block is showing. Selection mode carries it per-doc
  // (the relationship is polymorphic), so read it off the first pick.
  const selectedRelation =
    populateBy === 'selection'
      ? (selectedDocs?.[0] as { relationTo?: string } | undefined)?.relationTo
      : undefined
  const collection: 'products' | 'posts' =
    (populateBy === 'collection' ? relationTo : selectedRelation) === 'posts' ? 'posts' : 'products'
  const basePath = collection === 'posts' ? '/posts' : '/products'

  let posts: Array<Product | Post> = []

  if (populateBy === 'collection') {
    const payload = await getPayload({ config: configPromise })

    const flattenedCategories = categories?.map((category) => {
      if (category && typeof category === 'object') return category.id
      else return category
    })

    /**
     * Scope to THIS portal's tenant, explicitly.
     *
     * This query used to carry no tenant filter at all and rely entirely on
     * access control to scope it. That holds for an anonymous visitor and fails
     * for an admin: a super_admin bypasses tenant access, so browsing a
     * customer's own site showed them OTHER tenants' posts and products mixed
     * into the archive — Clearwater Cruisin' posts appearing on a site that has
     * nothing to do with Clearwater.
     *
     * Relying on access control to enforce tenancy also means the day access
     * loosens anywhere, every archive block on every portal starts leaking. A
     * page belongs to a tenant; its archive should say so in the query.
     *
     * `resolveTenantFromHeaders` is React-cached per request, so this is free
     * even on a page with several archive blocks. @see TrustRow, same pattern.
     */
    const { tenant } = await resolveTenantFromHeaders()

    const fetched = await payload.find({
      collection,
      // Depth 2 so each card's meta.image / hero.media resolve to a document —
      // at depth 1 they come back as raw IDs and every card reads "No image".
      depth: 2,
      limit,
      where: {
        and: [
          ...(tenant?.id != null ? [{ tenant: { equals: tenant.id } }] : []),
          // A draft post has no live /posts/<slug> page, so never card one.
          ...(collection === 'posts' ? [{ _status: { equals: 'published' } }] : []),
          ...(flattenedCategories?.length ? [{ categories: { in: flattenedCategories } }] : []),
        ],
      },
    })

    posts = fetched.docs as Array<Product | Post>
  } else {
    if (selectedDocs?.length) {
      posts = selectedDocs
        .map((doc) => (doc.value && typeof doc.value === 'object' ? doc.value : null))
        .filter(Boolean) as Array<Product | Post>
    }
  }

  return (
    <div id={`block-${id}`}>
      {introContent && (
        <div className="container mb-16">
          <RichText className="ml-0 max-w-3xl" data={introContent} enableGutter={false} />
        </div>
      )}
      <CollectionArchive posts={posts as never} basePath={basePath} columns={columns === '3' ? 3 : 4} />
    </div>
  )
}
