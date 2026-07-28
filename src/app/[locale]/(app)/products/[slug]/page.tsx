import type { Media, Product } from '@/payload-types'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { GridTileImage } from '@/components/Grid/tile'
import { Gallery } from '@/components/product/Gallery'
import { ProductDescription } from '@/components/product/ProductDescription'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React, { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeftIcon } from 'lucide-react'
import { Metadata } from 'next'

type Args = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const product = await queryProductBySlug({ slug })

  if (!product) return notFound()

  const gallery =
    product.gallery?.filter((item) => item.image && typeof item.image === 'object') || []

  const metaImage = typeof product.meta?.image === 'object' ? product.meta?.image : undefined
  const canIndex = product._status === 'published'

  const seoImage = metaImage || (gallery.length ? (gallery[0]?.image as Media) : undefined)

  return {
    description: product.meta?.description || '',
    openGraph: seoImage?.url
      ? {
          images: [
            {
              alt: seoImage?.alt,
              height: seoImage.height!,
              url: seoImage?.url,
              width: seoImage.width!,
            },
          ],
        }
      : null,
    robots: {
      follow: canIndex,
      googleBot: {
        follow: canIndex,
        index: canIndex,
      },
      index: canIndex,
    },
    title: product.meta?.title || product.title,
  }
}

export default async function ProductPage({ params }: Args) {
  const { slug } = await params
  const product = await queryProductBySlug({ slug })

  if (!product) return notFound()

  // A single-product endeavor has no catalog to go back to — "All products"
  // would land the visitor on a grid of one, which reads as a dead end.
  const hasCatalog = await countPublishedProducts()

  // `typeof null === 'object'`, so the old filter passed a null image straight
  // into Gallery's thumbnail map and `item.image.id` threw during hydration.
  // The nulls come from React Flight: these Media objects are reachable from
  // both this prop and `product` (ProductDescription), so the serializer emits
  // the second copy as a back-reference into a row that no longer exists once
  // the Suspense boundary resolves. Cloning each image gives the serializer a
  // distinct object, so it writes the value instead of a pointer.
  const gallery =
    product.gallery
      ?.filter((item) => item.image && typeof item.image === 'object')
      .map((item) => ({
        ...item,
        image: { ...(item.image as Media) },
      })) || []

  const metaImage = typeof product.meta?.image === 'object' ? product.meta?.image : undefined
  const hasStock = product.enableVariants
    ? product?.variants?.docs?.some((variant) => {
        if (typeof variant !== 'object') return false
        return variant.inventory && variant?.inventory > 0
      })
    : product.inventory! > 0

  let price = product.priceInUSD

  if (product.enableVariants && product?.variants?.docs?.length) {
    price = product?.variants?.docs?.reduce((acc, variant) => {
      if (typeof variant === 'object' && variant?.priceInUSD && acc && variant?.priceInUSD > acc) {
        return variant.priceInUSD
      }
      return acc
    }, price)
  }

  const productJsonLd = {
    name: product.title,
    '@context': 'https://schema.org',
    '@type': 'Product',
    description: product.description,
    image: metaImage?.url,
    offers: {
      '@type': 'AggregateOffer',
      availability: hasStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      // schema.org wants the MAJOR unit; `price` is stored in cents. Emitting
      // it raw published "$599.00" on the page and price=59900 in the structured
      // data — so a rich result would have quoted $59,900. Currency uppercase
      // per ISO 4217, which Google requires.
      price: typeof price === 'number' ? (price / 100).toFixed(2) : price,
      priceCurrency: 'USD',
    },
  }

  const relatedProducts =
    product.relatedProducts?.filter((relatedProduct) => typeof relatedProduct === 'object') ?? []

  return (
    <React.Fragment>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd),
        }}
        type="application/ld+json"
      />
      <div className="container pt-8 pb-8">
        {hasCatalog && (
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/shop">
              <ChevronLeftIcon />
              All products
            </Link>
          </Button>
        )}
        <div className="flex flex-col gap-12 rounded-lg border p-8 md:py-12 lg:flex-row lg:gap-8 bg-primary-foreground">
          {/* The gallery column STRETCHES to the description beside it (flex rows
              stretch by default), and the gallery fills that height — so the
              page geometry is set by the copy, which doesn't change, instead of
              by whichever image is showing. Half this catalog is portrait and
              half landscape; without this the whole page grew and shrank on
              every thumbnail tap. */}
          <div className="flex w-full basis-full flex-col lg:basis-1/2">
            <Suspense
              fallback={
                <div className="relative aspect-square h-full max-h-[550px] w-full overflow-hidden" />
              }
            >
              {Boolean(gallery?.length) && <Gallery gallery={gallery} />}
            </Suspense>
          </div>

          <div className="basis-full lg:basis-1/2">
            <ProductDescription product={product} />
          </div>
        </div>
      </div>

      {product.layout?.length ? (
        <RenderBlocks blocks={product.layout} docContext={{ id: product.id, collection: 'products' }} />
      ) : (
        <></>
      )}

      {relatedProducts.length ? (
        <div className="container">
          <RelatedProducts products={relatedProducts as Product[]} />
        </div>
      ) : (
        <></>
      )}
    </React.Fragment>
  )
}

function RelatedProducts({ products }: { products: Product[] }) {
  if (!products.length) return null

  return (
    <div className="py-8">
      <h2 className="mb-4 text-2xl font-bold">Related Products</h2>
      <ul className="flex w-full gap-4 overflow-x-auto pt-1">
        {products.map((product) => (
          <li
            className="aspect-square w-full flex-none min-[475px]:w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5"
            key={product.id}
          >
            <Link className="relative h-full w-full" href={`/products/${product.slug}`}>
              <GridTileImage
                label={{
                  amount: product.priceInUSD!,
                  title: product.title,
                }}
                media={product.meta?.image as Media}
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** True when this tenant sells more than the product being viewed. */
const countPublishedProducts = async (): Promise<boolean> => {
  try {
    const { tenantFilter } = await resolveTenantFromHeaders()
    const payload = await getPayload({ config: configPromise })
    const { totalDocs } = await payload.count({
      collection: 'products',
      where: { and: [{ _status: { equals: 'published' } }, tenantFilter] },
      overrideAccess: true,
    })
    return totalDocs > 1
  } catch {
    // A count that fails shouldn't cost the visitor their way back to the shop.
    return true
  }
}

const queryProductBySlug = async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()
  const { tenantFilter } = await resolveTenantFromHeaders()
  const payload = await getPayload({ config: configPromise })

  const findProduct = (useDraft: boolean) =>
    payload.find({
      collection: 'products',
      depth: 3,
      draft: useDraft,
      limit: 1,
      overrideAccess: true, // Public products must be readable without auth
      pagination: false,
      where: {
        and: [
          { slug: { equals: slug } },
          ...(useDraft ? [] : [{ _status: { equals: 'published' } }]),
          tenantFilter,
        ],
      },
      populate: {
        variants: {
          title: true,
          priceInUSD: true,
          inventory: true,
          options: true,
        },
      },
    })

  const result = await findProduct(draft)
  if (result.docs?.[0]) return result.docs[0]

  // A published product must never 404 just because the visitor has draft mode on
  // (e.g. a lingering __prerender_bypass cookie from a past admin preview). The
  // draft query reads the versions table, which is empty for products seeded as
  // published — so fall back to the published query before giving up.
  if (draft) {
    const published = await findProduct(false)
    return published.docs?.[0] || null
  }

  return null
}
