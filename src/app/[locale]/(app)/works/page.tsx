import { setRequestLocale } from 'next-intl/server'
import { getAllSouls } from '@/souls'
import { isWorkAvailable } from '@/souls/subscriptions'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { WorksGrid } from '@/components/Library/WorksGrid'

export const metadata = {
  title: 'The Library — Angel OS',
  description:
    'Books, case files, manifestos, and living documents — read freely on Angel OS.',
}

export const dynamic = 'force-dynamic'

// First-order /works route — the Library on its own surface, separate from /learn.
// Nav hides this when the tenant has no subscribed works (like Events), so reaching
// it directly always shows whatever IS available for the tenant.
export default async function WorksPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const { tenant } = await resolveTenantFromHeaders()
  const souls = getAllSouls().filter((s) => isWorkAvailable(s.id, tenant?.slug))

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/5 via-background to-background py-16">
        <div className="container max-w-4xl">
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            The Library
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Books, case files, manifestos, and living documents — read freely, no account
            required. Every work in the network deserves a record. Every record deserves a
            witness.
          </p>
        </div>
      </div>

      <div className="container max-w-4xl py-12">
        {souls.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            No works in the Library yet.
          </div>
        ) : (
          <WorksGrid souls={souls} />
        )}
      </div>
    </div>
  )
}
