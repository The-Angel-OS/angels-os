'use client'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { useCart, usePayments } from '@payloadcms/plugin-ecommerce/client/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { trackPurchase } from '@/utilities/gtagEcommerce'

export const ConfirmOrder: React.FC = () => {
  const { confirmOrder } = usePayments()
  const { cart } = useCart()
  const [error, setError] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  // Ensure we only confirm the order once, even if the component re-renders
  const isConfirming = useRef(false)

  useEffect(() => {
    if (!cart || !cart.items || cart.items?.length === 0) {
      return
    }

    const paymentIntentID = searchParams.get('payment_intent')
    const email = searchParams.get('email')

    if (paymentIntentID) {
      if (!isConfirming.current) {
        isConfirming.current = true

        confirmOrder('stripe', {
          additionalData: {
            paymentIntentID,
          },
        })
          .then((result) => {
            if (result && typeof result === 'object' && 'orderID' in result && result.orderID) {
              // GA4: track purchase event
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
              trackPurchase({
                transactionId: String(result.orderID),
                value: cart?.subtotal || 0,
                items: ga4Items,
              })

              router.push(`/shop/order/${result.orderID}?email=${email}`)
            }
          })
          .catch((err) => {
            console.error('[ConfirmOrder] Error confirming order:', err)
            isConfirming.current = false
            setError(
              err instanceof Error
                ? err.message
                : 'There was a problem confirming your order. Your payment was received — please contact support if you do not see your order shortly.',
            )
          })
      }
    } else {
      // If no payment intent ID is found, redirect to the home
      router.push('/')
    }
  }, [cart, searchParams])

  if (error) {
    return (
      <div className="text-center w-full flex flex-col items-center justify-start gap-4 py-8">
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
          <svg
            className="h-8 w-8 text-amber-600 dark:text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Order confirmation issue</h1>
        <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        <div className="flex gap-4 mt-4">
          <Button
            onClick={() => {
              setError(null)
              isConfirming.current = false
            }}
            variant="default"
          >
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/orders">View my orders</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center w-full flex flex-col items-center justify-start gap-4">
      <h1 className="text-2xl">Confirming Order</h1>

      <LoadingSpinner className="w-12 h-6" />
    </div>
  )
}
