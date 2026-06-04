'use client'

import { Price } from '@/components/Price'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { ShoppingCart } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

import { DeleteItemButton } from './DeleteItemButton'
import { EditItemQuantityButton } from './EditItemQuantityButton'
import { OpenCartButton } from './OpenCart'
import { Button } from '@/components/ui/button'
import { Product } from '@/payload-types'

export function CartModal() {
  const { cart } = useCart()
  const [isOpen, setIsOpen] = useState(false)

  const pathname = usePathname()

  useEffect(() => {
    // Close the cart modal when the pathname changes.
    setIsOpen(false)
  }, [pathname])

  // An item is "purchasable" only when its product is still a populated, published
  // object (deleted products come back as null, drafts as a bare ID). The badge must
  // count only these — otherwise orphaned items inflate the count (e.g. 22) while the
  // drawer shows nothing, leaving the cart visibly stuck.
  const isPurchasable = (item: { product?: unknown }) => {
    const product = item.product
    return typeof product === 'object' && product !== null && 'slug' in product && Boolean((product as Product).slug)
  }

  const totalQuantity = useMemo(() => {
    if (!cart?.items?.length) return undefined
    const qty = cart.items.reduce(
      (quantity, item) => (isPurchasable(item) ? quantity + (item.quantity || 0) : quantity),
      0,
    )
    return qty || undefined
  }, [cart])

  const hasPurchasable = useMemo(() => (cart?.items || []).some(isPurchasable), [cart])

  return (
    <Sheet onOpenChange={setIsOpen} open={isOpen}>
      <SheetTrigger asChild>
        <OpenCartButton quantity={totalQuantity} />
      </SheetTrigger>

      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>My Cart</SheetTitle>

          <SheetDescription>Manage your cart here, add items to view the total.</SheetDescription>
        </SheetHeader>

        {!cart || cart?.items?.length === 0 ? (
          <div className="text-center flex flex-col items-center gap-2">
            <ShoppingCart className="h-16" />
            <p className="text-center text-2xl font-bold">Your cart is empty.</p>
          </div>
        ) : (
          <div className="grow flex px-4">
            <div className="flex flex-col justify-between w-full">
              <ul className="grow overflow-auto py-4">
                {cart?.items?.map((item, i) => {
                  const product = item.product
                  const variant = item.variant

                  // Orphaned item (product deleted or unpublished): render a compact,
                  // removable row so the user can always clear it — never a silent skip.
                  if (typeof product !== 'object' || !item || !product || !product.slug) {
                    if (!item?.id) return <React.Fragment key={i} />
                    return (
                      <li
                        className="flex w-full items-center justify-between px-1 py-4 text-sm text-neutral-500 dark:text-neutral-400"
                        key={item.id}
                      >
                        <div className="flex items-center gap-3">
                          <DeleteItemButton item={item} />
                          <span className="italic">This item is no longer available.</span>
                        </div>
                        {item.quantity ? <span className="text-xs">×{item.quantity}</span> : null}
                      </li>
                    )
                  }

                  const metaImage =
                    product.meta?.image && typeof product.meta?.image === 'object'
                      ? product.meta.image
                      : undefined

                  const firstGalleryImage =
                    typeof product.gallery?.[0]?.image === 'object'
                      ? product.gallery?.[0]?.image
                      : undefined

                  let image = firstGalleryImage || metaImage
                  let price = product.priceInUSD

                  const isVariant = Boolean(variant) && typeof variant === 'object'

                  if (isVariant) {
                    price = variant?.priceInUSD

                    const imageVariant = product.gallery?.find(
                      (galleryItem: { variantOption?: unknown; image?: unknown }) => {
                        if (!galleryItem.variantOption) return false
                        const variantOptionID =
                          typeof galleryItem.variantOption === 'object'
                            ? (galleryItem.variantOption as { id?: number })?.id
                            : galleryItem.variantOption

                        const hasMatch = variant?.options?.some(
                          (option: { id?: number } | number) => {
                            if (typeof option === 'object') return option.id === variantOptionID
                            else return option === variantOptionID
                          },
                        )

                        return hasMatch
                      },
                    )

                    if (imageVariant && typeof imageVariant.image === 'object') {
                      image = imageVariant.image
                    }
                  }

                  return (
                    <li className="flex w-full flex-col" key={i}>
                      <div className="relative flex w-full flex-row justify-between px-1 py-4">
                        <div className="absolute z-40 -mt-2 ml-[55px]">
                          <DeleteItemButton item={item} />
                        </div>
                        <Link
                          className="z-30 flex flex-row space-x-4"
                          href={`/products/${(item.product as Product)?.slug}`}
                        >
                          <div className="relative h-16 w-16 cursor-pointer overflow-hidden rounded-md border border-neutral-300 bg-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
                            {image?.url && (
                              <Image
                                alt={image?.alt || product?.title || ''}
                                className="h-full w-full object-cover"
                                height={94}
                                src={image.url}
                                width={94}
                              />
                            )}
                          </div>

                          <div className="flex flex-1 flex-col text-base">
                            <span className="leading-tight">{product?.title}</span>
                            {isVariant && variant ? (
                              <p className="text-sm text-neutral-500 dark:text-neutral-400 capitalize">
                                {variant.options
                                  ?.map((option: { label?: string } | unknown) => {
                                    if (typeof option === 'object' && option && 'label' in option)
                                      return (option as { label?: string }).label
                                    return null
                                  })
                                  .join(', ')}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                        <div className="flex h-16 flex-col justify-between">
                          {typeof price === 'number' && (
                            <Price
                              amount={price}
                              className="flex justify-end space-y-2 text-right text-sm"
                            />
                          )}
                          <div className="ml-auto flex h-9 flex-row items-center rounded-lg border">
                            <EditItemQuantityButton item={item} type="minus" />
                            <p className="w-6 text-center">
                              <span className="w-full text-sm">{item.quantity}</span>
                            </p>
                            <EditItemQuantityButton item={item} type="plus" />
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {hasPurchasable && (
                <div className="px-4">
                  <div className="py-4 text-sm text-neutral-500 dark:text-neutral-400">
                    {typeof cart?.subtotal === 'number' && (
                      <div className="mb-3 flex items-center justify-between border-b border-neutral-200 pb-1 pt-1 dark:border-neutral-700">
                        <p>Total</p>
                        <Price
                          amount={cart?.subtotal}
                          className="text-right text-base text-black dark:text-white"
                        />
                      </div>
                    )}

                    <Button asChild>
                      <Link className="w-full" href="/checkout">
                        Proceed to Checkout
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
