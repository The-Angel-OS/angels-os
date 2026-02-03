import { setRequestLocale } from 'next-intl/server'
import Link from 'next/link'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const prefix = locale === 'en' ? '' : `/${locale}`

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Angel OS Dashboard</h1>
      <p className="mb-6 text-muted-foreground">
        Your workspace for Spaces, LEO AI, and collaboration.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={`${prefix}/dashboard/leo`}
          className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <h2 className="font-semibold">LEO System Intelligence</h2>
          <p className="text-sm text-muted-foreground">
            Conversational AI for navigation, data entry, and business intelligence.
          </p>
        </Link>
        <Link
          href={`${prefix}/dashboard/spaces`}
          className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <h2 className="font-semibold">Spaces</h2>
          <p className="text-sm text-muted-foreground">
            Channels, messages, and workspace apps. Discord-like collaboration.
          </p>
        </Link>
      </div>
    </div>
  )
}
