import { setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import { getAllSouls } from '@/souls'

export const metadata = {
  title: 'The Library — Angel OS',
  description:
    'Books, case files, manifestos, and living documents — read freely on Angel OS.',
}

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  green: 'bg-green-500/10 text-green-400 border-green-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

export default async function LearnPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const souls = getAllSouls()

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
            No souls registered yet.
          </div>
        ) : (
          <div className="grid gap-6">
            {souls.map((soul) => {
              const colorClass =
                STATUS_COLORS[soul.statusColor] ??
                'bg-muted/40 text-muted-foreground border-border'
              const docCount = soul.docs.length

              return (
                <Link
                  key={soul.id}
                  href={`/learn/${soul.id}`}
                  className="group block rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors">
                        {soul.title}
                      </h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {soul.subtitle}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${colorClass}`}
                    >
                      {soul.status}
                    </span>
                  </div>

                  <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                    {soul.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {docCount} document{docCount !== 1 ? 's' : ''}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {soul.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="ml-auto font-medium text-primary group-hover:underline">
                      Open case file →
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
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
