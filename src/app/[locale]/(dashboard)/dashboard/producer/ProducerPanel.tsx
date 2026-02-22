'use client'

import React from 'react'
import { Package, Truck, DollarSign, Clock, CheckCircle, ArrowRight } from 'lucide-react'

interface ProductSummary {
  id: number
  title: string
  slug: string
  status: string
  priceInUSD?: number
  productionType?: string
  isLimitedEdition?: boolean
}

interface ProducerPanelProps {
  products: ProductSummary[]
  pendingOrders: number
  activeOrders: number
  shippedOrders: number
  totalEarnings: number
  locale: string
}

/**
 * ProducerPanel — Client component for the producer/vendor dashboard.
 *
 * Shows: stats overview, product list, quick actions.
 * LEO is the real interface — this provides visual context.
 */
export function ProducerPanel({
  products,
  pendingOrders,
  activeOrders,
  shippedOrders,
  totalEarnings,
  locale,
}: ProducerPanelProps) {
  const stats = [
    {
      label: 'Pending Orders',
      value: pendingOrders,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'In Production',
      value: activeOrders,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Shipped / Delivered',
      value: shippedOrders,
      icon: Truck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Earnings (60%)',
      value: `$${(totalEarnings / 100).toFixed(2)}`,
      icon: DollarSign,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Producer Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your products, fulfill orders, and track earnings.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-background p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Products</h2>
          <a
            href={`/${locale}/dashboard/products`}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Manage Products <ArrowRight size={12} />
          </a>
        </div>

        {products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/10 p-8 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <h3 className="mb-1 text-sm font-semibold">No products yet</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Ask LEO to help you create your first product, or add one from the dashboard.
            </p>
            <a
              href={`/${locale}/dashboard/spaces`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Ask LEO: &quot;Help me create a product&quot;
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium truncate">{product.title}</h3>
                    {product.isLimitedEdition && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Limited
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    {product.priceInUSD && (
                      <span>${(product.priceInUSD / 100).toFixed(2)}</span>
                    )}
                    {product.productionType && (
                      <span className="capitalize">
                        {product.productionType.replace(/_/g, ' ')}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      {product.status === 'published' ? (
                        <CheckCircle size={10} className="text-emerald-500" />
                      ) : (
                        <Clock size={10} className="text-amber-500" />
                      )}
                      {product.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <a
            href={`/${locale}/dashboard/orders`}
            className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-medium">View Orders</div>
              <div className="text-xs text-muted-foreground">Manage fulfillment</div>
            </div>
          </a>
          <a
            href={`/${locale}/dashboard/holon`}
            className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <Truck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-medium">Holon Node</div>
              <div className="text-xs text-muted-foreground">Network capabilities</div>
            </div>
          </a>
          <a
            href={`/${locale}/dashboard/spaces`}
            className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm font-medium">Talk to LEO</div>
              <div className="text-xs text-muted-foreground">AI-assisted production</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
