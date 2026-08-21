import Link from 'next/link'

/**
 * What /book shows on a portal that hasn't bought Business.
 *
 * Deliberately not a 404. A prospect looking at their own demo should see the
 * feature exists and is one decision away — and a real customer who lands here
 * should get a way to make contact rather than a dead end.
 */
export function BookingUpgradeNotice({ tenantName }: { tenantName: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Online booking isn&rsquo;t switched on yet</h1>
      <p className="mt-3 text-muted-foreground">
        {tenantName} takes bookings by phone or through the contact form for now.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/contact"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Get in touch
        </Link>
        <Link
          href="/dashboard/plan"
          className="rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted"
        >
          Portal owner? Switch it on
        </Link>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Online scheduling with deposits is part of the Business plan. Your services and hours are already
        set up — nothing gets rebuilt when you move up.
      </p>
    </div>
  )
}
