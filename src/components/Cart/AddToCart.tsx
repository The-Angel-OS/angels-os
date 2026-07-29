'use client'

import { Button } from '@/components/ui/button'
import type { Product, Variant } from '@/payload-types'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import clsx from 'clsx'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { trackAddToCart } from '@/utilities/gtagEcommerce'
type Props = {
  product: Product
}

export function AddToCart({ product }: Props) {
  const { addItem, cart, isLoading } = useCart()
  const searchParams = useSearchParams()

  const variants = product.variants?.docs || []

  const selectedVariant = useMemo<Variant | undefined>(() => {
    if (product.enableVariants && variants.length) {
      const variantId = searchParams.get('variant')

      const validVariant = variants.find((variant) => {
        if (typeof variant === 'object') {
          return String(variant.id) === variantId
        }
        return String(variant) === variantId
      })

      if (validVariant && typeof validVariant === 'object') {
        return validVariant
      }
    }

    return undefined
  }, [product.enableVariants, searchParams, variants])

  const addToCart = useCallback(
    (e: React.FormEvent<HTMLButtonElement>) => {
      e.preventDefault()

      addItem({
        product: product.id,
        variant: selectedVariant?.id ?? undefined,
      })
        .then(() => {
          toast.success('Item added to cart.')
          // add_to_cart is the mid-funnel event ad platforms can actually
          // optimize toward at a considered-purchase price point — purchases are
          // too rare to train on. It was the ONE step of the funnel with no
          // caller: view_item, begin_checkout, add_payment_info and purchase all
          // fired, and the step between the first two did not.
          const price = selectedVariant?.priceInUSD ?? product.priceInUSD ?? 0
          trackAddToCart(
            [
              {
                item_id: String(product.id),
                item_name: product.title,
                price,
                currency: 'USD',
                ...(selectedVariant ? { item_variant: String(selectedVariant.id) } : {}),
              },
            ],
            price,
          )
          // Reveal the drawer so the add is visibly confirmed (CartModal listens).
          window.dispatchEvent(new Event('cart:open'))
        })
        .catch(() => toast.error('Could not add to cart — please try again.'))
    },
    [addItem, product, selectedVariant],
  )

  const disabled = useMemo<boolean>(() => {
    const existingItem = cart?.items?.find((item) => {
      const productID = typeof item.product === 'object' ? item.product?.id : item.product
      const variantID = item.variant
        ? typeof item.variant === 'object'
          ? item.variant?.id
          : item.variant
        : undefined

      if (productID === product.id) {
        if (product.enableVariants) {
          return variantID === selectedVariant?.id
        }
        return true
      }
    })

    if (existingItem) {
      const existingQuantity = existingItem.quantity

      if (product.enableVariants) {
        return existingQuantity >= (selectedVariant?.inventory || 0)
      }
      return existingQuantity >= (product.inventory || 0)
    }

    if (product.enableVariants) {
      if (!selectedVariant) {
        return true
      }

      if (!selectedVariant.inventory || selectedVariant.inventory <= 0) {
        return true
      }
    } else {
      if (!product.inventory || product.inventory <= 0) {
        return true
      }
    }

    return false
  }, [selectedVariant, cart?.items, product])

  // Explain WHY the button is disabled so it never reads as a dead/broken control.
  const inStock = product.enableVariants
    ? (selectedVariant?.inventory ?? 0) > 0
    : (product.inventory ?? 0) > 0
  const label = !disabled
    ? 'Add To Cart'
    : product.enableVariants && !selectedVariant
      ? 'Choose an option'
      : !inStock
        ? 'Out of stock'
        : 'Max in cart'

  return (
    <Button
      aria-label="Add to cart"
      variant={'outline'}
      className={clsx({
        'hover:opacity-90': true,
      })}
      disabled={disabled || isLoading}
      onClick={addToCart}
      type="submit"
    >
      {label}
    </Button>
  )
}
