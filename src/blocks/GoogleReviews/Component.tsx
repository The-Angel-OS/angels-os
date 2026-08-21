import React from 'react'
import { fetchPlaceReviews } from '@/utilities/googlePlacesReviews'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

/** Can whoever is looking at this page fix it? Anonymous visitors: no. */
async function viewerCanManage(): Promise<boolean> {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: await headers() })
    if (!user) return false
    if (checkRole(ADMIN_ROLES, user)) return true
    const roles = (user as { tenantRoles?: string[] }).tenantRoles || []
    return roles.includes('tenant_admin') || roles.includes('tenant_manager')
  } catch {
    return false
  }
}

type Props = {
  placeId?: string
  heading?: string
  maxReviews?: number
  minRating?: number
  showAggregate?: boolean
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <span className="text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(Math.min(5, full))}
      <span className="text-neutral-300 dark:text-neutral-600">{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  )
}

// Server component: fetches (cached) Google reviews at render. No client JS, no
// key on the client. Renders nothing loud on failure — a reviews widget that
// can't load should stay quiet, not show an error to shoppers.
export async function GoogleReviewsBlock({
  placeId,
  heading,
  maxReviews = 5,
  minRating = 4,
  showAggregate = true,
}: Props) {
  if (!placeId) return null
  const { rating, total, reviews, error } = await fetchPlaceReviews(placeId)
  if (error) {
    // Shoppers must never see this; the OWNER must. Silent-in-production is why
    // both blocks on the node sat broken for months — NeuroCare Pro had 85
    // five-star reviews their homepage never showed, and nobody had a way to
    // find out. Admins get the reason and the fix; everyone else gets nothing.
    if ((await viewerCanManage()) || process.env.NODE_ENV !== 'production') {
      return (
        <div className="container my-8 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Google reviews aren&apos;t showing on this page.</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">Only you can see this notice.</p>
        </div>
      )
    }
    return null
  }

  const shown = reviews.filter((r) => r.rating >= minRating).slice(0, Math.max(1, maxReviews))
  if (!shown.length && rating == null) return null

  return (
    <section className="container my-10">
      {(heading || (showAggregate && rating != null)) && (
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          {heading && <h2 className="text-2xl font-semibold">{heading}</h2>}
          {showAggregate && rating != null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Stars rating={rating} />
              <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
              <span>· {total.toLocaleString()} Google reviews</span>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r, i) => (
          <figure
            key={i}
            className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/40"
          >
            <div className="mb-2 flex items-center justify-between">
              <figcaption className="font-medium">{r.author}</figcaption>
              <Stars rating={r.rating} />
            </div>
            {r.text && (
              <blockquote className="line-clamp-6 text-sm text-muted-foreground">{r.text}</blockquote>
            )}
            {r.relativeTime && (
              <div className="mt-3 text-xs text-neutral-400">{r.relativeTime}</div>
            )}
          </figure>
        ))}
      </div>
    </section>
  )
}
