import React from 'react'
import Link from 'next/link'

import { RichText } from '@/components/RichText'
import { Button } from '@/components/ui/button'

import { ProductGallery } from './Gallery'

type MediaDoc = { url?: string | null; alt?: string | null }

export type ProductPanelProps = {
  heading?: string | null
  price?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any
  ctaLabel?: string | null
  ctaUrl?: string | null
  footnote?: string | null
  images?: { image?: MediaDoc | number | string | null; id?: string | null }[] | null
}

/**
 * Server component; only the gallery is client-side, because only the gallery
 * has state. The copy, price and button render on the server and are in the HTML
 * for anyone reading the page without JavaScript — which includes every crawler
 * deciding whether this page is a product.
 */
export const ProductPanelBlock: React.FC<ProductPanelProps> = ({
  heading,
  price,
  body,
  ctaLabel,
  ctaUrl,
  footnote,
  images,
}) => {
  const pics = (images || [])
    .map((i) => (typeof i?.image === 'object' ? (i.image as MediaDoc) : null))
    .filter((m): m is MediaDoc => Boolean(m?.url))

  if (!heading && !pics.length) return null

  return (
    <section className="container my-16">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {pics.length > 0 && <ProductGallery images={pics} alt={heading || 'Product'} />}

        <div className={pics.length ? '' : 'lg:col-span-2'}>
          {heading && <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{heading}</h2>}

          {price && (
            // Their price sits in the brand colour immediately under the title —
            // the single strongest signal that this is a thing you can buy.
            <p className="mt-3 text-lg font-semibold" style={{ color: 'var(--tenant-primary, var(--primary))' }}>
              {price}
            </p>
          )}

          {body && (
            <div className="mt-5">
              <RichText data={body} enableGutter={false} />
            </div>
          )}

          {ctaUrl && (
            <div className="mt-8">
              <Button asChild size="lg">
                <Link href={ctaUrl}>{ctaLabel || 'Buy now'}</Link>
              </Button>
            </div>
          )}

          {footnote && <p className="mt-3 text-sm text-muted-foreground">{footnote}</p>}
        </div>
      </div>
    </section>
  )
}
