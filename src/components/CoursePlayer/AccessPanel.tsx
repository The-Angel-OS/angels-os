import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { TrainingAccessReason } from '@/utilities/trainingAccess'

export interface AccessPanelProps {
  title?: string | null
  reason: TrainingAccessReason
  /** The product that unlocks this — shown as a price and a way to buy it. */
  product?: { slug?: string | null; title?: string | null; priceInUSD?: number | null } | null
  /** Where to send someone who needs to sign in first. */
  returnTo?: string
}

const money = (cents?: number | null) =>
  typeof cents === 'number' ? `$${(cents / 100).toFixed(2)}` : null

/**
 * What a person sees instead of the course when they are not entitled to it —
 * a price and a way in, never a locked door with no handle.
 *
 * Deliberately plain language: no member tiers, no entitlement vocabulary.
 */
export const AccessPanel: React.FC<AccessPanelProps> = ({ title, reason, product, returnTo }) => {
  const price = money(product?.priceInUSD)
  const heading =
    reason === 'sign_in_required'
      ? 'Sign in to start'
      : reason === 'membership_required'
        ? 'Included with membership'
        : 'Get access'

  const body =
    reason === 'sign_in_required'
      ? 'This course is free — you just need an account so we can keep your place.'
      : reason === 'membership_required'
        ? 'This course comes with a membership.' + (product ? ' You can also buy it on its own.' : '')
        : 'Buy this course once and it stays yours.'

  return (
    <section className="mx-auto max-w-xl rounded-lg border p-6 text-center">
      {title ? <h2 className="text-xl font-semibold">{title}</h2> : null}
      <h3 className="mt-2 text-lg font-medium">{heading}</h3>
      <p className="text-muted-foreground mt-2 text-sm">{body}</p>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {reason === 'sign_in_required' ? (
          <Button asChild>
            <Link href={returnTo ? `/login?redirect=${encodeURIComponent(returnTo)}` : '/login'}>Sign in</Link>
          </Button>
        ) : null}
        {product?.slug ? (
          <Button asChild variant={reason === 'sign_in_required' ? 'outline' : 'default'}>
            <Link href={`/products/${product.slug}`}>{price ? `Get it — ${price}` : 'Get it'}</Link>
          </Button>
        ) : null}
        {reason === 'membership_required' ? (
          <Button asChild variant="outline">
            <Link href="/membership">See membership</Link>
          </Button>
        ) : null}
      </div>
    </section>
  )
}
