'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

/**
 * VendorOrders — vendor order dashboard with tabs.
 *
 * Tab 1: My Orders — Incoming (accept/reject), Active (update status), Completed (revenue)
 * Tab 2: Available Orders — Claimable Angel Token orders matching vendor capabilities
 *
 * Sprint 19 — Vendor Claim + Fulfillment UI
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

interface ClaimableOrder {
  orderId: number
  orderItemIndex: number
  angelTokenId: string
  productTitle: string
  requiredSkills: string[]
  price: number
  vendorShare: number
  queuedAt: string
  queueReason: string
  configurationSummary: string | null
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
  const [activeTab, setActiveTab] = useState<'my-orders' | 'available'>('my-orders')
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

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab('my-orders')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'my-orders'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          My Orders
          {totalOrders > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
              {totalOrders}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('available')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'available'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Available Orders
        </button>
      </div>

      {activeTab === 'my-orders' && (
        <MyOrdersTab
          incoming={incoming}
          active={active}
          completed={completed}
          totalOrders={totalOrders}
          locale={locale}
        />
      )}

      {activeTab === 'available' && <AvailableOrdersTab locale={locale} />}
    </div>
  )
}

// ─── My Orders Tab ──────────────────────────────────────────────

function MyOrdersTab({
  incoming,
  active,
  completed,
  totalOrders,
  locale,
}: {
  incoming: OrderSummary[]
  active: OrderSummary[]
  completed: OrderSummary[]
  totalOrders: number
  locale: string
}) {
  return (
    <>
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

      {/* Active Orders */}
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

      {/* Completed Orders */}
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
    </>
  )
}

// ─── Available Orders Tab (Claimable) ───────────────────────────

function AvailableOrdersTab({ locale }: { locale: string }) {
  const [claimable, setClaimable] = useState<ClaimableOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [totalRevenue, setTotalRevenue] = useState(0)

  const fetchClaimable = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/orders/claimable')
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || data.message || 'Failed to load available orders.')
        setClaimable([])
        return
      }

      setClaimable(data.claimable || [])
      setTotalRevenue(data.totalVendorRevenue || 0)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClaimable()
  }, [fetchClaimable])

  const handleClaim = async (orderId: number, orderItemIndex: number) => {
    const key = `${orderId}-${orderItemIndex}`
    setClaiming(key)

    try {
      const res = await fetch('/api/orders/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderItemIndex }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to claim order.')
        return
      }

      toast.success(data.message || 'Order claimed! Check "My Orders" tab.')
      // Remove from claimable list
      setClaimable((prev) => prev.filter(
        (c) => !(c.orderId === orderId && c.orderItemIndex === orderItemIndex),
      ))
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setClaiming(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="h-6 w-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-2 text-sm text-muted-foreground">Loading available orders...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-muted-foreground mb-2">{error}</p>
        <button
          onClick={fetchClaimable}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (claimable.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-muted-foreground mb-2">No available orders right now.</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          When customers order products that match your capabilities, they&apos;ll appear here for you to claim.
          Check back later or ask LEO about expanding your capabilities.
        </p>
        <button
          onClick={fetchClaimable}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Revenue opportunity banner */}
      <div className="mb-4 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            {claimable.length} order{claimable.length !== 1 ? 's' : ''} available
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Matching your workshop capabilities
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Potential revenue</p>
          <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">${totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {claimable.map((order) => (
          <ClaimableOrderCard
            key={`${order.orderId}-${order.orderItemIndex}`}
            order={order}
            onClaim={handleClaim}
            claiming={claiming === `${order.orderId}-${order.orderItemIndex}`}
          />
        ))}
      </div>

      <div className="mt-4 text-center">
        <button
          onClick={fetchClaimable}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
    </>
  )
}

// ─── Claimable Order Card ───────────────────────────────────────

function ClaimableOrderCard({
  order,
  onClaim,
  claiming,
}: {
  order: ClaimableOrder
  onClaim: (orderId: number, orderItemIndex: number) => void
  claiming: boolean
}) {
  const daysInQueue = Math.floor(
    (Date.now() - new Date(order.queuedAt).getTime()) / (1000 * 60 * 60 * 24),
  )

  return (
    <div className="rounded-lg border border-primary/20 bg-card p-4 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{order.productTitle}</p>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">
            {order.angelTokenId}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-medium">${order.price.toFixed(2)}</p>
          <p className="text-sm font-semibold text-emerald-600">+${order.vendorShare.toFixed(2)}</p>
        </div>
      </div>

      {/* Required skills */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {order.requiredSkills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {skill}
          </span>
        ))}
      </div>

      {/* Configuration preview */}
      {order.configurationSummary && (
        <div className="mt-2 rounded-md bg-muted/50 px-3 py-1.5">
          <p className="text-xs text-muted-foreground">{order.configurationSummary}</p>
        </div>
      )}

      {/* Queue info + Claim button */}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          {daysInQueue === 0 ? 'Queued today' : `In queue ${daysInQueue} day${daysInQueue !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={() => onClaim(order.orderId, order.orderItemIndex)}
          disabled={claiming}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {claiming ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Claiming...
            </>
          ) : (
            'Claim Order'
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Order Card (existing) ──────────────────────────────────────

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
