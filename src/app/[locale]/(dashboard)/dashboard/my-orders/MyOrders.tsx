'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'

/**
 * MyOrders — Customer order history with Angel Token status.
 *
 * Three visual states for each order item:
 * - Amber: Angel Token active (queued, waiting for a maker)
 * - Blue: In progress (matched, accepted, in production)
 * - Green: Fulfilled (shipped, delivered)
 * - Red: Cancelled / refunded
 *
 * Customers can cancel & refund active Angel Tokens from here.
 */

export interface CustomerOrderItem {
  orderId: number
  orderItemIndex: number
  productTitle: string
  productImageUrl?: string | null
  quantity: number
  price: number
  fulfillmentStatus: string
  tokenStatus?: string | null
  angelTokenId?: string | null
  queueReason?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
  shippedAt?: string | null
  configurationSummary?: string | null
  createdAt: string
}

interface MyOrdersProps {
  orders: CustomerOrderItem[]
  locale: string
}

/** Unique key for an order item used in state maps */
function itemKey(item: CustomerOrderItem) {
  return `${item.orderId}-${item.orderItemIndex}`
}

export function MyOrders({ orders, locale }: MyOrdersProps) {
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [cancelledTokens, setCancelledTokens] = useState<Set<string>>(new Set())

  // Group orders by status
  const queued: CustomerOrderItem[] = []
  const inProgress: CustomerOrderItem[] = []
  const fulfilled: CustomerOrderItem[] = []
  const cancelled: CustomerOrderItem[] = []

  for (const item of orders) {
    if (cancelledTokens.has(`${item.orderId}-${item.orderItemIndex}`)) {
      cancelled.push({ ...item, fulfillmentStatus: 'cancelled', tokenStatus: 'refunded' })
      continue
    }

    switch (item.fulfillmentStatus) {
      case 'pending_match':
        queued.push(item)
        break
      case 'matched':
      case 'accepted':
      case 'in_production':
        inProgress.push(item)
        break
      case 'shipped':
      case 'delivered':
        fulfilled.push(item)
        break
      case 'cancelled':
        cancelled.push(item)
        break
      default:
        inProgress.push(item)
    }
  }

  const handleCancel = async (orderId: number, orderItemIndex: number) => {
    const key = `${orderId}-${orderItemIndex}`
    setCancelling(key)

    try {
      const res = await fetch('/api/order-ops/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderItemIndex }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to cancel order.')
        return
      }

      toast.success(data.message || 'Order cancelled. Refund issued.')
      setCancelledTokens((prev) => new Set(prev).add(key))
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setCancelling(null)
    }
  }

  const totalOrders = orders.length

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your purchases and Angel Token status.
        </p>
      </div>

      {totalOrders === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold">No orders yet</h3>
          <p className="mb-6 text-sm text-muted-foreground max-w-md mx-auto">
            When you purchase products, your orders and Angel Token status will appear here.
          </p>
          <a
            href={`/${locale}/search`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Browse Products
          </a>
        </div>
      )}

      {/* Angel Tokens — Queued (amber banner) */}
      {queued.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
              {queued.length}
            </span>
            <h2 className="text-lg font-semibold">Waiting for a Maker</h2>
          </div>
          <div className="mb-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              These orders have an <strong>Angel Token</strong> — a paid claim on future production.
              A maker with the right skills will fulfill your order. You can cancel for a full refund anytime.
            </p>
          </div>
          <div className="space-y-3">
            {queued.map((item) => (
              <CustomerOrderCard
                key={itemKey(item)}
                item={item}
                variant="queued"
                locale={locale}
                onCancel={handleCancel}
                cancelling={cancelling === itemKey(item)}
              />
            ))}
          </div>
        </section>
      )}

      {/* In Progress (blue) */}
      {inProgress.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
              {inProgress.length}
            </span>
            <h2 className="text-lg font-semibold">In Progress</h2>
          </div>
          <div className="space-y-3">
            {inProgress.map((item) => (
              <CustomerOrderCard
                key={itemKey(item)}
                item={item}
                variant="in_progress"
                locale={locale}
              />
            ))}
          </div>
        </section>
      )}

      {/* Fulfilled (green) */}
      {fulfilled.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
              {fulfilled.length}
            </span>
            <h2 className="text-lg font-semibold">Fulfilled</h2>
          </div>
          <div className="space-y-3">
            {fulfilled.map((item) => (
              <CustomerOrderCard
                key={itemKey(item)}
                item={item}
                variant="fulfilled"
                locale={locale}
              />
            ))}
          </div>
        </section>
      )}

      {/* Cancelled / Refunded */}
      {cancelled.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-800">
              {cancelled.length}
            </span>
            <h2 className="text-lg font-semibold">Cancelled</h2>
          </div>
          <div className="space-y-3">
            {cancelled.map((item) => (
              <CustomerOrderCard
                key={itemKey(item)}
                item={item}
                variant="cancelled"
                locale={locale}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── CustomerOrderCard ──────────────────────────────────────────

function CustomerOrderCard({
  item,
  variant,
  locale,
  onCancel,
  cancelling,
}: {
  item: CustomerOrderItem
  variant: 'queued' | 'in_progress' | 'fulfilled' | 'cancelled'
  locale: string
  onCancel?: (orderId: number, orderItemIndex: number) => void
  cancelling?: boolean
}) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    pending_match: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-200', label: 'Waiting for Maker' },
    matched: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-200', label: 'Maker Found' },
    accepted: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-200', label: 'Order Accepted' },
    in_production: { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-800 dark:text-indigo-200', label: 'Being Made' },
    shipped: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-200', label: 'Shipped' },
    delivered: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-200', label: 'Delivered' },
    cancelled: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-800 dark:text-red-200', label: 'Cancelled' },
  }

  const status = statusConfig[item.fulfillmentStatus] || statusConfig.pending_match

  const borderColor =
    variant === 'queued'
      ? 'border-amber-200 dark:border-amber-800'
      : variant === 'in_progress'
        ? 'border-blue-200 dark:border-blue-800'
        : variant === 'fulfilled'
          ? 'border-emerald-200 dark:border-emerald-800'
          : 'border-red-200 dark:border-red-800'

  return (
    <div className={`rounded-lg border ${borderColor} bg-card p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{item.productTitle}</p>
          <p className="text-sm text-muted-foreground">
            Order #{item.orderId} &middot; Qty: {item.quantity}
          </p>
          {item.angelTokenId && (
            <p className="mt-1 text-xs font-mono text-muted-foreground">
              {item.angelTokenId}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold">${item.price.toFixed(2)}</p>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Configuration display */}
      {item.configurationSummary && (
        <div className="mt-3 rounded-md bg-muted/50 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Your configuration:</p>
          <p className="text-sm">{item.configurationSummary}</p>
        </div>
      )}

      {/* Queue reason for Angel Tokens */}
      {variant === 'queued' && item.queueReason && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          {item.queueReason}
        </p>
      )}

      {/* Tracking info for shipped orders */}
      {item.trackingNumber && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
          </svg>
          {item.trackingUrl ? (
            <a
              href={item.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              {item.trackingNumber}
            </a>
          ) : (
            <span className="text-muted-foreground">{item.trackingNumber}</span>
          )}
        </div>
      )}

      {/* Cancel & Refund button for queued Angel Tokens */}
      {variant === 'queued' && onCancel && (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Full refund available while waiting for a maker.
          </p>
          <button
            onClick={() => onCancel(item.orderId, item.orderItemIndex)}
            disabled={cancelling}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelling ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Cancelling...
              </>
            ) : (
              'Cancel & Refund'
            )}
          </button>
        </div>
      )}

      {/* Token refund confirmation */}
      {variant === 'cancelled' && item.tokenStatus === 'refunded' && (
        <div className="mt-3 rounded-md bg-red-50 dark:bg-red-950/20 px-3 py-2">
          <p className="text-sm text-red-700 dark:text-red-300">
            Refund has been issued. Please allow 5-10 business days for the refund to appear.
          </p>
        </div>
      )}

      {/* Order date + view details */}
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Ordered {new Date(item.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <Link
          href={`/${locale}/dashboard/my-orders/${item.orderId}`}
          className="text-xs text-primary hover:underline font-medium"
        >
          View Details →
        </Link>
      </div>
    </div>
  )
}
