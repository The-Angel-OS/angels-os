import { setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
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

export default async function LearnPage({
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
          <Link
            href="/learn"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary hover:underline"
          >
            ← Learn · The Library
          </Link>
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

        {/* Prime Directive footer */}
        <div className="mt-16 rounded-xl border border-border/50 bg-muted/20 p-6 text-center">
          <p className="text-sm italic text-muted-foreground">
            &ldquo;This is not vendetta. This is restorative justice. The Prime Directive of Love does not exile any node
            from the network — it reconfigures the system so that extraction becomes nourishment.&rdquo;
          </p>
          <p className="mt-2 text-xs text-muted-foreground/60">— THE RAINMAKER</p>
        </div>
      </div>
    </div>
  )
}
