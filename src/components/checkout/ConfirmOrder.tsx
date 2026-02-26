'use client'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useCart, usePayments } from '@payloadcms/plugin-ecommerce/client/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { trackPurchase } from '@/utilities/gtagEcommerce'

export const ConfirmOrder: React.FC = () => {
  const { confirmOrder } = usePayments()
  const { cart } = useCart()

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
        }).then((result) => {
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
      }
    } else {
      // If no payment intent ID is found, redirect to the home
      router.push('/')
    }
  }, [cart, searchParams])

  return (
    <div className="text-center w-full flex flex-col items-center justify-start gap-4">
      <h1 className="text-2xl">Confirming Order</h1>

      <LoadingSpinner className="w-12 h-6" />
    </div>
  )
}
