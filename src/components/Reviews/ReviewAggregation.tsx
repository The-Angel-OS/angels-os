'use client'

import React from 'react'
import { Star, MessageSquare } from 'lucide-react'

interface Review {
  id: number | string
  author: string
  rating: number
  content: string
  source: 'angelos' | 'google' | 'manual'
  isVerified: boolean
  publishedAt?: string
  response?: {
    content?: string
    respondedAt?: string
  }
}

interface ReviewAggregationProps {
  reviews: Review[]
  averageRating?: number
  totalCount?: number
  businessName?: string
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={
            star <= rating
              ? 'fill-amber-400 text-amber-400'
              : star - 0.5 <= rating
                ? 'fill-amber-400/50 text-amber-400'
                : 'text-muted-foreground/30'
          }
        />
      ))}
    </div>
  )
}

function RatingDistribution({ reviews }: { reviews: Review[] }) {
  const counts = [0, 0, 0, 0, 0]
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++
  })
  const max = Math.max(...counts, 1)

  return (
    <div className="space-y-1">
      {[5, 4, 3, 2, 1].map((stars) => (
        <div key={stars} className="flex items-center gap-2 text-xs">
          <span className="w-3 text-right text-muted-foreground">{stars}</span>
          <Star size={10} className="fill-amber-400 text-amber-400" />
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${(counts[stars - 1] / max) * 100}%` }}
            />
          </div>
          <span className="w-6 text-right text-muted-foreground">{counts[stars - 1]}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * ReviewAggregation — Displays reviews with summary stats.
 *
 * Shows: average rating, star distribution, individual reviews.
 * Supports Angel OS native + Google Places + manual reviews.
 */
export function ReviewAggregation({
  reviews,
  averageRating,
  totalCount,
  businessName,
}: ReviewAggregationProps) {
  const avg =
    averageRating ??
    (reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0)
  const total = totalCount ?? reviews.length

  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/10 p-8 text-center">
        <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
        <h3 className="mb-1 text-sm font-semibold">No reviews yet</h3>
        <p className="text-xs text-muted-foreground">
          Be the first to leave a review{businessName ? ` for ${businessName}` : ''}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-start gap-6 rounded-xl border border-border bg-background p-5">
        <div className="text-center">
          <div className="text-4xl font-bold">{avg.toFixed(1)}</div>
          <StarRating rating={Math.round(avg)} size={14} />
          <div className="mt-1 text-xs text-muted-foreground">{total} reviews</div>
        </div>
        <div className="flex-1">
          <RatingDistribution reviews={reviews} />
        </div>
      </div>

      {/* Individual Reviews */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="rounded-lg border border-border bg-background p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{review.author}</span>
                  {review.isVerified && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      Verified
                    </span>
                  )}
                  {review.source === 'google' && (
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                      Google
                    </span>
                  )}
                </div>
                <StarRating rating={review.rating} size={12} />
              </div>
              {review.publishedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(review.publishedAt).toLocaleDateString()}
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-foreground/80">{review.content}</p>

            {/* Owner Response */}
            {review.response?.content && (
              <div className="mt-3 rounded-lg bg-muted/30 p-3 border-l-2 border-primary">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Response from {businessName || 'the owner'}
                </div>
                <p className="text-sm text-foreground/80">{review.response.content}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
