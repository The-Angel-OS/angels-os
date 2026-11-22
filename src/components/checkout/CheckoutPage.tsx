'use client'

import { Media } from '@/components/Media'
import { Message } from '@/components/Message'
import { Price } from '@/components/Price'
import { EditItemQuantityButton } from '@/components/Cart/EditItemQuantityButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'

import { PaymentRailSelector, type PaymentRailId } from '@/components/payments/PaymentRailSelector'
import { useAddresses, useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { CheckoutAddresses } from '@/components/checkout/CheckoutAddresses'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'
import { Address } from '@/payload-types'
import { Checkbox } from '@/components/ui/checkbox'
import { AddressItem } from '@/components/addresses/AddressItem'
import { FormItem } from '@/components/forms/FormItem'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { trackBeginCheckout, trackAddPaymentInfo } from '@/utilities/gtagEcommerce'
import { FEATURES } from '@/config/features'

export const CheckoutPage: React.FC<{ publishableKey?: string }> = () => {
  const { user } = useAuth()
  const router = useRouter()
  const { cart, removeItem } = useCart()
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)

  const handleRemoveCartItem = useCallback(
    async (itemId: string, label: string) => {
      if (!itemId || removingItemId) return
      setRemovingItemId(itemId)
      try {
        await removeItem(itemId)
        toast.success(`Removed ${label} from your cart.`)
      } catch {
        toast.error('Could not remove that item — please try again.')
      } finally {
        setRemovingItemId(null)
      }
    },
    [removeItem, removingItemId],
  )
  const [error, setError] = useState<null | string>(null)
  const [email, setEmail] = useState('')
  const [emailEditable, setEmailEditable] = useState(true)
  const [provider, setProvider] = useState<PaymentRailId | null>(null)
  const [hasProviders, setHasProviders] = useState(true)
  const [checkoutCancelled, setCheckoutCancelled] = useState(false)
  const { addresses } = useAddresses()
  const [shippingAddress, setShippingAddress] = useState<Partial<Address>>()
  const [billingAddress, setBillingAddress] = useState<Partial<Address>>()
  const [billingAddressSameAsShipping, setBillingAddressSameAsShipping] = useState(true)
  const [isProcessingPayment, setProcessingPayment] = useState(false)
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'ship' | 'pickup'>('ship')
  const isPickup = FEATURES.localPickup && fulfillmentMethod === 'pickup'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('cancelled') === '1') {
      setCheckoutCancelled(true)
    }
  }, [])

  const cartIsEmpty = !cart || !cart.items || !cart.items.length

  const canGoToPayment = Boolean(
    (email || user) &&
      (emailEditable ? Boolean(user) : true) &&
      (isPickup || (billingAddress && (billingAddressSameAsShipping || shippingAddress))),
  )

  useEffect(() => {
    if (!shippingAddress && addresses && addresses.length > 0) {
      const defaultAddress = addresses[0]
      if (defaultAddress) {
        setBillingAddress(defaultAddress)
      }
    }
  }, [addresses, shippingAddress])

  useEffect(() => {
    return () => {
      setShippingAddress(undefined)
      setBillingAddress(undefined)
      setBillingAddressSameAsShipping(true)
      setEmail('')
      setEmailEditable(true)
    }
  }, [])

  const startHostedCartCheckout = useCallback(async () => {
    if (!cart?.id) {
      setError('Cart is missing or empty.')
      return
    }
    const customerEmail = ((user as { email?: string } | null)?.email || email || '').trim()
    if (!customerEmail) {
      setError('Please enter your email address first.')
      return
    }

    setProcessingPayment(true)
    setError(null)
    setCheckoutCancelled(false)
    try {
      const ga4Items = (cart?.items || [])
        .filter((item) => typeof item.product === 'object' && item.product)
        .map((item) => {
          const product = item.product as Record<string, unknown>
          return {
            item_id: String(product.id || ''),
            item_name: (product.title as string) || 'Product',
            price: (product.priceInUSD as number) || 0,
            quantity: item.quantity || 1,
          }
        })
      trackBeginCheckout(ga4Items, cart?.subtotal || 0)
      trackAddPaymentInfo(ga4Items, cart?.subtotal || 0)

      const res = await fetch('/api/payment-ops/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cartId: cart.id,
          customerEmail,
          provider: provider || undefined,
          fulfillmentMethod: isPickup ? 'pickup' : 'ship',
          ...(isPickup
            ? {}
            : {
                billingAddress,
                shippingAddress: billingAddressSameAsShipping ? billingAddress : shippingAddress,
              }),
        }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        checkoutUrl?: string
        error?: string
      }

      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'Could not start secure checkout.')
      }

      window.location.href = data.checkoutUrl
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred while initiating payment.'
      setError(msg)
      toast.error(msg)
      setProcessingPayment(false)
    }
  }, [
    cart,
    user,
    email,
    provider,
    isPickup,
    billingAddress,
    billingAddressSameAsShipping,
    shippingAddress,
  ])

  const checkoutStep: 'contact' | 'address' | 'payment' = canGoToPayment
    ? 'payment'
    : billingAddress || (isPickup && (user || (email && !emailEditable)))
      ? 'address'
      : 'contact'

  if (cartIsEmpty && isProcessingPayment) {
    return (
      <div className="py-12 w-full items-center justify-center">
        <div className="prose dark:prose-invert text-center max-w-none self-center mb-8">
          <p>Processing your payment...</p>
        </div>
        <LoadingSpinner />
      </div>
    )
  }

  if (cartIsEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg
          className="mb-4 h-16 w-16 text-muted-foreground/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
          />
        </svg>
        <h3 className="mb-2 text-xl font-semibold">Your cart is empty</h3>
        <p className="mb-6 text-sm text-muted-foreground">
          Add some items to your cart to get started.
        </p>
        <Button asChild>
          <Link href="/shop">Browse products</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-stretch justify-stretch my-8 md:flex-row grow gap-10 md:gap-6 lg:gap-8">
      <div className="basis-full lg:basis-2/3 flex flex-col gap-8 justify-stretch">
        {/* Progress Steps */}
        <CheckoutSteps currentStep={checkoutStep} />

        <h2 className="font-medium text-3xl">Contact</h2>
        {!user && (
          <div className=" bg-accent dark:bg-black rounded-lg p-4 w-full flex items-center">
            <div className="prose dark:prose-invert">
              <Button asChild className="no-underline text-inherit" variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
              <p className="mt-0">
                <span className="mx-2">or</span>
                <Link href="/create-account">create an account</Link>
              </p>
            </div>
          </div>
        )}
        {user ? (
          <div className="bg-accent dark:bg-card rounded-lg p-4 ">
            <div>
              <p>{user.email}</p>{' '}
              <p>
                Not you?{' '}
                <Link className="underline" href="/logout">
                  Log out
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-accent dark:bg-black rounded-lg p-4 ">
            <div>
              <p className="mb-4">Enter your email to checkout as a guest.</p>

              <FormItem className="mb-6">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  disabled={!emailEditable}
                  id="email"
                  name="email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                />
              </FormItem>

              <Button
                disabled={!email || !emailEditable}
                onClick={(e) => {
                  e.preventDefault()
                  setEmailEditable(false)
                }}
                variant="default"
              >
                Continue as guest
              </Button>
            </div>
          </div>
        )}

        {FEATURES.localPickup && (
          <>
            <h2 className="font-medium text-3xl">Fulfillment</h2>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={isProcessingPayment}
                onClick={() => setFulfillmentMethod('ship')}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  fulfillmentMethod === 'ship'
                    ? 'border-primary ring-1 ring-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className="font-medium">Ship to me</p>
                <p className="text-sm text-muted-foreground">
                  Enter a shipping address and we&apos;ll deliver it.
                </p>
              </button>
              <button
                type="button"
                disabled={isProcessingPayment}
                onClick={() => setFulfillmentMethod('pickup')}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  fulfillmentMethod === 'pickup'
                    ? 'border-primary ring-1 ring-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className="font-medium">Local pickup — no shipping needed</p>
                <p className="text-sm text-muted-foreground">
                  Cash-and-carry. No address required — we&apos;ll email you to arrange pickup.
                </p>
              </button>
            </div>
          </>
        )}

        {isPickup ? (
          <div className="bg-accent dark:bg-card rounded-lg p-4">
            <p className="font-medium">Local pickup selected</p>
            <p className="text-sm text-muted-foreground">
              No shipping address needed. After payment we&apos;ll email you to arrange pickup.
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-medium text-3xl">Address</h2>

            {billingAddress ? (
              <div>
                <AddressItem
                  actions={
                    <Button
                      variant={'outline'}
                      disabled={isProcessingPayment}
                      onClick={(e) => {
                        e.preventDefault()
                        setBillingAddress(undefined)
                      }}
                    >
                      Remove
                    </Button>
                  }
                  address={billingAddress}
                />
              </div>
            ) : user ? (
              <CheckoutAddresses heading="Billing address" setAddress={setBillingAddress} />
            ) : (
              <CreateAddressModal
                disabled={!email || Boolean(emailEditable)}
                callback={(address) => {
                  setBillingAddress(address)
                }}
                skipSubmission={true}
              />
            )}

            <div className="flex gap-4 items-center">
              <Checkbox
                id="shippingTheSameAsBilling"
                checked={billingAddressSameAsShipping}
                disabled={isProcessingPayment || (!user && (!email || Boolean(emailEditable)))}
                onCheckedChange={(state) => {
                  setBillingAddressSameAsShipping(state as boolean)
                }}
              />
              <Label htmlFor="shippingTheSameAsBilling">Shipping is the same as billing</Label>
            </div>

            {!billingAddressSameAsShipping && (
              <>
                {shippingAddress ? (
                  <div>
                    <AddressItem
                      actions={
                        <Button
                          variant={'outline'}
                          disabled={isProcessingPayment}
                          onClick={(e) => {
                            e.preventDefault()
                            setShippingAddress(undefined)
                          }}
                        >
                          Remove
                        </Button>
                      }
                      address={shippingAddress}
                    />
                  </div>
                ) : user ? (
                  <CheckoutAddresses
                    heading="Shipping address"
                    description="Please select a shipping address."
                    setAddress={setShippingAddress}
                  />
                ) : (
                  <CreateAddressModal
                    callback={(address) => {
                      setShippingAddress(address)
                    }}
                    disabled={!email || Boolean(emailEditable)}
                    skipSubmission={true}
                  />
                )}
              </>
            )}
          </>
        )}

        <div className="flex flex-col gap-4 border-t pt-6">
          <h2 className="font-medium text-3xl">Payment</h2>
          {checkoutCancelled && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
              Checkout was cancelled — you have not been charged.
            </div>
          )}

          <PaymentRailSelector
            value={provider}
            onChange={setProvider}
            onLoaded={(info) => setHasProviders(info.providers.length > 0)}
            disabled={isProcessingPayment}
          />

          <Button
            className="self-start"
            size="lg"
            disabled={!canGoToPayment || isProcessingPayment || !hasProviders}
            onClick={(e) => {
              e.preventDefault()
              void startHostedCartCheckout()
            }}
          >
            {isProcessingPayment ? 'Redirecting to Secure Payment...' : 'Continue to Secure Payment'}
          </Button>
        </div>

        {error && (
          <div className="my-4">
            <Message error={error} />

            <Button
              onClick={(e) => {
                e.preventDefault()
                setError(null)
                router.refresh()
              }}
              variant="default"
            >
              Try again
            </Button>
          </div>
        )}
      </div>

      {!cartIsEmpty && (
        <div className="basis-full lg:basis-1/3 lg:pl-8 p-8 border-none bg-primary/5 flex flex-col gap-8 rounded-lg">
          <h2 className="text-3xl font-medium">Your cart</h2>
          {cart?.items?.map((item, index) => {
            if (typeof item.product === 'object' && item.product) {
              const {
                product,
                product: { id, meta, title, gallery },
                quantity,
                variant,
              } = item

              if (!quantity) return null

              let image = gallery?.[0]?.image || meta?.image
              let price = product?.priceInUSD

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

                    const hasMatch = variant?.options?.some((option: { id?: number } | number) => {
                      if (option && typeof option === 'object') return option.id === variantOptionID
                      else return option === variantOptionID
                    })

                    return hasMatch
                  },
                )

                if (imageVariant && typeof imageVariant.image !== 'string') {
                  image = imageVariant.image
                }
              }

              return (
                <div className="flex items-start gap-4" key={index}>
                  <div className="flex items-stretch justify-stretch h-20 w-20 p-2 rounded-lg border">
                    <div className="relative w-full h-full">
                      {image && typeof image !== 'string' && (
                        <Media className="" fill imgClassName="rounded-lg" resource={image} />
                      )}
                    </div>
                  </div>
                  <div className="flex grow justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <p className="font-medium text-lg">{title}</p>
                      {variant && typeof variant === 'object' && (
                        <p className="text-sm font-mono text-primary/50 tracking-widest">
                          {variant.options
                            ?.map((option: { label?: string } | unknown) => {
                              if (typeof option === 'object' && option && 'label' in option)
                                return (option as { label?: string }).label
                              return null
                            })
                            .join(', ')}
                        </p>
                      )}
                      {/* Was a static "x2". A shopper who picked the wrong count
                          had to leave checkout, reopen the cart drawer, fix it,
                          and come back — so fix it here, where they noticed. */}
                      <div className="flex h-8 w-fit flex-row items-center rounded-lg border">
                        <EditItemQuantityButton item={item} type="minus" />
                        <p className="w-6 text-center text-sm">{quantity}</p>
                        <EditItemQuantityButton item={item} type="plus" />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {typeof price === 'number' && <Price amount={price} />}
                      {(() => {
                        const itemId = String((item as { id?: string | number }).id ?? '')
                        if (!itemId) return null
                        const isRemoving = removingItemId === itemId
                        return (
                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(itemId, title)}
                            disabled={isRemoving}
                            aria-label={`Remove ${title} from cart`}
                            title="Remove from cart"
                            className="flex h-7 w-7 items-center justify-center rounded-full text-primary/40 transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                          >
                            {isRemoving ? (
                              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </button>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )
            }
            return null
          })}
          <hr />
          <div className="flex justify-between items-center gap-2">
            <span className="uppercase">Total</span>{' '}
            <Price className="text-3xl font-medium" amount={cart.subtotal || 0} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Checkout Progress Steps ─────────────────────────────────────────────

const STEPS = [
  { key: 'contact', label: 'Contact', number: 1 },
  { key: 'address', label: 'Address', number: 2 },
  { key: 'payment', label: 'Payment', number: 3 },
] as const

function CheckoutSteps({ currentStep }: { currentStep: 'contact' | 'address' | 'payment' }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep)

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <React.Fragment key={step.key}>
            {index > 0 && (
              <div
                className={`h-px flex-1 transition-colors ${
                  isCompleted ? 'bg-emerald-500' : 'bg-border'
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </span>
              <span
                className={`hidden text-sm font-medium sm:inline ${
                  isCurrent ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
