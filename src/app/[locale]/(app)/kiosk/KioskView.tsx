'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { toast } from 'sonner'
import { ShoppingCart, Plus } from 'lucide-react'
import { Media } from '@/components/Media'
import { Price } from '@/components/Price'

interface KioskProduct {
  id: number | string
  title?: string | null
  slug?: string | null
  priceInUSD?: number | null
  inventory?: number | null
  gallery?: Array<{ image?: unknown }> | null
}

export function KioskView({ products }: { products: KioskProduct[] }) {
  const { addItem, cart, isLoading } = useCart()

  const itemCount = useMemo(
    () => (cart?.items || []).reduce((n: number, i: { quantity?: number }) => n + (i.quantity || 0), 0),
    [cart],
  )

  const add = (p: KioskProduct) => {
    if (!p.inventory || p.inventory <= 0) return
    addItem({ product: p.id as never })
      .then(() => toast.success(`${p.title || 'Item'} added`))
      .catch(() => toast.error('Could not add — try again'))
  }

  return (
    <div className="pb-28">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Quick Shop</h1>
        <p className="mt-1 text-muted-foreground">Tap an item to add it — pay securely in a few taps.</p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
          No products available yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const out = !p.inventory || p.inventory <= 0
            const img =
              p.gallery?.[0]?.image && typeof p.gallery[0].image !== 'string' ? p.gallery[0].image : null
            const low = !out && typeof p.inventory === 'number' && p.inventory <= 10
            return (
              <button
                key={String(p.id)}
                onClick={() => add(p)}
                disabled={out || isLoading}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="relative aspect-square bg-muted/30">
                  {img ? (
                    <Media
                      resource={img as never}
                      fill
                      imgClassName="h-full w-full object-cover"
                      size="(max-width: 768px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">🪴</div>
                  )}
                  {out ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-bold uppercase tracking-wide text-white">
                      Sold out
                    </div>
                  ) : (
                    <div className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition group-active:scale-90">
                      <Plus className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <div className="line-clamp-2 text-sm font-semibold leading-snug">{p.title}</div>
                  <div className="mt-1 flex items-center justify-between">
                    {typeof p.priceInUSD === 'number' && (
                      <Price amount={p.priceInUSD} className="text-base font-bold" as="span" />
                    )}
                    {low && <span className="text-[10px] font-medium text-amber-600">{p.inventory} left</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Sticky checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-1">
          <div className="flex items-center gap-2 text-sm">
            <ShoppingCart className="h-5 w-5" />
            <span className="font-semibold">{itemCount}</span>
            <span className="text-muted-foreground">item{itemCount === 1 ? '' : 's'}</span>
          </div>
          <Link
            href="/checkout"
            aria-disabled={itemCount === 0}
            tabIndex={itemCount === 0 ? -1 : 0}
            className={`ml-auto rounded-full px-7 py-3 text-base font-bold transition ${
              itemCount === 0
                ? 'pointer-events-none bg-muted text-muted-foreground'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            Checkout →
          </Link>
        </div>
      </div>
    </div>
  )
}
