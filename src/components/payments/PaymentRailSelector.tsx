'use client'

import React, { useEffect, useState } from 'react'

export type PaymentRailId = 'square' | 'paypal'

export interface AvailableRailInfo {
  id: PaymentRailId
  label: string
  subtitle: string
  environment: 'sandbox' | 'production'
  supportsSubscriptions: boolean
  supportsConnectSplit: boolean
}

interface PaymentRailSelectorProps {
  value: PaymentRailId | null
  onChange: (provider: PaymentRailId) => void
  tenantSlug?: string
  disabled?: boolean
  onLoaded?: (info: {
    providers: AvailableRailInfo[]
    defaultProvider: PaymentRailId | null
    hasConnectedSquare: boolean
  }) => void
  className?: string
}

/**
 * Reusable payment rail picker for Donate, Membership, Booking, and Shop Checkout.
 * Auto-fetches active payment providers from /api/payment-ops/providers so every
 * payment surface gracefully shows Square (Card/Apple Pay/Google Pay), PayPal/Venmo,
 * or both when configured.
 */
export function PaymentRailSelector({
  value,
  onChange,
  tenantSlug,
  disabled = false,
  onLoaded,
  className = '',
}: PaymentRailSelectorProps) {
  const [providers, setProviders] = useState<AvailableRailInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const qs =
      tenantSlug && tenantSlug !== 'default'
        ? `?tenant=${encodeURIComponent(tenantSlug)}`
        : ''

    fetch(`/api/payment-ops/providers${qs}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load payment methods')
        return (await res.json()) as {
          providers?: AvailableRailInfo[]
          defaultProvider?: PaymentRailId | null
          hasConnectedSquare?: boolean
        }
      })
      .then((data) => {
        if (!active) return
        const list = Array.isArray(data.providers) ? data.providers : []
        const def = data.defaultProvider ?? list[0]?.id ?? null
        setProviders(list)
        setLoading(false)
        if (!value && def) {
          onChange(def)
        }
        onLoaded?.({
          providers: list,
          defaultProvider: def,
          hasConnectedSquare: Boolean(data.hasConnectedSquare),
        })
      })
      .catch((err) => {
        if (!active) return
        setLoading(false)
        setLoadError(err instanceof Error ? err.message : 'Unable to check payment providers')
        onLoaded?.({
          providers: [],
          defaultProvider: null,
          hasConnectedSquare: false,
        })
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug])

  if (loading) {
    return (
      <div className={`rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground ${className}`}>
        Loading payment options...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={`rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive ${className}`}>
        {loadError}
      </div>
    )
  }

  if (providers.length === 0) {
    return (
      <div className={`rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200 ${className}`}>
        Online checkout is not enabled on this portal yet. An administrator can connect Square or PayPal in Payment Settings.
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Choose payment method
      </p>
      <div className={`grid gap-2 ${providers.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
        {providers.map((rail) => {
          const selected = (value ?? providers[0]?.id) === rail.id
          return (
            <button
              key={rail.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(rail.id)}
              aria-pressed={selected}
              className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{rail.label}</span>
                {rail.environment === 'sandbox' && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    Sandbox
                  </span>
                )}
              </div>
              <span className="mt-0.5 text-xs text-muted-foreground">{rail.subtitle}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
