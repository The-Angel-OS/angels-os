/**
 * Checkout loading skeleton — shown while Stripe/cart data initializes.
 */
export default function CheckoutLoading() {
  return (
    <div className="container min-h-[90vh] flex my-8 animate-pulse">
      <div className="flex flex-col md:flex-row grow gap-10 md:gap-6 lg:gap-8">
        <div className="basis-full lg:basis-2/3 flex flex-col gap-8">
          {/* Progress steps */}
          <div className="flex items-center gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <div className="h-px flex-1 bg-border w-16" />}
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="hidden sm:block h-4 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>

          {/* Contact section */}
          <div className="h-7 w-24 rounded bg-muted" />
          <div className="rounded-lg bg-accent dark:bg-card p-4">
            <div className="h-5 w-48 rounded bg-muted" />
            <div className="mt-2 h-4 w-32 rounded bg-muted" />
          </div>

          {/* Address section */}
          <div className="h-7 w-24 rounded bg-muted" />
          <div className="h-32 rounded-lg bg-accent dark:bg-card" />
        </div>

        {/* Cart summary */}
        <div className="basis-full lg:basis-1/3 lg:pl-8 p-8 bg-primary/5 rounded-lg">
          <div className="h-8 w-32 rounded bg-muted mb-6" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 mb-4">
              <div className="h-20 w-20 rounded-lg bg-muted" />
              <div className="flex-1">
                <div className="h-5 w-32 rounded bg-muted" />
                <div className="mt-2 h-4 w-16 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
