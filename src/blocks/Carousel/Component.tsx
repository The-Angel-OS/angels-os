import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import type { Product, CarouselBlock as CarouselBlockProps } from '@/payload-types'

import configPromise from '@payload-config'
import { DefaultDocumentIDType, getPayload } from 'payload'
import React from 'react'

import { CarouselClient } from './Component.client'

export const CarouselBlock: React.FC<
  CarouselBlockProps & {
    id?: DefaultDocumentIDType
  }
> = async (props) => {
  const { id, categories, limit = 3, populateBy, selectedDocs } = props

  let products: Product[] = []

  if (populateBy === 'collection') {
    const payload = await getPayload({ config: configPromise })

    const flattenedCategories = categories?.length
      ? categories.map((category) => {
          if (typeof category === 'object') return category.id
          else return category
        })
      : null

    // Same leak as ArchiveBlock: no tenant filter, scoped only by access control,
    // so a super_admin browsing a customer's site saw every tenant's products in
    // the carousel. Tenancy belongs in the query, not in whoever is looking.
    const { tenant } = await resolveTenantFromHeaders()

    const fetchedProducts = await payload.find({
      collection: 'products',
      depth: 1,
      limit: limit || undefined,
      where: {
        and: [
          ...(tenant?.id != null ? [{ tenant: { equals: tenant.id } }] : []),
          ...(flattenedCategories?.length ? [{ categories: { in: flattenedCategories } }] : []),
        ],
      },
    })

    products = fetchedProducts.docs
  } else if (selectedDocs?.length) {
    products = selectedDocs.map((post) => {
      if (typeof post.value !== 'string') return post.value
    }) as Product[]
  }

  if (!products?.length) return null

  return (
    <div className=" w-full pb-6 pt-1">
      <CarouselClient products={products} />
    </div>
  )
}
