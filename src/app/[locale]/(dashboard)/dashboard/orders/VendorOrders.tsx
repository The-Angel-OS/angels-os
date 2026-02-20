'use client'

/**
 * VendorOrders — client component for the vendor order dashboard.
 *
 * Three sections: Incoming (accept/reject), Active (update status), Completed (revenue).
 * Minimal, mobile-first. LEO is the real interface — this is transitional scaffolding.
 */

interface OrderSummary {
  orderId: number
  orderItemIndex: number
  productTitle: string
  quantity: number
  price: number
  fulfillmentStatus: string
  matchScore?: number
  trackingNumber?: string
  vendorShare: number
}

interface VendorOrdersProps {
  incoming: OrderSummary[]
  active: OrderSummary[]
  completed: OrderSummary[]
  vendorShareTotal: number
  locale: string
}

export function VendorOrders({
  incoming,
  active,
  completed,
  vendorShareTotal,
  locale,
}: VendorOrdersProps) {
  const totalOrders = incoming.length + active.length + completed.length

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vendor Orders</h1>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Revenue (60%)</p>
          <p className="text-lg font-semibold text-emerald-600">${vendorShareTotal.toFixed(2)}</p>
        </div>
      </div>

      {totalOrders === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground mb-2">No orders yet.</p>
          <p className="text-sm text-muted-foreground">
            Orders will appear here when customers purchase products fulfilled by your holon.
            Ask LEO: &quot;Who can see my products on the network?&quot;
          </p>
        </div>
      )}

      {/* Incoming Orders — needs accept/reject */}
      {incoming.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
              {incoming.length}
            </span>
            Incoming
          </h2>
          <div className="space-y-3">
            {incoming.map((order) => (
              <OrderCard key={`${order.orderId}-${order.orderItemIndex}`} order={order} type="incoming" locale={locale} />
            ))}
          </div>
        </section>
      )}

      {/* Active Orders — in progress */}
      {active.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
              {active.length}
            </span>
            Active
          </h2>
          <div className="space-y-3">
            {active.map((order) => (
              <OrderCard key={`${order.orderId}-${order.orderItemIndex}`} order={order} type="active" locale={locale} />
            ))}
          </div>
        </section>
      )}

      {/* Completed Orders — revenue */}
      {completed.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
              {completed.length}
            </span>
            Completed
          </h2>
          <div className="space-y-3">
            {completed.map((order) => (
              <OrderCard key={`${order.orderId}-${order.orderItemIndex}`} order={order} type="completed" locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── OrderCard ────────────────────────────────────────────────────

function OrderCard({
  order,
  type,
  locale,
}: {
  order: OrderSummary
  type: 'incoming' | 'active' | 'completed'
  locale: string
}) {
  const statusColors: Record<string, string> = {
    matched: 'bg-amber-100 text-amber-800',
    accepted: 'bg-blue-100 text-blue-800',
    in_production: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-emerald-100 text-emerald-800',
    delivered: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{order.productTitle}</p>
          <p className="text-sm text-muted-foreground">
            Order #{order.orderId} &middot; Qty: {order.quantity}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-medium">${order.price.toFixed(2)}</p>
          <p className="text-xs text-emerald-600">+${order.vendorShare.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            statusColors[order.fulfillmentStatus] || 'bg-muted text-muted-foreground'
          }`}
        >
          {order.fulfillmentStatus.replace('_', ' ')}
        </span>

        {order.matchScore && (
          <span className="text-xs text-muted-foreground">
            Match: {order.matchScore}/100
          </span>
        )}
      </div>

      {order.trackingNumber && (
        <p className="mt-2 text-xs text-muted-foreground">
          Tracking: {order.trackingNumber}
        </p>
      )}

      {type === 'incoming' && (
        <p className="mt-3 text-xs text-muted-foreground italic">
          Use LEO to accept: &quot;Accept order {order.orderId}&quot;
        </p>
      )}

      {type === 'active' && (
        <p className="mt-3 text-xs text-muted-foreground italic">
          Use LEO to update: &quot;Ship order {order.orderId}&quot;
        </p>
      )}
    </div>
  )
}
