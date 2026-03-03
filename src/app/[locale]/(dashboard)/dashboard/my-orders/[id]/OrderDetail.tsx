'use client'

import Link from 'next/link'
import { ChevronLeftIcon, PackageIcon, TruckIcon, CheckCircleIcon, ClockIcon, WrenchIcon, ZapIcon } from 'lucide-react'
import { CancelConfirmDialog } from './CancelConfirmDialog'

// ── Types ───────────────────────────────────────────────────────────────────

export interface OrderDetailItem {
  orderItemIndex: number
  productTitle: string
  productImageUrl?: string | null
  quantity: number
  price: number
  fulfillmentStatus: string
  isCancelled: boolean
  tokenStatus?: string | null
  angelTokenId?: string | null
  queueReason?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
  shippedAt?: string | null
  matchedAt?: string | null
  acceptedAt?: string | null
  productionStartedAt?: string | null
  makerName?: string | null
  makerTenant?: string | null
  configurationSummary?: string | null
  configurationFields: { label: string; value: string }[]
  /** Index into TIMELINE_STEPS of the current step; -1 means cancelled */
  timelineCurrentIdx: number
}

export interface OrderDetailView {
  orderId: number
  createdAt: string
  totalAmount: number
  currency: string
  items: OrderDetailItem[]
}

interface OrderDetailProps {
  order: OrderDetailView
  locale: string
}

// ── Timeline definition ──────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  { key: 'pending_match', label: 'Queued', icon: ClockIcon },
  { key: 'matched', label: 'Maker Found', icon: ZapIcon },
  { key: 'accepted', label: 'Accepted', icon: CheckCircleIcon },
  { key: 'in_production', label: 'Being Made', icon: WrenchIcon },
  { key: 'shipped', label: 'Shipped', icon: TruckIcon },
  { key: 'delivered', label: 'Delivered', icon: PackageIcon },
]

// ── Token status badge ───────────────────────────────────────────────────────

