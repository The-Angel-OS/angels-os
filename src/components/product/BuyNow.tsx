'use client'

import { Button } from '@/components/ui/button'
import type { Product, Variant } from '@/payload-types'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

/**
 * "Buy now" — adds the product to the cart and jumps straight to /checkout, skipping
 * the cart drawer. Mirrors the fire-sale Craigslist ads whose links say "Buy now".
 * Falls back to a toast (never a dead button) if the add fails.
 */
export function BuyNow({ product }: { product: Product }) {
  const { addItem, isLoading } = useCart()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [busy, setBusy] = useState(false)

  const variants = product.variants?.docs || []

  const selectedVariant = useMemo<Variant | undefined>(() => {
    if (product.enableVariants && variants.length) {
      const variantId = searchParams.get('variant')
      const validVariant = variants.find((variant) =>
        typeof variant === 'object'
          ? String(variant.id) === variantId
          : String(variant) === variantId,
      )
      if (validVariant && typeof validVariant === 'object') return validVariant
    }
    return undefined
  }, [product.enableVariants, searchParams, variants])

  const inStock = product.enableVariants
    ? Boolean(selectedVariant?.inventory && selectedVariant.inventory > 0)
    : Boolean(product.inventory && product.inventory > 0)

  const needsVariant = product.enableVariants && !selectedVariant

  const buyNow = useCallback(async () => {
    if (needsVariant) {
      toast.error('Please choose an option first.')
      return
    }
    setBusy(true)
    try {
      await addItem({ product: product.id, variant: selectedVariant?.id ?? undefined })
      router.push('/checkout')
    } catch {
      toast.error('Could not start checkout. Please try again.')
      setBusy(false)
    }
  }, [addItem, product.id, selectedVariant, needsVariant, router])

  return (
    <Button
      aria-label="Buy now"
      type="button"
      onClick={buyNow}
      disabled={!inStock || busy || isLoading}
    >
      {busy ? 'Starting checkout…' : 'Buy now'}
    </Button>
  )
}
