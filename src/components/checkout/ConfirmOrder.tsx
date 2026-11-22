'use client'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { trackPurchase } from '@/utilities/gtagEcommerce'

export const ConfirmOrder: React.FC = () => {
  const { cart, clearCart } = useCart()
  const [error, setError] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const isConfirming = useRef(false)

  useEffect(() => {
    const ref = searchParams.get('ref')
    const email = searchParams.get('email') || ''
    const orderIdParam = searchParams.get('orderId') || searchParams.get('token') || undefined
    const transactionIdParam = searchParams.get('transactionId') || undefined
    const subscriptionIdParam = searchParams.get('subscription_id') || undefined

    if (!ref) {
      router.push('/')
      return
    }

    if (isConfirming.current) return
    isConfirming.current = true

    fetch('/api/payment-ops/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ref,
        orderId: orderIdParam,
        transactionId: transactionIdParam,
        subscriptionId: subscriptionIdParam,
      }),
    })
      .then(async (res) => ({
        ok: res.ok,
        data: (await res.json().catch(() => ({}))) as {
          ok?: boolean
          pending?: boolean
          orderId?: string | number
          amountCents?: number
          error?: string
        },
      }))
      .then(async ({ ok, data }) => {
        if (ok && data?.ok && data?.orderId) {
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
            transactionId: String(data.orderId),
            value: cart?.subtotal || data.amountCents || 0,
            items: ga4Items,
          })

          try {
            await clearCart()
          } catch {
            /* non-fatal — cart is also marked purchased server-side */
          }

          const emailQs = email ? `?email=${encodeURIComponent(email)}` : ''
          router.push(`/shop/order/${data.orderId}${emailQs}`)
          return
        }

        isConfirming.current = false
        setError(
          data?.error ||
            (data?.pending
              ? 'Your payment is still finalizing — click Try again in a moment.'
              : 'There was a problem confirming your order. Your payment was received — please contact support if you do not see your order shortly.'),
        )
      })
      .catch((err) => {
        console.error('[ConfirmOrder] Error confirming order:', err)
        isConfirming.current = false
        setError(
          err instanceof Error
            ? err.message
            : 'There was a problem confirming your order. Please try again.',
        )
      })
  }, [cart, clearCart, router, searchParams])

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
