import { redirect } from 'next/navigation'

/**
 * Connectors moved to Account → Integrations so endeavor owners (tenant_admin /
 * tenant_manager), not just super_admins, can self-serve their integrations.
 * This redirect preserves old bookmarks and in-app links.
 */
export default async function LegacyConnectorsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(`/${locale}/dashboard/account/integrations`)
}