function TokenBadge({ tokenStatus }: { tokenStatus: string | null | undefined }) {
  if (!tokenStatus) return null
  const styles: Record<string, string> = {
    active: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-200 dark:border-amber-800',
    redeemed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
    refunded: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 border-red-200 dark:border-red-800',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 border-red-200 dark:border-red-800',
  }
  const label: Record<string, string> = {
    active: 'Active',
    redeemed: 'Redeemed',
    refunded: 'Refunded',
    cancelled: 'Cancelled',
  }
  const cls = styles[tokenStatus] || 'bg-muted text-muted-foreground border-border'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider ${cls}`}
    >
      {label[tokenStatus] ?? tokenStatus}
    </span>
  )
}

// ── Timeline stepper ─────────────────────────────────────────────────────────

function FulfillmentTimeline({
  currentIdx,
  isCancelled,
}: {
  currentIdx: number
  isCancelled: boolean
}) {
  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-4 py-3">
        <span className="text-sm font-medium text-red-700 dark:text-red-300">Order cancelled</span>
      </div>
    )
  }

  return (
    <ol className="relative flex items-start gap-0">
      {TIMELINE_STEPS.map((step, idx) => {
        const completed = idx < currentIdx
        const active = idx === currentIdx
        const Icon = step.icon

        return (
          <li key={step.key} className="flex flex-col items-center flex-1 min-w-0">
            {/* Connector line */}
            <div className="flex items-center w-full">
              {/* Left connector */}
              <div
                className={`flex-1 h-0.5 ${idx === 0 ? 'invisible' : completed || active ? 'bg-primary' : 'bg-border'}`}
              />
              {/* Circle */}
              <div
                className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  completed
                    ? 'border-primary bg-primary text-primary-foreground'
                    : active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              {/* Right connector */}
              <div
                className={`flex-1 h-0.5 ${idx === TIMELINE_STEPS.length - 1 ? 'invisible' : completed ? 'bg-primary' : 'bg-border'}`}
              />
            </div>
            {/* Label */}
            <span
              className={`mt-1.5 text-center text-[10px] font-medium leading-tight px-0.5 ${
                active ? 'text-primary' : completed ? 'text-primary/70' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ── Single order item card ───────────────────────────────────────────────────

function OrderItemCard({
  item,
  orderId,
  locale,
}: {
  item: OrderDetailItem
  orderId: number
  locale: string
}) {
  const canCancel =
    item.fulfillmentStatus === 'pending_match' &&
    item.tokenStatus === 'active' &&
    !item.isCancelled

  return (
    <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-5">
      {/* Header: product + price */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {item.productImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.productImageUrl}
              alt={item.productTitle}
              className="h-14 w-14 rounded-md object-cover shrink-0 border border-border"
            />
          )}
          <div className="min-w-0">
            <p className="font-semibold truncate">{item.productTitle}</p>
            <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
          </div>
        </div>
        <p className="font-semibold shrink-0">${item.price.toFixed(2)}</p>
      </div>

      {/* Angel Token badge + ID */}
      {item.angelTokenId && (
        <div className="flex items-center gap-3 flex-wrap">
          <TokenBadge tokenStatus={item.tokenStatus} />
          <span className="font-mono text-xs text-muted-foreground select-all">{item.angelTokenId}</span>
        </div>
      )}

      {/* Fulfillment timeline */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
          Fulfillment Progress
        </p>
        <FulfillmentTimeline
          currentIdx={item.timelineCurrentIdx}
          isCancelled={item.isCancelled}
        />
      </div>

      {/* Queue reason */}
      {item.queueReason && !item.isCancelled && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-0.5 uppercase tracking-wide">
            Waiting for
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200">{item.queueReason}</p>
        </div>
      )}

      {/* Maker assignment (when matched+) */}
      {item.makerName && !item.isCancelled && (
        <div className="rounded-md bg-muted/60 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-0.5 uppercase tracking-wide">
            Assigned Maker
          </p>
          <p className="text-sm font-medium">{item.makerName}</p>
          {item.makerTenant && (
            <p className="text-xs text-muted-foreground">{item.makerTenant}</p>
          )}
        </div>
      )}

      {/* Configuration */}
      {item.configurationFields.length > 0 && (
        <div className="rounded-md bg-muted/40 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Your Configuration
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            {item.configurationFields.map((field) => (
              <div key={field.label}>
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="text-sm font-medium">{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Tracking */}
      {item.trackingNumber && (
        <div className="flex items-center gap-2 text-sm">
          <TruckIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Tracking:</span>
          {item.trackingUrl ? (
            <a
              href={item.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline font-mono text-xs"
            >
              {item.trackingNumber}
            </a>
          ) : (
            <span className="font-mono text-xs">{item.trackingNumber}</span>
          )}
          {item.shippedAt && (
            <span className="text-xs text-muted-foreground ml-auto">
              Shipped {new Date(item.shippedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
      )}

      {/* Refund message for cancelled items */}
      {item.isCancelled && item.tokenStatus === 'refunded' && (
        <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-300">
            Refund has been issued. Please allow 5–10 business days to appear.
          </p>
        </div>
      )}

      {/* Cancel button */}
      {canCancel && (
        <div className="border-t border-border pt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Full refund available while waiting for a maker.
          </p>
          <CancelConfirmDialog
            orderId={orderId}
            orderItemIndex={item.orderItemIndex}
            angelTokenId={item.angelTokenId}
            locale={locale}
          >
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              Cancel &amp; Refund
            </button>
          </CancelConfirmDialog>
        </div>
      )}
    </div>
  )
}

// ── Main OrderDetail component ────────────────────────────────────────────────

export function OrderDetail({ order, locale }: OrderDetailProps) {
  const formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Back nav */}
      <div className="mb-5">
        <Link
          href={`/${locale}/dashboard/my-orders`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          All Orders
        </Link>
      </div>

      {/* Order header */}
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order #{order.orderId}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{formattedDate}</p>
        </div>
        {order.totalAmount > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Total</p>
            <p className="text-xl font-semibold">${order.totalAmount.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Items */}
      {order.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No items found in this order.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {order.items.map((item) => (
            <OrderItemCard
              key={`${order.orderId}-${item.orderItemIndex}`}
              item={item}
              orderId={order.orderId}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  )
}
