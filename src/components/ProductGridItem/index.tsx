import type { Product, Variant } from '@/payload-types'

import Link from 'next/link'
import React from 'react'
import clsx from 'clsx'
import { Media } from '@/components/Media'
import { Price } from '@/components/Price'

type Props = {
  product: Partial<Product>
}

export const ProductGridItem: React.FC<Props> = ({ product }) => {
  const { gallery, priceInUSD, title } = product

  let price = priceInUSD

  const variants = product.variants?.docs

  if (variants && variants.length > 0) {
    const variant = variants[0]
    if (
      variant &&
      typeof variant === 'object' &&
      variant?.priceInUSD &&
      typeof variant.priceInUSD === 'number'
    ) {
      price = variant.priceInUSD
    }
  }

  // Prefer gallery image, fallback to meta image if gallery is empty
  const galleryImage =
    gallery?.[0]?.image && typeof gallery[0]?.image !== 'string' ? gallery[0]?.image : false
  const metaImage =
    product.meta?.image && typeof product.meta.image !== 'string' ? product.meta.image : false
  const image = galleryImage || metaImage

  return (
    <Link className="relative block h-full w-full group rounded-lg border border-border bg-card overflow-hidden transition-colors hover:border-primary/50" href={`/products/${product.slug}`}>
      {image ? (
        <Media
          className={clsx(
            'relative aspect-square object-cover bg-primary-foreground',
          )}
          imgClassName={clsx('h-full w-full object-cover', {
            'transition duration-300 ease-in-out group-hover:scale-102': true,
          })}
          resource={image}
          size="(max-width: 768px) 100vw, 33vw"
          fill
        />
      ) : (
        <div className="relative aspect-square flex items-center justify-center bg-muted/30">
          <svg className="h-12 w-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
        </div>
      )}

      <div className="p-4 font-mono text-primary/50 group-hover:text-primary flex justify-between items-center">
        <div>{title}</div>

        {typeof price === 'number' && (
          <div className="">
            <Price amount={price} />
          </div>
        )}
      </div>
    </Link>
  )
}
