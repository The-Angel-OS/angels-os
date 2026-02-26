/**
 * Product Detail Loading Skeleton
 *
 * Shown while the product detail page is loading (Suspense boundary).
 * Matches the layout of the actual product page for minimal layout shift.
 */

export default function ProductDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-8 md:flex-row">
        {/* Image Gallery Skeleton */}
        <div className="basis-full md:basis-1/2">
          <div className="aspect-square w-full animate-pulse rounded-lg bg-muted" />
          <div className="mt-4 flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 w-16 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        </div>

        {/* Product Info Skeleton */}
        <div className="basis-full md:basis-1/2">
          {/* Title */}
          <div className="mb-2 h-8 w-3/4 animate-pulse rounded bg-muted" />
          {/* Price */}
          <div className="mb-6 h-10 w-32 animate-pulse rounded bg-muted" />
          {/* Description lines */}
          <div className="mb-4 space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
          </div>
          {/* Variant selectors */}
          <div className="mb-6 space-y-3">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 w-20 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          </div>
          {/* Add to Cart button */}
          <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      {/* Related Products Skeleton */}
      <div className="mt-16">
        <div className="mb-6 h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-square w-full animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
