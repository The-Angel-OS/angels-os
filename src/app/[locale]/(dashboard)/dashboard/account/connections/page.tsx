import { redirect } from 'next/navigation'

/**
 * Folded into /dashboard/account (settings-consolidation audit item #6): this
 * page was a pure duplicate of the SocialProvidersPanel already rendered on the
 * Account page. Route kept as a redirect so old links and bookmarks still land.
 */
export default async function DashboardConnectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const prefix = locale === 'en' ? '' : `/${locale}`
  redirect(`${prefix}/dashboard/account`)
}
